import { Router } from 'express';
import { connectionPool } from '../../config/db.config';
import { authenticate, AuthenticatedRequest } from '../../middlewares/auth';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import { disableCharger } from '../../services/chargerService';
import { sendNotification } from '../../services/notificationService';
import { sendEmail } from '../../config/email.config';


const router = Router();

const sendInvitationEmail = async (to: string, token: string) => {
  const url = `chargerapp://accept-invitation?token=${token}`;
  const webUrl = `${process.env.WEB_URL || 'http://localhost:8081'}/invitations/accept?token=${token}`;

  const html = `
    <h2>Has sido invitado a gestionar un cargador</h2>
    <p>Para aceptar la invitacion:</p>
    
    <div style="margin: 20px 0;">
        <p><strong>Opcion 1 (Recomendada):</strong></p>
        <a href="${webUrl}" style="display:inline-block;background:#114455;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin:10px 0;">Aceptar desde la Web</a>
    </div>
    
    <div style="margin: 20px 0;">
        <p><strong>Opcion 2 (App movil):</strong></p>
        <a href="${url}" style="display:inline-block;background:#22aa66;color:white;padding:12px 20px;border-radius:8px;text-decoration:none;margin:10px 0;">Abrir en la App</a>
        <p style="font-size:12px;color:#666;">Si no se abre la app, copia y pega este enlace en tu navegador:<br>${webUrl}</p>
    </div>
    
    
    
    <p><em>Este enlace expirara en 7 dias.</em></p>
  `;


  return await sendEmail(
    to,
    'Invitacion a gestionar un cargador',
    html
  );
};

// Enviar invitación con correo
router.post('/send', authenticate, async (req: AuthenticatedRequest, res) => {
  const { email, chargerId, accessLevel } = req.body;

  if (!email || !chargerId || !accessLevel) {
    return res.status(400).json({ success: false, error: 'Faltan datos' });
  }

  try {
    const [existing] = await connectionPool.query<RowDataPacket[]>(
      'SELECT * FROM invitations WHERE guest_email = ? AND charger_id = ? AND status = "pending"',
      [email, chargerId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Ya existe una invitación pendiente' });
    }

    const token = uuidv4();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    await connectionPool.query(
      `INSERT INTO invitations (guest_email, charger_id, invitation_token, access_level, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [email, chargerId, token, accessLevel, expires]
    );

    await sendInvitationEmail(email, token);

    res.json({ success: true, message: 'Invitación enviada' });
  } catch (err) {
    console.error('Error al enviar invitación:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Nuevo endpoint para verificar invitaciones
router.get('/validate-token', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token faltante' });
  }

  try {
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      `SELECT i.*, c.name as charger_name 
             FROM invitations i
             JOIN chargers c ON i.charger_id = c.id
             WHERE i.invitation_token = ? AND i.status = "pending"`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invitación inválida o expirada'
      });
    }

    res.json({
      success: true,
      invitation: rows[0],
      message: `Has sido invitado a usar el cargador "${rows[0].charger_name}"`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Obtener invitaciones del propietario
router.get('/', authenticate, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;

  try {
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      `SELECT i.* FROM invitations i
       JOIN chargers c ON i.charger_id = c.id
       WHERE c.owner_id = ? ORDER BY i.created_at DESC`,
      [userId]
    );

    res.json({ success: true, invitations: rows });
  } catch (err) {
    console.error('Error obteniendo invitaciones:', err);
    res.status(500).json({ success: false, error: 'Error al obtener invitaciones' });
  }
});

// Cancelar invitación (eliminar)
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  try {
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      `SELECT i.* FROM invitations i
       JOIN chargers c ON i.charger_id = c.id
       WHERE i.id = ? AND c.owner_id = ?`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(403).json({ success: false, error: 'No autorizado' });
    }

    await connectionPool.query('DELETE FROM invitations WHERE id = ?', [id]);

    res.json({ success: true, message: 'Invitación cancelada' });
  } catch (err) {
    console.error('Error al cancelar invitación:', err);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// Validar token de invitación
router.get('/validate', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Token faltante' });

  try {
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT * FROM invitations WHERE invitation_token = ? AND status = "pending"',
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Invitación inválida o expirada' });
    }

    res.json({ success: true, invitation: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Aceptar invitación // Este endpoint se usa para aceptar una invitación y asignar el cargador al usuario invit
router.post('/accept', authenticate, async (req: AuthenticatedRequest, res) => {
  const { token } = req.body;
  const userId = req.user?.id;

  if (!token || !userId) {
    return res.status(400).json({ success: false, error: 'Token o usuario inválido' });
  }

  try {
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT * FROM invitations WHERE invitation_token = ? AND status = "pending"',
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Invitación inválida o ya aceptada' });
    }

    const invitation = rows[0];

    // Asignar el cargador al usuario invitado
    await connectionPool.query(
      'INSERT INTO charger_users (charger_id, user_id, access_level) VALUES (?, ?, ?)',
      [invitation.charger_id, userId, invitation.access_level]
    );

    // Marcar la invitación como aceptada
    await connectionPool.query(
      'UPDATE invitations SET status = "accepted", accepted_at = NOW() WHERE id = ?',
      [invitation.id]
    );

    res.json({ success: true, message: 'Invitación aceptada' });
  } catch (err) {
    console.error('Error aceptando invitación:', err);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});
// Obtener usuarios invitados por el propietario
router.get('/my-invited-users', authenticate, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;

  try {
    const [rows] = await connectionPool.query<RowDataPacket[]>(`
      SELECT DISTINCT
        u.id, u.email, u.first_name as firstName, u.last_name as lastName, u.avatar_url,
        c.name AS chargerName, c.serial_number AS serial, c.status,
        cu.access_level,
        i.accepted_at AS acceptedAt,
        cu.rate_per_kwh AS ratePerKwh,
        cu.energy_limit AS energyLimit,
        cu.alias,
        cu.monthly_energy_used AS monthlyEnergyUsed,
        cu.monthly_energy_accumulated AS monthlyEnergyAccumulated,
        cu.is_blocked AS isBlocked,
        (SELECT COALESCE(SUM(total_energy), 0) 
         FROM charging_sessions 
         WHERE charger_id = c.id AND user_id = u.id) AS totalEnergy,
        (SELECT COALESCE(SUM(estimated_cost), 0) 
         FROM charging_sessions 
         WHERE charger_id = c.id AND user_id = u.id) AS totalCost,
        ROUND(cu.monthly_energy_used * cu.rate_per_kwh, 2) AS monthlyCost,
        COALESCE(cu.monthly_cost_accumulated, 0) AS monthlyCostAccumulated
      FROM charger_users cu
      JOIN users u ON u.id = cu.user_id
      JOIN chargers c ON c.id = cu.charger_id
      JOIN invitations i ON i.guest_email = u.email AND i.charger_id = c.id
      WHERE c.owner_id = ? AND cu.access_level != 'owner'
      GROUP BY u.id, c.id
    `, [userId]);

    res.json({ success: true, guests: rows });
  } catch (err) {
    console.error('Error cargando invitados:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});
// Bloquear usuario específicamente
router.put('/:serial/block-user/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  const { serial, userId } = req.params;
  const ownerId = req.user?.id;

  try {
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      'SELECT id FROM chargers WHERE serial_number = ? AND owner_id = ?',
      [serial, ownerId]
    );

    if (!charger.length) return res.status(403).json({ success: false, error: 'No autorizado' });

    // Use is_blocked flag only, as access_level enum does not support 'blocked'
    await connectionPool.query(
      'UPDATE charger_users SET is_blocked = 1 WHERE user_id = ? AND charger_id = ?',
      [userId, charger[0].id]
    );

    res.json({ success: true, message: 'Usuario bloqueado' });
  } catch (err) {
    console.error('Error blocking user:', err);
    res.status(500).json({ success: false, error: 'Error al bloquear usuario' });
  }
});
// Eliminar usuario del cargador
router.delete('/chargers/:serial/remove-user/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  const { serial, userId } = req.params;
  const ownerId = req.user?.id;

  try {
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      'SELECT id FROM chargers WHERE serial_number = ? AND owner_id = ?',
      [serial, ownerId]
    );

    if (!charger.length) return res.status(403).json({ success: false, error: 'No autorizado' });

    // Eliminar el usuario de charger_users
    await connectionPool.query(
      'DELETE FROM charger_users WHERE user_id = ? AND charger_id = ?',
      [userId, charger[0].id]
    );

    // También eliminar las invitaciones relacionadas
    await connectionPool.query(
      'DELETE FROM invitations WHERE guest_email = (SELECT email FROM users WHERE id = ?) AND charger_id = ?',
      [userId, charger[0].id]
    );

    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
  }
});
// Actualizar información de usuario en cargador
router.put('/chargers/:serial/update-user/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  const { serial, userId } = req.params;
  const { alias, firstName, lastName, ratePerKwh, energyLimit } = req.body;
  const ownerId = req.user?.id;

  try {
    // Verificar que el usuario es propietario del cargador
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      'SELECT id FROM chargers WHERE serial_number = ? AND owner_id = ?',
      [serial, ownerId]
    );

    if (!charger.length) {
      return res.status(403).json({ success: false, error: 'No autorizado' });
    }

    // Actualizar los campos en la base de datos
    const [result] = await connectionPool.query(
      'UPDATE charger_users SET alias = ?, rate_per_kwh = ?, energy_limit = ? WHERE user_id = ? AND charger_id = ?',
      [alias, ratePerKwh, energyLimit, userId, charger[0].id]
    );

    // Actualizar nombre y apellido en la tabla users si se proporcionan
    if (firstName || lastName) {
      const updateFields = [];
      const updateValues = [];

      if (firstName) {
        updateFields.push('first_name = ?');
        updateValues.push(firstName);
      }
      if (lastName) {
        updateFields.push('last_name = ?');
        updateValues.push(lastName);
      }

      if (updateFields.length > 0) {
        updateValues.push(userId);
        await connectionPool.query(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }
    }

    // Verificar que se actualizó algún registro
    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado en el cargador' });
    }

    res.json({
      success: true,
      message: 'Información actualizada',
      updatedFields: { alias, firstName, lastName, ratePerKwh, energyLimit }
    });
  } catch (err) {
    console.error('Error al actualizar usuario:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
});

// Desbloquear usuario específicamente
router.put('/chargers/:serial/unblock-user/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  const { serial, userId } = req.params;
  const ownerId = req.user?.id;

  try {
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      'SELECT id FROM chargers WHERE serial_number = ? AND owner_id = ?',
      [serial, ownerId]
    );

    if (!charger.length) return res.status(403).json({ success: false, error: 'No autorizado' });

    await connectionPool.query(
      'UPDATE charger_users SET access_level = "user", is_blocked = 0 WHERE user_id = ? AND charger_id = ?',
      [userId, charger[0].id]
    );

    res.json({ success: true, message: 'Usuario desbloqueado' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al desbloquear usuario' });
  }
});

// Reiniciar límite de energía mensual
router.put('/chargers/:serial/reset-energy-limit/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  console.log('=== ENDPOINT REINICIAR LÍMITE LLAMADO ===');
  const { serial, userId } = req.params;
  const ownerId = req.user?.id;

  console.log('Reiniciando límite de energía:', { serial, userId, ownerId });

  try {
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      'SELECT id FROM chargers WHERE serial_number = ? AND owner_id = ?',
      [serial, ownerId]
    );

    console.log('Cargador encontrado:', charger);

    if (!charger.length) return res.status(403).json({ success: false, error: 'No autorizado' });

    // Obtener el costo acumulado antes de reiniciar
    const [userData] = await connectionPool.query<RowDataPacket[]>(
      'SELECT monthly_energy_used, monthly_energy_accumulated, rate_per_kwh, monthly_cost_accumulated, energy_limit FROM charger_users WHERE user_id = ? AND charger_id = ?',
      [userId, charger[0].id]
    );

    console.log('Datos del usuario:', userData);

    if (userData.length > 0) {
      const currentEnergy = parseFloat(userData[0].monthly_energy_used) || 0;
      const currentAccumulated = parseFloat(userData[0].monthly_energy_accumulated) || 0;
      const energyLimit = parseFloat(userData[0].energy_limit) || 0;
      const ratePerKwh = parseFloat(userData[0].rate_per_kwh) || 0;
      const currentCostAccumulated = parseFloat(userData[0].monthly_cost_accumulated) || 0;

      // Calcular costo del mes actual y nuevo costo acumulado
      const currentMonthlyCost = currentEnergy * ratePerKwh;
      const newAccumulatedCost = currentCostAccumulated + currentMonthlyCost;

      // Calcular total de energía acumulada en el mes (energía actual + energía acumulada)
      const totalMonthlyEnergy = currentEnergy + currentAccumulated;

      // Verificar que los datos se están parseando correctamente
      console.log('Datos parseados:', {
        currentEnergy: typeof currentEnergy,
        currentAccumulated: typeof currentAccumulated,
        totalMonthlyEnergy: typeof totalMonthlyEnergy
      });

      console.log('Energía acumulada:', {
        currentEnergy,
        currentAccumulated,
        totalMonthlyEnergy
      });

      console.log('Cálculos:', {
        currentEnergy,
        currentAccumulated,
        energyLimit,
        ratePerKwh,
        currentMonthlyCost,
        newAccumulatedCost,
        totalMonthlyEnergy
      });

      // Reiniciar energía mensual, acumular energía y costo
      console.log('Ejecutando UPDATE con:', {
        totalMonthlyEnergy,
        newAccumulatedCost,
        userId,
        chargerId: charger[0].id
      });

      await connectionPool.query(
        'UPDATE charger_users SET monthly_energy_used = 0, monthly_energy_accumulated = ?, monthly_cost_accumulated = ? WHERE user_id = ? AND charger_id = ?',
        [totalMonthlyEnergy, newAccumulatedCost, userId, charger[0].id]
      );

      // Verificar que se actualizó correctamente
      const [afterUpdate] = await connectionPool.query<RowDataPacket[]>(
        'SELECT monthly_energy_used, monthly_energy_accumulated, monthly_cost_accumulated FROM charger_users WHERE user_id = ? AND charger_id = ?',
        [userId, charger[0].id]
      );

      console.log('Datos después del UPDATE:', afterUpdate);

      console.log('=== REINICIO EXITOSO ===');
      res.json({
        success: true,
        message: 'Límite de energía reiniciado',
        previousEnergy: currentEnergy,
        previousAccumulated: currentAccumulated,
        energyLimit: energyLimit,
        exceededEnergy: currentEnergy > energyLimit ? currentEnergy - energyLimit : 0,
        previousCost: currentMonthlyCost,
        accumulatedCost: newAccumulatedCost,
        totalMonthlyEnergy: totalMonthlyEnergy
      });
    } else {
      console.log('=== USUARIO NO ENCONTRADO ===');
      res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }
  } catch (err) {
    console.log('=== ERROR EN REINICIO ===', err);
    res.status(500).json({ success: false, error: 'Error al reiniciar límite de energía' });
  }
});
// Verificar límite de energía mensual y desactivar cargador si se alcanza
const checkEnergyLimit = async (userId: number, chargerId: number) => {
  try {
    const [result] = await connectionPool.query<RowDataPacket[]>(`
      SELECT 
        cu.energy_limit,
        (SELECT COALESCE(SUM(total_energy), 0) 
         FROM charging_sessions 
         WHERE charger_id = ? AND user_id = ? 
         AND MONTH(start_time) = MONTH(CURRENT_DATE())
        ) AS monthly_usage
      FROM charger_users cu
      WHERE cu.user_id = ? AND cu.charger_id = ?
    `, [chargerId, userId, userId, chargerId]);

    if (result.length > 0 && result[0].energy_limit) {
      const { energy_limit, monthly_usage } = result[0];
      if (monthly_usage >= energy_limit) {
        // Llamar a API para apagar el cargador
        await disableCharger(chargerId);
        // Enviar notificación al usuario
        sendNotification(userId, 'Has alcanzado tu límite mensual de energía');
      }
    }
  } catch (error) {
    console.error('Error verificando límite de energía:', error);
  }
};
// Actualizar información de usuario en cargador
router.put('/:serial/update-user/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  const { serial, userId } = req.params;
  const { alias, ratePerKwh, energyLimit } = req.body;
  const ownerId = req.user?.id;

  try {
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      'SELECT id FROM chargers WHERE serial_number = ? AND owner_id = ?',
      [serial, ownerId]
    );

    if (!charger.length) return res.status(403).json({ success: false, error: 'No autorizado' });

    await connectionPool.query(
      'UPDATE charger_users SET alias = ?, rate_per_kwh = ?, energy_limit = ? WHERE user_id = ? AND charger_id = ?',
      [alias, ratePerKwh, energyLimit, userId, charger[0].id]
    );

    res.json({ success: true, message: 'Información actualizada' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al actualizar información' });
  }
});

// Eliminar usuario del cargador
router.delete('/:serial/remove-user/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  const { serial, userId } = req.params;
  const ownerId = req.user?.id;

  try {
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      'SELECT id FROM chargers WHERE serial_number = ? AND owner_id = ?',
      [serial, ownerId]
    );

    if (!charger.length) return res.status(403).json({ success: false, error: 'No autorizado' });

    await connectionPool.query(
      'DELETE FROM charger_users WHERE user_id = ? AND charger_id = ?',
      [userId, charger[0].id]
    );

    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
  }
});

// Endpoint de prueba para verificar que las rutas funcionan
router.get('/test-reset/:serial/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  console.log('=== ENDPOINT DE PRUEBA LLAMADO ===');
  const { serial, userId } = req.params;
  res.json({
    success: true,
    message: 'Endpoint de prueba funcionando',
    serial,
    userId
  });
});

// Endpoint de reiniciar límite (versión simplificada para pruebas)
router.put('/test-reset-limit/:serial/:userId', authenticate, async (req: AuthenticatedRequest, res) => {
  console.log('=== ENDPOINT REINICIAR LÍMITE SIMPLIFICADO LLAMADO ===');
  const { serial, userId } = req.params;
  const ownerId = req.user?.id;

  try {
    console.log('Parámetros:', { serial, userId, ownerId });

    // Buscar el cargador
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      'SELECT id FROM chargers WHERE serial_number = ? AND owner_id = ?',
      [serial, ownerId]
    );

    console.log('Cargador encontrado:', charger);

    if (!charger.length) {
      return res.status(403).json({ success: false, error: 'No autorizado' });
    }

    // Verificar datos antes del update
    const [beforeUpdate] = await connectionPool.query<RowDataPacket[]>(
      'SELECT monthly_energy_used, monthly_energy_accumulated, energy_limit, rate_per_kwh, monthly_cost_accumulated FROM charger_users WHERE user_id = ? AND charger_id = ?',
      [userId, charger[0].id]
    );

    console.log('Datos antes del update:', beforeUpdate);

    const currentEnergy = beforeUpdate[0]?.monthly_energy_used || 0;
    const currentAccumulated = beforeUpdate[0]?.monthly_energy_accumulated || 0;
    const energyLimit = beforeUpdate[0]?.energy_limit || 0;
    const ratePerKwh = beforeUpdate[0]?.rate_per_kwh || 0;
    const currentCostAccumulated = beforeUpdate[0]?.monthly_cost_accumulated || 0;

    // Calcular costo del mes actual y nuevo costo acumulado
    const currentMonthCost = currentEnergy * ratePerKwh;
    const newCostAccumulated = currentCostAccumulated + currentMonthCost;

    console.log('Cálculos:', {
      currentEnergy,
      currentAccumulated,
      energyLimit,
      ratePerKwh,
      currentMonthCost,
      currentCostAccumulated,
      newCostAccumulated,
      exceededEnergy: currentEnergy > energyLimit ? currentEnergy - energyLimit : 0
    });

    // Actualizar: solo reiniciar energía mensual y acumular costo
    const [updateResult] = await connectionPool.query(
      'UPDATE charger_users SET monthly_energy_used = 0, monthly_cost_accumulated = ? WHERE user_id = ? AND charger_id = ?',
      [newCostAccumulated, userId, charger[0].id]
    );

    console.log('Resultado del update:', updateResult);

    // Verificar datos después del update
    const [afterUpdate] = await connectionPool.query<RowDataPacket[]>(
      'SELECT monthly_energy_used, monthly_cost_accumulated FROM charger_users WHERE user_id = ? AND charger_id = ?',
      [userId, charger[0].id]
    );

    console.log('Datos después del update:', afterUpdate);

    console.log('=== REINICIO SIMPLIFICADO EXITOSO ===');
    res.json({
      success: true,
      message: 'Límite de energía reiniciado (versión simplificada)',
      previousEnergy: currentEnergy,
      previousAccumulated: currentAccumulated,
      energyLimit: energyLimit,
      exceededEnergy: currentEnergy > energyLimit ? currentEnergy - energyLimit : 0,
      previousCost: currentMonthCost,
      accumulatedCost: newCostAccumulated
    });
  } catch (err) {
    console.log('=== ERROR EN REINICIO SIMPLIFICADO ===', err);
    res.status(500).json({ success: false, error: 'Error al reiniciar límite de energía' });
  }
});

// Endpoint para ejecutar reinicio automático manual (para pruebas)
router.post('/auto-reset-monthly', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    // Importar la función del servicio de cron
    const { executeManualReset } = await import('../../services/cronService');
    await executeManualReset();
    res.json({ success: true, message: 'Reinicio automático ejecutado' });
  } catch (err) {
    console.error('Error ejecutando reinicio automático:', err);
    res.status(500).json({ success: false, error: 'Error ejecutando reinicio automático' });
  }
});

export default router; 