import { firebaseAdmin } from '../../config/firebase.config';
import { connectionPool } from '../../config/db.config';
import { deviceDbPool } from '../../config/deviceDb.config';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import bcrypt from 'bcrypt';

interface AppUser {
    id: number;
    email?: string;
    first_name?: string;
    last_name?: string;
    firebase_uid: string;
    auth_provider: string;
    avatar_url?: string;
    phone?: string;
    is_guest?: boolean;
}

class AuthService {

    async findOrCreateUser(firebaseUser: admin.auth.UserRecord, invitationToken?: string): Promise<{user: AppUser, invitationProcessed: boolean}> {
    let conn = null;
    
    try {
       // console.log('💾 [AuthService.findOrCreateUser] Iniciando transacción...');
        conn = await connectionPool.getConnection();
        await conn.beginTransaction();

        // Buscar usuario existente
      //  console.log(`🔍 [AuthService] Buscando usuario: uid=${firebaseUser.uid}, email=${firebaseUser.email}`);
        const [rows] = await conn.query<RowDataPacket[]>(
            'SELECT * FROM users WHERE firebase_uid = ? OR email = ?',
            [firebaseUser.uid, firebaseUser.email]
        );
        
        let user: AppUser | null = rows[0] as AppUser || null;
        let isNewUser = false;
        let invitationProcessed = false;

        // Si el usuario existe pero no tiene firebase_uid, actualizarlo
        if (user && !user.firebase_uid) {
          //  console.log(`✅ [AuthService] Usuario encontrado pero sin firebase_uid. Actualizando...`);
            await conn.query(
                'UPDATE users SET firebase_uid = ? WHERE id = ?',
                [firebaseUser.uid, user.id]
            );
            user.firebase_uid = firebaseUser.uid;
        }
        // Si no existe, crear nuevo usuario
        else if (!user) {
          //  console.log(`✨ [AuthService] Usuario nuevo. Creando...`);
            isNewUser = true;
            // Determinar si es invitado basado en si tiene token de invitación
            const isGuest = !!invitationToken;
            
            const [result] = await conn.query<ResultSetHeader>(
                'INSERT INTO users (email, password_hash, firebase_uid, first_name, last_name, auth_provider, avatar_url, is_guest) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    firebaseUser.email,
                    null, // Users with Firebase auth don't have a local password
                    firebaseUser.uid,
                    firebaseUser.displayName?.split(' ')[0] || firebaseUser.email?.split('@')[0],
                    firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
                    'google', // Firebase users default to 'google' provider type
                    firebaseUser.photoURL,
                    isGuest
                ]
            );
            
           // console.log(`✅ [AuthService] Usuario creado con ID: ${result.insertId}`);
            
            user = {
                id: result.insertId,
                email: firebaseUser.email,
                first_name: firebaseUser.displayName?.split(' ')[0] || firebaseUser.email?.split('@')[0],
                last_name: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
                firebase_uid: firebaseUser.uid,
                auth_provider: 'google',
                avatar_url: firebaseUser.photoURL,
                is_guest: isGuest
            };
        } else {
           // console.log(`✅ [AuthService] Usuario existente encontrado: ID=${user.id}`);
        }

        // Procesar invitación si existe
        if (invitationToken) {
           // console.log(`🎫 [AuthService] Procesando invitación...`);
            invitationProcessed = await this.processInvitation(conn, user, invitationToken);
            // Marcar como invitado si procesó una invitación
            if (invitationProcessed && !user.is_guest) {
                await conn.query(
                    'UPDATE users SET is_guest = TRUE WHERE id = ?',
                    [user.id]
                );
                user.is_guest = true;
            }
        }

        await conn.commit();
       // console.log(`✅ [AuthService] Transacción completada exitosamente. Usuario: ${user.email}`);
        return {user, invitationProcessed};

    } catch (error) {
        if (conn) {
            console.error('❌ [AuthService] Error en transacción, haciendo rollback...');
            await conn.rollback();
        }
        console.error('❌ [AuthService.findOrCreateUser] Error:', error instanceof Error ? error.message : error);
        throw error;
    } finally {
        if (conn) conn.release();
    }
}

    private async processInvitation(conn: PoolConnection, user: AppUser, invitationToken: string): Promise<boolean> {
    try {
        // 1. Buscar la invitación por token O por email (para cubrir ambos casos)
        const [invitations] = await conn.query<RowDataPacket[]>(
            `SELECT i.*, c.serial_number 
             FROM invitations i
             JOIN chargers c ON i.charger_id = c.id
             WHERE (i.invitation_token = ? OR i.guest_email = ?)
             AND i.status = "pending"
             AND i.expires_at > NOW()
             LIMIT 1 FOR UPDATE`,
            [invitationToken, user.email]
        );

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
        const [existingAccess] = await conn.query<RowDataPacket[]>(
            'SELECT 1 FROM charger_users WHERE charger_id = ? AND user_id = ?',
            [invitation.charger_id, user.id]
        );

        if (existingAccess.length === 0) {
            await conn.query(
                'INSERT INTO charger_users (charger_id, user_id, access_level) VALUES (?, ?, ?)',
                [invitation.charger_id, user.id, invitation.access_level]
            );
        }

        // 4. Actualizar estado de la invitación
        await conn.query(
            'UPDATE invitations SET status = "accepted", accepted_at = NOW() WHERE id = ?',
            [invitation.id]
        );

        console.log('Invitación procesada exitosamente');
        return true;
    } catch (error) {
        console.error('Error al procesar invitación:', error);
        throw error;
    }
}

    private async addUserToDeviceGroup(email: string, serial: string): Promise<void> {
        try {
            const [devices] = await deviceDbPool.query<RowDataPacket[]>(
                'SELECT `group` FROM devices WHERE serial = ?',
                [serial]
            );

            if (devices.length === 0) {
                console.log('Dispositivo no encontrado:', serial);
                return;
            }

            console.log(`Usuario ${email} tiene acceso al dispositivo ${serial}`);
        } catch (error) {
            console.error('Error al verificar dispositivo:', error);
        }
    }

    async ensureUserGroupExists(email: string, userId: number): Promise<void> {
        let deviceConn: PoolConnection | undefined; // ✅ Tipado correcto
        try {
            deviceConn = await deviceDbPool.getConnection();

            const [groupRowsRaw] = await deviceConn.query(
                'SELECT * FROM groups WHERE owner_email = ?',
                [email]
            );
            const groupRows = groupRowsRaw as RowDataPacket[];

            if (groupRows.length === 0) {
                console.log(`Creando nuevo grupo para ${email}`);
                await deviceConn.query(
                    'INSERT INTO groups (name, owner_email) VALUES (?, ?)',
                    [`GRUP-${userId}-${email.split('@')[0]}`, email]
                );
            }
        } catch (error) {
            console.error('Error al verificar/crear grupo en devices_db:', error);
        } finally {
            if (deviceConn) deviceConn.release();
        }
    }

    async generateToken(userId: number, email: string): Promise<string> {
        return jwt.sign(
            { id: userId, email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
        );
    }

    async verifyFirebaseUser(firebaseUid: string): Promise<boolean> {
        try {
            await firebaseAdmin.auth().getUser(firebaseUid);
            return true;
        } catch (error) {
            return false;
        }
    }

    async hashPassword(password: string): Promise<string> {
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
    }
}

export default new AuthService();
