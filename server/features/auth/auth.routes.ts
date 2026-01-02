import { Router } from 'express';
import { firebaseAdmin } from '../../config/firebase.config';
import AuthService from './auth.service';
import { authenticate, AuthenticatedRequest } from '../../middlewares/auth';
import { connectionPool } from '../../config/db.config';
import { RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '../../config/email.config';


const router = Router();

const sendResetPasswordEmail = async (to: string, token: string) => {
  const url = `https://localhost:8081/reset-password?token=${token}`;
  const html = `
    <h2>Recuperación de contraseña</h2>
    <p>Haz clic en el botón para restablecer tu contraseña:</p>
    <a href="${url}" style="display:inline-block;background:#114455;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin-top:10px">Restablecer contraseña</a>
    <p>Este enlace expirará en 1 hora.</p>
  `;
  return await sendEmail(
    to,
    'Recuperación de contraseña',
    html
  );
};

// Verificar token de Firebase y crear usuario si no existe
router.post('/verify', async (req, res) => {
  try {
    const { token, invitationToken } = req.body;

    console.log('🔐 [/verify] Recibido request. Token presentes:', {
      hasToken: !!token,
      hasInvitationToken: !!invitationToken
    });

    // Validar que token esté presente
    if (!token) {
      console.error('❌ [/verify] Token no proporcionado');
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    // Verificar token de Firebase
    console.log('🔍 [/verify] Verificando Firebase token...');
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    console.log('✅ [/verify] Firebase token verificado. UID:', decodedToken.uid);

    console.log('👤 [/verify] Obteniendo usuario de Firebase...');
    const firebaseUser = await firebaseAdmin.auth().getUser(decodedToken.uid);
    console.log('✅ [/verify] Usuario Firebase obtenido:', {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName
    });

    // Buscar o crear usuario local
    console.log('💾 [/verify] Buscando o creando usuario local...');
    const { user, invitationProcessed } = await AuthService.findOrCreateUser(firebaseUser, invitationToken);
    console.log('✅ [/verify] Usuario local procesado:', {
      id: user.id,
      email: user.email,
      isGuest: user.is_guest,
      invitationProcessed
    });

    // Generar token para la API
    if (!user.email) throw new Error('User email is required');
    console.log('🔐 [/verify] Generando API token...');
    const apiToken = await AuthService.generateToken(user.id, user.email);
    console.log('✅ [/verify] API token generado exitosamente');

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

  } catch (error: any) {
    console.error('❌ [/verify] Error en autenticación:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    // Determinar tipo de error
    if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
      console.error('❌ [/verify] Token de Firebase inválido o expirado');
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    if (error.message.includes('User email is required')) {
      console.error('❌ [/verify] Usuario sin email');
      return res.status(400).json({
        success: false,
        error: 'User must have an email address'
      });
    }

    // Error genérico
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


router.post('/update-profile', authenticate, async (req: AuthenticatedRequest, res) => {
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
    await connectionPool.query(
      `UPDATE users 
             SET first_name = ?, last_name = ?, phone = ?, updated_at = NOW() 
             WHERE id = ?`,
      [firstName, lastName || null, phone || null, userId]
    );

    // Obtener usuario actualizado
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

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

  } catch (error) {
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
  if (!email) return res.status(400).json({ success: false, error: 'Email requerido' });
  try {
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ?', [email]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    const token = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await connectionPool.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
      [token, expires, email]
    );
    await sendResetPasswordEmail(email, token);
    res.json({ success: true, message: 'Correo de recuperación enviado' });
  } catch (err) {
    console.error('Error en forgot-password:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Endpoint para resetear contraseña
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ success: false, error: 'Datos requeridos' });
  try {
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()', [token]
    );
    if (rows.length === 0) return res.status(400).json({ success: false, error: 'Token inválido o expirado' });
    const userId = rows[0].id;
    // Hashear la contraseña (usa tu método actual)
    const hashed = await AuthService.hashPassword(newPassword);
    await connectionPool.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [hashed, userId]
    );
    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error en reset-password:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

export default router;