import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { connectionPool } from '../../config/db.config';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { RowDataPacket } from 'mysql2';


const router = Router();

// Registrar dispositivo de autenticación
router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
  const { chargerId, deviceType, deviceIdentifier, deviceName } = req.body;
  const userId = req.user?.id;

  try {
    // Verificar permisos (solo owner/admin puede registrar dispositivos)
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );

    if (access.length === 0 || access[0].access_level === 'user') {
      return res.status(403).json({ 
        success: false, 
        error: 'No tienes permisos para registrar dispositivos' 
      });
    }

    // Validar tipo de dispositivo
    if (!['nfc', 'bluetooth'].includes(deviceType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tipo de dispositivo inválido' 
      });
    }

    // Insertar en la base de datos
    const [result] = await connectionPool.query(
      'INSERT INTO locking_devices (charger_id, device_type, device_identifier, device_name) VALUES (?, ?, ?, ?)',
      [chargerId, deviceType, deviceIdentifier, deviceName]
    );

    res.json({ 
      success: true, 
      deviceId: (result as any).insertId 
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al registrar dispositivo' 
    });
  }
});

// Obtener dispositivos de un cargador
router.get('/:chargerId', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.chargerId;
  const userId = req.user?.id;

  try {
    // Verificar que el usuario tiene acceso al cargador
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT 1 FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );

    if (access.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'No tienes acceso a este cargador' 
      });
    }

    // Obtener dispositivos
    const [devices] = await connectionPool.query(
      'SELECT * FROM locking_devices WHERE charger_id = ?',
      [chargerId]
    );

    res.json({ 
      success: true, 
      devices 
    });
  } catch (error) {
    console.error('Error getting devices:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al obtener dispositivos' 
    });
  }
});

// Eliminar dispositivo
router.delete('/:deviceId', authenticate, async (req: AuthenticatedRequest, res) => {
  const deviceId = req.params.deviceId;
  const userId = req.user?.id;

  try {
    // Verificar permisos (solo owner/admin puede eliminar)
    const [device] = await connectionPool.query<RowDataPacket[]>(
      `SELECT ld.* FROM locking_devices ld
       JOIN charger_users cu ON ld.charger_id = cu.charger_id
       WHERE ld.id = ? AND cu.user_id = ?`,
      [deviceId, userId]
    );

    if (device.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Dispositivo no encontrado o sin permisos' 
      });
    }

    if (device[0].access_level === 'user') {
      return res.status(403).json({ 
        success: false, 
        error: 'No tienes permisos para eliminar este dispositivo' 
      });
    }

    // Eliminar dispositivo
    await connectionPool.query(
      'DELETE FROM locking_devices WHERE id = ?',
      [deviceId]
    );

    res.json({ 
      success: true, 
      message: 'Dispositivo eliminado' 
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al eliminar dispositivo' 
    });
  }
});

export default router;