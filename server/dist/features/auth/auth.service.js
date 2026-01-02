"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_config_1 = require("../../config/firebase.config");
const db_config_1 = require("../../config/db.config");
const deviceDb_config_1 = require("../../config/deviceDb.config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
class AuthService {
    async findOrCreateUser(firebaseUser, invitationToken) {
        let conn = null;
        try {
            conn = await db_config_1.connectionPool.getConnection();
            await conn.beginTransaction();
            // Buscar usuario existente
            const [rows] = await conn.query('SELECT * FROM users WHERE firebase_uid = ? OR email = ?', [firebaseUser.uid, firebaseUser.email]);
            let user = rows[0] || null;
            let isNewUser = false;
            let invitationProcessed = false;
            // Si el usuario existe pero no tiene firebase_uid, actualizarlo
            if (user && !user.firebase_uid) {
                await conn.query('UPDATE users SET firebase_uid = ? WHERE id = ?', [firebaseUser.uid, user.id]);
                user.firebase_uid = firebaseUser.uid;
            }
            // Si no existe, crear nuevo usuario
            else if (!user) {
                isNewUser = true;
                // Determinar si es invitado basado en si tiene token de invitación
                const isGuest = !!invitationToken;
                const [result] = await conn.query('INSERT INTO users (email, firebase_uid, first_name, last_name, auth_provider, avatar_url, is_guest) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                    firebaseUser.email,
                    firebaseUser.uid,
                    firebaseUser.displayName?.split(' ')[0] || firebaseUser.email?.split('@')[0],
                    firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
                    'firebase',
                    firebaseUser.photoURL,
                    isGuest
                ]);
                user = {
                    id: result.insertId,
                    email: firebaseUser.email,
                    first_name: firebaseUser.displayName?.split(' ')[0] || firebaseUser.email?.split('@')[0],
                    last_name: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
                    firebase_uid: firebaseUser.uid,
                    auth_provider: 'firebase',
                    avatar_url: firebaseUser.photoURL,
                    is_guest: isGuest
                };
            }
            // Procesar invitación si existe
            if (invitationToken) {
                invitationProcessed = await this.processInvitation(conn, user, invitationToken);
                // Marcar como invitado si procesó una invitación
                if (invitationProcessed && !user.is_guest) {
                    await conn.query('UPDATE users SET is_guest = TRUE WHERE id = ?', [user.id]);
                    user.is_guest = true;
                }
            }
            await conn.commit();
            return { user, invitationProcessed };
        }
        catch (error) {
            if (conn)
                await conn.rollback();
            throw error;
        }
        finally {
            if (conn)
                conn.release();
        }
    }
    async processInvitation(conn, user, invitationToken) {
        try {
            // 1. Buscar la invitación por token O por email (para cubrir ambos casos)
            const [invitations] = await conn.query(`SELECT i.*, c.serial_number 
             FROM invitations i
             JOIN chargers c ON i.charger_id = c.id
             WHERE (i.invitation_token = ? OR i.guest_email = ?)
             AND i.status = "pending"
             AND i.expires_at > NOW()
             LIMIT 1 FOR UPDATE`, [invitationToken, user.email]);
            if (invitations.length === 0) {
                console.log('Invitación no encontrada o expirada para token/email:', invitationToken, user.email);
                return false;
            }
            const invitation = invitations[0];
            // 2. Verificar coincidencia de email si la invitación se encontró por token
            if (invitation.invitation_token === invitationToken &&
                invitation.guest_email.toLowerCase() !== user.email?.toLowerCase()) {
                console.log('Email no coincide con la invitación');
                return false;
            }
            // 3. Verificar si ya tiene acceso
            const [existingAccess] = await conn.query('SELECT 1 FROM charger_users WHERE charger_id = ? AND user_id = ?', [invitation.charger_id, user.id]);
            if (existingAccess.length === 0) {
                await conn.query('INSERT INTO charger_users (charger_id, user_id, access_level) VALUES (?, ?, ?)', [invitation.charger_id, user.id, invitation.access_level]);
            }
            // 4. Actualizar estado de la invitación
            await conn.query('UPDATE invitations SET status = "accepted", accepted_at = NOW() WHERE id = ?', [invitation.id]);
            console.log('Invitación procesada exitosamente');
            return true;
        }
        catch (error) {
            console.error('Error al procesar invitación:', error);
            throw error;
        }
    }
    async addUserToDeviceGroup(email, serial) {
        try {
            const [devices] = await deviceDb_config_1.deviceDbPool.query('SELECT `group` FROM devices WHERE serial = ?', [serial]);
            if (devices.length === 0) {
                console.log('Dispositivo no encontrado:', serial);
                return;
            }
            console.log(`Usuario ${email} tiene acceso al dispositivo ${serial}`);
        }
        catch (error) {
            console.error('Error al verificar dispositivo:', error);
        }
    }
    async ensureUserGroupExists(email, userId) {
        let deviceConn; // ✅ Tipado correcto
        try {
            deviceConn = await deviceDb_config_1.deviceDbPool.getConnection();
            const [groupRowsRaw] = await deviceConn.query('SELECT * FROM groups WHERE owner_email = ?', [email]);
            const groupRows = groupRowsRaw;
            if (groupRows.length === 0) {
                console.log(`Creando nuevo grupo para ${email}`);
                await deviceConn.query('INSERT INTO groups (name, owner_email) VALUES (?, ?)', [`GRUP-${userId}-${email.split('@')[0]}`, email]);
            }
        }
        catch (error) {
            console.error('Error al verificar/crear grupo en devices_db:', error);
        }
        finally {
            if (deviceConn)
                deviceConn.release();
        }
    }
    async generateToken(userId, email) {
        return jsonwebtoken_1.default.sign({ id: userId, email }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
    }
    async verifyFirebaseUser(firebaseUid) {
        try {
            await firebase_config_1.firebaseAdmin.auth().getUser(firebaseUid);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async hashPassword(password) {
        const salt = await bcrypt_1.default.genSalt(10);
        return bcrypt_1.default.hash(password, salt);
    }
}
exports.default = new AuthService();
