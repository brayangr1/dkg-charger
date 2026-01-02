"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_config_1 = require("../../config/firebase.config");
const auth_service_1 = __importDefault(require("./auth.service"));
const auth_1 = require("../../middlewares/auth");
const db_config_1 = require("../../config/db.config");
const uuid_1 = require("uuid");
const email_config_1 = require("../../config/email.config");
const router = (0, express_1.Router)();
const sendResetPasswordEmail = async (to, token) => {
    const url = `https://localhost:8081/reset-password?token=${token}`;
    const html = `
    <h2>Recuperación de contraseña</h2>
    <p>Haz clic en el botón para restablecer tu contraseña:</p>
    <a href="${url}" style="display:inline-block;background:#114455;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:10px">Restablecer contraseña</a>
    <p>Este enlace expirará en 1 hora.</p>
  `;
    return await (0, email_config_1.sendEmail)(to, 'Recuperación de contraseña', html);
};
// Verificar token de Firebase y crear usuario si no existe
router.post('/verify', async (req, res) => {
    try {
        const { token, invitationToken } = req.body;
        // Verificar token de Firebase
        const decodedToken = await firebase_config_1.firebaseAdmin.auth().verifyIdToken(token);
        const firebaseUser = await firebase_config_1.firebaseAdmin.auth().getUser(decodedToken.uid);
        // Buscar o crear usuario local
        const { user, invitationProcessed } = await auth_service_1.default.findOrCreateUser(firebaseUser, invitationToken);
        // Generar token para la API
        if (!user.email)
            throw new Error('User email is required');
        const apiToken = await auth_service_1.default.generateToken(user.id, user.email);
        res.json({
            success: true,
            token: apiToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                avatarUrl: user.avatar_url,
                isGuest: user.is_guest // Usar el campo persistente
            },
            invitationProcessed
        });
    }
    catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Internal server error',
            });
        }
    }
});
router.post('/update-profile', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id; // Ahora TypeScript reconoce la propiedad user
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'No autorizado'
            });
        }
        const { firstName, lastName, phone } = req.body;
        if (phone && !/^[0-9]{10,15}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Teléfono inválido'
            });
        }
        // Actualizar en la base de datos
        await db_config_1.connectionPool.query(`UPDATE users 
             SET first_name = ?, last_name = ?, phone = ?, updated_at = NOW() 
             WHERE id = ?`, [firstName, lastName || null, phone || null, userId]);
        // Obtener usuario actualizado
        const [rows] = await db_config_1.connectionPool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }
        const user = rows[0];
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                avatarUrl: user.avatar_url
            }
        });
    }
    catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
        });
    }
});
// Endpoint para solicitar recuperación
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email)
        return res.status(400).json({ success: false, error: 'Email requerido' });
    try {
        const [rows] = await db_config_1.connectionPool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0)
            return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        const token = (0, uuid_1.v4)();
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
        await db_config_1.connectionPool.query('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?', [token, expires, email]);
        await sendResetPasswordEmail(email, token);
        res.json({ success: true, message: 'Correo de recuperación enviado' });
    }
    catch (err) {
        console.error('Error en forgot-password:', err);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
// Endpoint para resetear contraseña
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword)
        return res.status(400).json({ success: false, error: 'Datos requeridos' });
    try {
        const [rows] = await db_config_1.connectionPool.query('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]);
        if (rows.length === 0)
            return res.status(400).json({ success: false, error: 'Token inválido o expirado' });
        const userId = rows[0].id;
        // Hashear la contraseña (usa tu método actual)
        const hashed = await auth_service_1.default.hashPassword(newPassword);
        await db_config_1.connectionPool.query('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [hashed, userId]);
        res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    }
    catch (err) {
        console.error('Error en reset-password:', err);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
exports.default = router;
