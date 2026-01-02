// server/features/chargers/chargers.routes.ts
import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../../middlewares/auth';
import { connectionPool } from '../../config/db.config';
import { deviceDbPool } from '../../config/deviceDb.config';
import { RowDataPacket, ResultSetHeader, } from 'mysql2/promise';
import { webSocketServer } from '../../src/app';
import { notificationService } from '../../services/notificationService';
import { chargerService } from '../../services/chargerService';
import { getAdminConnection } from '../../config/adm.config';
import { createChargingSession } from '../../services/chargingService';
import { paymentService } from '../../services/paymentService';







// Nueva función para crear conexión a la base de datos de administración

const router = Router();
router.post('/add', authenticate, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.id || !req.user.email) {
    return res.status(401).json({ success: false, error: 'Usuario no autenticado correctamente' });
  }

  // Normalizar serial
  const serial = req.body.serial?.trim().toUpperCase();
  const userId = req.user.id;
  const userEmail = req.user.email;

  if (!serial) {
    return res.status(400).json({ success: false, error: 'Número de serie requerido' });
  }

  console.log(`Iniciando proceso para agregar cargador ${serial} para usuario ${userId}`);

  let connMain;
  let connDevice;
  let adminConn;

  try {
    // Obtener conexiones
    connMain = await connectionPool.getConnection();
    connDevice = await deviceDbPool.getConnection();
    adminConn = await getAdminConnection();

    // PASO 1: Verificar si ya existe en nuestra base
    const [existingChargers] = await connMain.query<RowDataPacket[]>(
      'SELECT id, owner_id FROM chargers WHERE serial_number = ?',
      [serial]
    );

    // Si existe, verificar si tiene dueño
    if (existingChargers.length > 0) {
      const existingCharger = existingChargers[0];

      if (existingCharger.owner_id) {
        console.log(`Cargador ${serial} ya tiene dueño (ID: ${existingCharger.owner_id})`);
        return res.status(400).json({
          success: false,
          error: 'Este cargador ya está registrado por otro usuario'
        });
      }

      // SI EXISTE PERO NO TIENE DUEÑO (Cargador huérfano / OCPP) -> RECLAMARLO
      console.log(`Cargador ${serial} existe pero es huérfano. Reclamando para usuario ${userId}...`);

      const chargerId = existingCharger.id;

      // 1. Actualizar owner en tabla chargers
      await connMain.query(
        'UPDATE chargers SET owner_id = ?, last_updated = NOW() WHERE id = ?',
        [userId, chargerId]
      );

      // 2. Asignar permisos en charger_users (Owner)
      // Obtenemos precio por defecto o buscamos si hay uno específico (simplificado por ahora a default)
      const basePricePerKwh = 0.30;

      await connMain.query(
        `INSERT INTO charger_users (charger_id, user_id, access_level, rate_per_kwh) 
                 VALUES (?, ?, 'owner', ?)
                 ON DUPLICATE KEY UPDATE access_level = 'owner'`,
        [chargerId, userId, basePricePerKwh]
      );

      // 3. Asegurar dispositivo secundario
      await connMain.query(
        'INSERT IGNORE INTO secondary_devices (charger_id, device_status) VALUES (?, ?)',
        [chargerId, false]
      );

      console.log(`Cargador ${serial} reclamado exitosamente.`);

      return res.json({
        success: true,
        message: 'Cargador asociado exitosamente',
        action: 'claimed',
        charger: {
          id: chargerId,
          serial_number: serial,
          owner_id: userId,
          charger_type: 'ocpp' // Asumimos ocpp si ya existía sin dueño
        }
      });
    }

    // PASO 2: Verificar en la base de dispositivos - MODIFICADO
    const [deviceRows] = await connDevice.query<RowDataPacket[]>(
      'SELECT * FROM devices WHERE serial = ?',
      [serial]
    );

    let chargerType = 'dkg'; // Por defecto DKG
    let device = deviceRows[0];

    if (deviceRows.length == 0) {
      console.log(`Dispositivo ${serial} no encontrado en devices_db - registrando como OCPP`);
      chargerType = 'ocpp';
      // Crear un objeto device básico para OCPP
      device = {
        model: 'OCPP',
        version_sw: '1.0',
        mac: '',
        group: null
      } as any;
    } else {
      device = deviceRows[0];
      console.log(`Dispositivo encontrado: ${JSON.stringify(device)}`);
    }

    // PASO 3: Obtener precio base de administracion.pricing_devices (solo para DKG)
    let basePricePerKwh = 0.30; // Precio por defecto
    if (chargerType === 'dkg') {
      try {
        // Cambiado para apuntar a administracion.pricing_devices
        const [priceRows] = await deviceDbPool.query<RowDataPacket[]>(
          'SELECT base_price_per_kwh FROM administracion.pricing_devices WHERE serial_number = ?',
          [serial]
        );

        if (priceRows.length > 0) {
          basePricePerKwh = Number(priceRows[0].base_price_per_kwh);
          console.log(`Precio base encontrado: ${basePricePerKwh} para serial ${serial}`);
        } else {
          console.log(`No se encontró precio base para ${serial}, usando valor por defecto`);
        }
      } catch (error) {
        console.error('Error al consultar precio base:', error);
        // Continuamos con el precio por defecto
      }
    }

    // PASO 4: Verificar y crear grupo si no existe (solo para DKG)
    let groupId = null;
    if (chargerType === 'dkg') {
      const [groupRows] = await connDevice.query<RowDataPacket[]>(
        'SELECT * FROM groups WHERE owner_email = ?',
        [userEmail]
      );

      if (groupRows.length == 0) {
        console.log(`Creando nuevo grupo para ${userEmail}`);
        const [groupResult] = await connDevice.query<ResultSetHeader>(
          'INSERT INTO groups (name, owner_email) VALUES (?, ?)',
          [`Grupo de ${userEmail.split('@')[0]}`, userEmail]
        );
        groupId = groupResult.insertId;
      } else {
        groupId = groupRows[0].id;
      }

      // PASO 5: Asociar dispositivo con grupo si no está asociado (solo DKG)
      if (!device.group || device.group !== groupId) {
        console.log(`Asociando dispositivo ${device.id} con grupo ${groupId}`);
        await connDevice.query(
          'UPDATE devices SET `group` = ? WHERE id = ?',
          [groupId, device.id]
        );
      }
    }

    // PASO 6: Crear el cargador en nuestra base
    const chargerData = {
      serial_number: serial,
      name: `Cargador ${serial.substring(serial.length - 4)}`,
      model: device.model || 'Desconocido',
      max_power: chargerType === 'dkg' ? 12 : 32, // Valor por defecto diferente
      firmware_version: device.version_sw || '1.0',
      mac_address: device.mac || '',
      owner_id: userId,
      charger_type: chargerType,
      charger_vendor: device.charger_vendor || 'DKG',
    };

    console.log(`Insertando cargador: ${JSON.stringify(chargerData)}`);
    const [insertResult] = await connMain.query(
      'INSERT INTO chargers SET ?',
      [chargerData]
    );

    const chargerId = (insertResult as any).insertId;
    console.log(`Cargador creado con ID: ${chargerId}, Tipo: ${chargerType}`);

    // PASO 7: Crear el dispositivo secundario asociado
    await connMain.query(
      'INSERT INTO secondary_devices (charger_id, device_status) VALUES (?, ?)',
      [chargerId, false]
    );
    console.log(`Dispositivo secundario creado para el cargador ${chargerId}`);

    // PASO 8: Asignar permisos al usuario CON PRECIO (solo para owner)
    await connMain.query(
      'INSERT INTO charger_users (charger_id, user_id, access_level, rate_per_kwh) VALUES (?, ?, ?, ?)',
      [chargerId, userId, 'owner', basePricePerKwh]
    );

    // Actualizar estado de invitado si era invitado
    await chargerService.updateGuestStatus(userId, false);

    // PASO 9: Crear tablas dinámicas si no existen (solo para DKG)
    if (chargerType === 'dkg' || chargerType === 'ocpp') { // Ajustado para incluir 'ocpp'
      const logTable = `charging_log_${serial}`;
      const actionTable = `action_${serial}`;
      const meterValuesTable = `meter_values_${serial}`;

      console.log(`Creando tablas dinámicas: ${logTable} , ${actionTable} y ${meterValuesTable}`);

      // Crear tablas primero
      await connDevice.query(`
                CREATE TABLE IF NOT EXISTS \`${meterValuesTable}\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    charge_point_id INT,
                    connector_id INT,
                    transaction_id INT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    value DECIMAL(10,2),
                    context VARCHAR(100),
                    format VARCHAR(50),
                    measurand VARCHAR(100),
                    unit VARCHAR(50),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

      await connDevice.query(`
                CREATE TABLE IF NOT EXISTS \`${logTable}\` (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    start_time DATETIME,
                    end_time DATETIME,
                    energy_kwh DECIMAL(10,2),
                    power_peak INT,
                    rate_per_kwh DECIMAL(10,4) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

      await connDevice.query(`
                CREATE TABLE IF NOT EXISTS \`${actionTable}\` (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    action_type VARCHAR(100),
                    id_user INT,
                    id_device INT,
                    description TEXT,
                    status ENUM('0', '1', '2', '3') DEFAULT '0',
                    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

      // Primero asegurarse que primary_devices tenga las columnas correctas
      await connMain.query(`
                ALTER TABLE primary_devices 
                ADD COLUMN IF NOT EXISTS id_user INT,
                ADD COLUMN IF NOT EXISTS id_device INT
            `);

      // Insertar en action_${serial} y primary_devices simultáneamente
      await Promise.all([
        // Insertar en la tabla action del dispositivo
        connDevice.query(`
                    INSERT INTO \`${actionTable}\` (action_type, id_user, id_device, description, status, executed_at) 
                    VALUES ('init', ?, ?, 'Cargador inicializado', '0', NOW())
                `, [userId, chargerId]),

        // Insertar en primary_devices (CORREGIDO - mismos valores)
        connMain.query(`
                    INSERT INTO primary_devices (action_type, id_user, id_device, description, status, executed_at) 
                    VALUES ('init', ?, ?, 'Cargador inicializado', '0', NOW())
                `, [userId, chargerId])
      ]);

      // Configurar trigger para sincronización automática
      await connDevice.query(`
                CREATE TRIGGER IF NOT EXISTS \`sync_${actionTable}_to_primary\`
                AFTER INSERT ON \`${actionTable}\`
                FOR EACH ROW
                BEGIN
                    INSERT INTO charger.primary_devices (action_type, id_user, id_device, description, status, executed_at)
                    VALUES (NEW.action_type, NEW.id_user, NEW.id_device, NEW.description, NEW.status, NEW.executed_at);
                END;
            `);

      console.log(`Información creada en tabla ${actionTable} y primary_devices`);
    }

    console.log(`Proceso completado para cargador ${serial} (Tipo: ${chargerType})`);
    res.json({
      success: true,
      message: 'Cargador agregado exitosamente',
      action: 'added',
      charger: {
        id: chargerId,
        ...chargerData,
        rate_per_kwh: basePricePerKwh, // Incluimos el precio en la respuesta
        charger_type: chargerType // ← Incluir tipo en respuesta
      }
    });

  } catch (error) {
    console.error(`Error en el proceso completo:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV == 'development' ? errorMessage : undefined
    });
  } finally {
    if (connMain) connMain.release();
    if (connDevice) connDevice.release();
    if (adminConn) adminConn.release(); // Liberar conexión a administracion
  }
});


// Ruta para obtener listas dispositivos

router.get('/list', async (req, res) => {
  try {
    const [devices] = await deviceDbPool.query('SELECT serial, name FROM devices');
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
});




//ruta nueva asignar cargador de terceros (solo serial)
// Endpoint para reclamar cargadores de terceros (solo con serial)
router.post('/:serial/claim', authenticate, async (req: AuthenticatedRequest, res) => {
  const serial = req.params.serial?.trim().toUpperCase();
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
  }

  if (!serial) {
    return res.status(400).json({ success: false, error: 'Número de serie requerido' });
  }

  let conn;
  try {
    conn = await connectionPool.getConnection();

    // PASO 1: Verificar si el cargador ya existe
    const [existingChargers] = await conn.query<RowDataPacket[]>(
      'SELECT id, owner_id, serial_number FROM chargers WHERE serial_number = ?',
      [serial]
    );

    // Si existe y tiene dueño
    if (existingChargers.length > 0 && existingChargers[0].owner_id) {
      const charger = existingChargers[0];

      if (charger.owner_id === userId) {
        return res.status(400).json({
          success: false,
          error: 'Ya eres el propietario de este cargador'
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Este cargador ya está asociado a otra cuenta'
      });
    }

    let chargerId;

    // PASO 2: Si existe pero no tiene dueño, actualizar
    if (existingChargers.length > 0 && !existingChargers[0].owner_id) {
      chargerId = existingChargers[0].id;

      await conn.query(
        'UPDATE chargers SET owner_id = ?, last_updated = NOW() WHERE id = ?',
        [userId, chargerId]
      );

      console.log(`Cargador existente ${serial} actualizado para usuario ${userId}`);
    }
    // PASO 3: Si no existe, crear nuevo cargador
    else {
      const chargerData = {
        serial_number: serial,
        name: `Cargador ${serial.substring(serial.length - 4)}`, // Últimos 4 dígitos
        model: 'Desconocido',
        max_power: 16, // 16V estándar como mencionaste
        firmware_version: '1.0',
        mac_address: '',
        owner_id: userId,
        status: 'standby',
        network_status: 'online',
        usage_type: 'payment',
        charging_mode: 'grid',
        registered_at: new Date(),
        last_updated: new Date()
      };

      const [insertResult] = await conn.query(
        'INSERT INTO chargers SET ?',
        [chargerData]
      );

      chargerId = (insertResult as any).insertId;
      console.log(`Nuevo cargador ${serial} creado para usuario ${userId}`);
    }

    // PASO 4: Crear registro en charger_users como owner
    await conn.query(
      `INSERT INTO charger_users (charger_id, user_id, access_level, rate_per_kwh) 
       VALUES (?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE access_level = VALUES(access_level)`,
      [chargerId, userId, 'owner', 0.30] // Precio por defecto
    );

    // PASO 5: Crear dispositivo secundario si no existe
    const [secondaryDevices] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM secondary_devices WHERE charger_id = ?',
      [chargerId]
    );

    if (secondaryDevices.length === 0) {
      await conn.query(
        'INSERT INTO secondary_devices (charger_id, device_status) VALUES (?, ?)',
        [chargerId, false]
      );
    }

    return res.json({
      success: true,
      message: 'Cargador reclamado correctamente',
      chargerId: chargerId
    });

  } catch (err) {
    console.error('Error reclamando cargador:', err);

    // Manejar error de duplicado único
    if (err instanceof Error && 'code' in err && (err as any).code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Este cargador ya existe en el sistema'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  } finally {
    if (conn) conn.release();
  }
});



// Asociar / Reclamar un cargador existente (ej: cargador que se registró vía OCPP automáticamente)
router.put('/:serial/associate', authenticate, async (req: AuthenticatedRequest, res) => {
  const serial = req.params.serial;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ success: false, error: 'Usuario no autenticado' });

  let conn;
  try {
    conn = await connectionPool.getConnection();

    // Buscar el cargador por serial
    const [rows] = await conn.query<RowDataPacket[]>('SELECT id, owner_id FROM chargers WHERE serial_number = ?', [serial]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cargador no encontrado' });
    }

    const charger = rows[0] as any;

    if (charger.owner_id) {
      return res.status(400).json({ success: false, error: 'Este cargador ya está asociado a otra cuenta' });
    }

    // Asociar al usuario
    await conn.query('UPDATE chargers SET owner_id = ? WHERE id = ?', [userId, charger.id]);

    // Crear registro en charger_users como owner
    await conn.query(
      'INSERT INTO charger_users (charger_id, user_id, access_level, rate_per_kwh) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE access_level = VALUES(access_level)',
      [charger.id, userId, 'owner', 0]
    );

    return res.json({ success: true, message: 'Cargador asociado correctamente', chargerId: charger.id });
  } catch (err) {
    console.error('Error asociando cargador:', err);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
});

// Obtener estado de un cargador por serial (network_status, last_updated, owner)
router.get('/status/:serial', async (req, res) => {
  const serial = req.params.serial;
  let conn;
  try {
    conn = await connectionPool.getConnection();
    const [rows] = await conn.query<RowDataPacket[]>('SELECT id, owner_id, network_status, status, last_updated FROM chargers WHERE serial_number = ?', [serial]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cargador no encontrado' });
    }

    const c = rows[0] as any;

    // Si tiene owner_id, obtener correo o nombre básico
    let owner: any = null;
    if (c.owner_id) {
      const [owners] = await conn.query<RowDataPacket[]>('SELECT id, email, name FROM users WHERE id = ?', [c.owner_id]);
      if (owners && owners.length > 0) owner = owners[0];
    }

    return res.json({
      success: true,
      serial,
      chargerId: c.id,
      owner,
      network_status: c.network_status,
      status: c.status,
      last_updated: c.last_updated
    });
  } catch (err) {
    console.error('Error obteniendo estado del cargador:', err);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
});

// actualizar precios 
router.post('/pricing', async (req, res) => {
  const { serial_number, base_price_per_kwh, price_grid, price_solar, price_mixed, price_surplus } = req.body;

  if (!serial_number || base_price_per_kwh === undefined) {
    return res.status(400).json({ error: 'Serial number y precio son requeridos' });
  }

  // Si no se especifica price_grid, igualar a base_price_per_kwh
  const gridPrice = price_grid !== undefined ? price_grid : base_price_per_kwh;
  // Si no se especifica base_price_per_kwh, igualar a price_grid
  const basePrice = base_price_per_kwh !== undefined ? base_price_per_kwh : price_grid;

  try {
    // 1. Actualizar en administracion.pricing_devices (para registro/histórico)
    await deviceDbPool.query(`
      INSERT INTO administracion.pricing_devices 
        (serial_number, base_price_per_kwh, price_grid, price_solar, price_mixed, price_surplus, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        base_price_per_kwh = VALUES(base_price_per_kwh),
        price_grid = VALUES(price_grid),
        price_solar = VALUES(price_solar),
        price_mixed = VALUES(price_mixed),
        price_surplus = VALUES(price_surplus),
        updated_at = NOW()
    `, [serial_number, base_price_per_kwh, gridPrice, price_solar, price_mixed, price_surplus]);

    // 2. Actualizar directamente en charger_users (sin esperar sincronización)
    const [result] = await connectionPool.query(
      `UPDATE charger_users cu
       JOIN chargers c ON cu.charger_id = c.id
       SET cu.rate_per_kwh = ?
       WHERE c.serial_number = ? 
       AND cu.access_level = 'owner'`,
      [base_price_per_kwh, serial_number]
    );

    // Verificar si se actualizó algún registro
    if ((result as any).affectedRows === 0) {
      console.warn(`No se encontró owner para actualizar precio en ${serial_number}`);
      // No es error fatal, solo log warning
    }

    return res.json({
      success: true,
      message: 'Precios actualizados correctamente en ambas bases de datos',
      updatedInPricing: true,
      updatedInChargers: (result as any).affectedRows > 0
    });

  } catch (error) {
    console.error('Error al actualizar precio:', error);

    if (error instanceof Error) {
      return res.status(500).json({
        error: 'Error al actualizar el precio',
        details: error.message
      });
    } else {
      return res.status(500).json({
        error: 'Error desconocido al actualizar el precio',
        details: String(error)
      });
    }
  }

});



// Obtener cargadores propios y compartidos
router.get('/mine-with-owner', authenticate, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;

  try {
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      `SELECT 
         c.id, 
          c.serial_number, 
          c.name, 
          c.model, 
          c.status, 
          c.network_status, 
          c.firmware_version, 
          c.max_power,
          c.last_updated,
          cu.access_level,
          cu.is_blocked,
          pd.status as primary_device_status,
          CASE 
            WHEN c.owner_id = ? THEN (
              SELECT COALESCE(SUM(cu2.monthly_energy_used + cu2.monthly_energy_accumulated), 0)
              FROM charger_users cu2 
              WHERE cu2.charger_id = c.id
            )
            ELSE cu.monthly_energy_used + cu.monthly_energy_accumulated
          END as monthly_energy,
          CASE 
            WHEN c.owner_id = ? THEN (
              SELECT COALESCE(SUM(cu2.monthly_energy_used + cu2.monthly_energy_accumulated), 0) * cu.rate_per_kwh
              FROM charger_users cu2 
              WHERE cu2.charger_id = c.id
            )
            ELSE cu.monthly_cost_accumulated
          END as monthly_cost,
        CASE WHEN c.owner_id = ? THEN 'owner' ELSE 'shared' END as ownership
      FROM chargers c 
      INNER JOIN charger_users cu ON cu.charger_id = c.id 
      LEFT JOIN (
        SELECT pd1.* 
        FROM primary_devices pd1
        INNER JOIN (
          SELECT id_device, MAX(executed_at) as max_executed_at
          FROM primary_devices
          GROUP BY id_device
        ) pd2 ON pd1.id_device = pd2.id_device AND pd1.executed_at = pd2.max_executed_at
      ) pd ON pd.id_device = c.id
      WHERE cu.user_id = ?`,
      [userId, userId, userId, userId]
    );

    // Procesar los resultados para usar el estado de primary_devices si existe
    const processedRows = rows.map(row => {
      // Si hay un estado en primary_devices, usar ese, si no, usar el estado original
      if (row.primary_device_status !== null && row.primary_device_status !== undefined) {
        return {
          ...row,
          status: row.primary_device_status
        };
      }
      return row;
    });


    res.json({ success: true, chargers: processedRows });
  } catch (err) {
    console.error('Error obteniendo cargadores:', err);
    res.status(500).json({ success: false, error: 'Error al obtener los cargadores' });
  }
});





//  * GET /api/chargers/mine  * Obtener todos los cargadores del usuario actual
// Este endpoint devuelve todos los cargadores asociados al usuario autenticado, incluyendo aquellos que son de su propiedad y los que le han sido compartidos.
// Requiere autenticación y devuelve un array de cargadores con sus detalles básicos.
// Si ocurre un error al consultar la base de datos, devuelve un error 500.
// Este endpoint es útil para que los usuarios puedan ver todos los cargadores a los que tienen
// acceso, ya sea porque son propietarios o porque les han sido compartidos por otros usuarios.
router.get('/mine', authenticate, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;

  try {
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      `SELECT 
        c.id, 
        c.serial_number, 
        c.name, 
        c.model, 
        c.status, 
        c.network_status, 
        c.firmware_version, 
        c.max_power,
        c.last_updated,
        c.charger_box_serial_number,
        c.charger_vendor,
        c.charger_ip,
        c.charger_type,
        c.device_status,
        cu.access_level,
        cu.is_blocked,        
        pd.status as primary_device_status,
        CASE 
          WHEN c.owner_id = ? THEN (
            SELECT COALESCE(SUM(cu2.monthly_energy_used + cu2.monthly_energy_accumulated), 0)
            FROM charger_users cu2 
            WHERE cu2.charger_id = c.id
          )
          ELSE cu.monthly_energy_used + cu.monthly_energy_accumulated
        END as monthly_energy,
        CASE 
          WHEN c.owner_id = ? THEN (
            SELECT COALESCE(SUM(cu2.monthly_energy_used + cu2.monthly_energy_accumulated), 0) * cu.rate_per_kwh
            FROM charger_users cu2 
            WHERE cu2.charger_id = c.id
          )
          ELSE cu.monthly_cost_accumulated
        END as monthly_cost
      FROM chargers c 
      INNER JOIN charger_users cu ON cu.charger_id = c.id 
      LEFT JOIN (
        SELECT pd1.* 
        FROM primary_devices pd1
        INNER JOIN (
          SELECT id_device, MAX(executed_at) as max_executed_at
          FROM primary_devices
          GROUP BY id_device
        ) pd2 ON pd1.id_device = pd2.id_device AND pd1.executed_at = pd2.max_executed_at
      ) pd ON pd.id_device = c.id
      WHERE cu.user_id = ?`,
      [userId, userId, userId]
    );

    // Procesar los resultados para usar el estado de primary_devices si existe
    const processedRows = rows.map(row => {
      // Si hay un estado en primary_devices, usar ese, si no, usar el estado original
      if (row.primary_device_status !== null && row.primary_device_status !== undefined) {
        return {
          ...row,
          status: row.primary_device_status
        };
      }
      return row;
    });


    res.json({ success: true, chargers: processedRows });
  } catch (err) {
    console.error('Error obteniendo cargadores del usuario:', err);
    res.status(500).json({ success: false, error: 'Error al obtener los cargadores' });
  }
});

//  * GET /api/chargers/:id   * Obtener detalles de un cargador específico
// Este endpoint permite a un usuario autenticado obtener los detalles de un cargador específico al que tiene acceso.
// Requiere autenticación y verifica que el usuario tenga permisos para acceder al cargador.
// Devuelve:
// - Información básica del cargador
// - Nivel de acceso del usuario
// - Programaciones de carga
// - Precio por kWh configurado para el usuario
// - Límite de energía configurado
// - Sesiones de carga recientes
// Nueva ruta para obtener los cargadores de tipo "home" del usuario
// Se coloca AQUI antes de /:id para evitar colisión de rutas
router.get('/home-chargers', authenticate, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
  }

  let conn;
  try {
    conn = await connectionPool.getConnection();

    // Obtener los cargadores de tipo "home" del usuario
    const [chargerRows] = await conn.query<RowDataPacket[]>(
      `SELECT c.id, c.name, c.serial_number, c.registered_at as created_at 
       FROM chargers c 
       JOIN charger_users cu ON c.id = cu.charger_id 
       WHERE c.usage_type = 'home' AND cu.user_id = ?
       ORDER BY c.registered_at DESC`,
      [req.user.id]
    );

    res.json({ success: true, chargers: chargerRows });
  } catch (error) {
    console.error('Error obteniendo cargadores home:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
});

//  * GET /api/chargers/:id   * Obtener detalles de un cargador específico
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.id;
  const userId = req.user?.id;
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  try {
    // 1. Verificar que el usuario tiene acceso al cargador
    const [accessRows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );

    if (accessRows.length == 0) {
      return res.status(403).json({
        success: false,
        error: 'No tienes acceso a este cargador'
      });
    }

    // 2. Obtener detalles básicos del cargador y datos del usuario (precio, límite)
    const [chargerRows] = await connectionPool.query<RowDataPacket[]>(
      `SELECT 
                c.*, 
                cu.access_level,
                cu.rate_per_kwh,
                cu.energy_limit
            FROM chargers c

            JOIN charger_users cu ON cu.charger_id = c.id
            WHERE c.id = ? AND cu.user_id = ?`,
      [chargerId, userId]
    );

    if (chargerRows.length == 0) {
      return res.status(404).json({
        success: false,
        error: 'Cargador no encontrado'
      });
    }

    // 3. Obtener programaciones de carga
    const [schedules] = await connectionPool.query<RowDataPacket[]>(
      'SELECT * FROM charging_schedules WHERE charger_id = ?',
      [chargerId]
    );

    // 4. Obtener consumo energético mensual del cargador (todos los usuarios)
    // console.log('ChargerDetail - Calculando energía para cargador:', chargerId);
    //console.log('ChargerDetail - Fecha de inicio del mes:', firstDayOfMonth);

    // Calcular energía total del cargador (sesiones + energía acumulada de usuarios)
    const [sessionsEnergy] = await connectionPool.query<RowDataPacket[]>(
      'SELECT COALESCE(SUM(total_energy), 0) as total FROM charging_sessions WHERE charger_id = ? AND start_time >= ?',
      [chargerId, firstDayOfMonth]
    );

    const [usersEnergy] = await connectionPool.query<RowDataPacket[]>(
      'SELECT COALESCE(SUM(monthly_energy_used), 0) + COALESCE(SUM(monthly_energy_accumulated), 0) as total FROM charger_users WHERE charger_id = ?',
      [chargerId]
    );

    const totalEnergy = parseFloat(sessionsEnergy[0].total) + parseFloat(usersEnergy[0].total);

    // console.log('ChargerDetail - Energía de sesiones:', sessionsEnergy[0].total);
    //  console.log('ChargerDetail - Energía de usuarios:', usersEnergy[0].total);
    //  console.log('ChargerDetail - Energía total calculada:', totalEnergy);

    // Debug: Verificar datos en las tablas
    const [debugSessions] = await connectionPool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as session_count, SUM(total_energy) as total_energy FROM charging_sessions WHERE charger_id = ?',
      [chargerId]
    );

    const [debugUsers] = await connectionPool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as user_count, SUM(monthly_energy_used) as total_used, SUM(monthly_energy_accumulated) as total_accumulated FROM charger_users WHERE charger_id = ?',
      [chargerId]
    );

    //console.log('ChargerDetail - Debug sessions:', debugSessions);
    // console.log('ChargerDetail - Debug users:', debugUsers);

    // 5. Obtener sesiones recientes (últimas 5) - todas las sesiones del cargador
    //console.log('ChargerDetail - Consultando sesiones para cargador:', chargerId);
    const [sessions] = await connectionPool.query<RowDataPacket[]>(
      `SELECT 
                id, 
                start_time, 
                end_time,
                total_energy, 
                duration_seconds, 
                estimated_cost,
                max_power_used
             FROM charging_sessions 
             WHERE charger_id = ? 
             ORDER BY start_time DESC
             LIMIT 5`,
      [chargerId]
    );
    // console.log('ChargerDetail - Resultado de consulta de sesiones:', sessions);

    // 6. Preparar respuesta consolidada
    // console.log('ChargerDetail - Energía mensual calculada:', totalEnergy);
    //console.log('ChargerDetail - Sesiones devueltas:', sessions);

    const response = {
      success: true,
      charger: {
        ...chargerRows[0],
        monthly_energy: totalEnergy
      },
      access_level: accessRows[0].access_level,
      schedules: schedules.map(s => ({
        ...s,
        week_days: s.week_days ? s.week_days.split(',') : []
      })),
      sessions: sessions || []
    };

    // console.log('ChargerDetail - Respuesta completa enviada:', response);
    res.json(response);

  } catch (err) {
    // console.error('Error obteniendo detalles del cargador:', err);

    const errorMessage =
      err instanceof Error ? err.message : 'Error desconocido';

    res.status(500).json({
      success: false,
      error: 'Error al obtener detalles del cargador',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }

});

//  * PUT /api/chargers/:id/settings * Actualizar configuración de un cargador 
// Este endpoint permite a un usuario autenticado actualizar la configuración de un cargador específico al que tiene acceso.
// Requiere autenticación y verifica que el usuario tenga permisos para modificar la configuración.
// Si el usuario no tiene permisos (por ejemplo, si es un usuario invitado), devuelve un error 403.
// Si los datos enviados son inválidos (por ejemplo, el nombre no es una cadena), devuelve un error 400.
// Si el cargador no existe, devuelve un error  404.
// Si todo es correcto, actualiza la configuración del cargador en la base de datos y devuelve un mensaje de éxito.
// Este endpoint es útil para que los usuarios puedan modificar la configuración de sus cargadores, como el nombre del cargador, la red WiFi a la que está conectado,
// las opciones de iluminación y los métodos de bloqueo disponibles.
// También es un paso previo para que los usuarios puedan personalizar la experiencia de uso de sus cargadores, adaptándolos a sus preferencias y necesidades específicas.
router.put('/:id/settings', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.id;
  const userId = req.user?.id;
  const settings = req.body;

  try {
    // Verificar permisos (solo owner/admin puede cambiar config)
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );

    // 🔐 Denegar si el usuario es 'user' (invitado)
    if (access.length === 0 || access[0].access_level === 'user') {
      return res.status(403).json({ success: false, error: 'No tienes permisos para esta acción' });
    }

    // Validar datos
    if (!settings.name || typeof settings.name !== 'string') {
      return res.status(400).json({ success: false, error: 'Nombre inválido' });
    }

    // Actualizar en base de datos
    await connectionPool.query(
      `UPDATE chargers SET
        name = ?,
        wifi_ssid = ?,
        lighting_config = ?,
        lock_methods = ?,
        last_updated = NOW()
      WHERE id = ?`,
      [
        settings.name,
        settings.network?.wifiSSID,
        JSON.stringify(settings.lighting || {}),
        JSON.stringify(settings.lockMethods || {}),
        chargerId
      ]
    );

    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (error) {
    console.error('Error updating charger settings:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar configuración' });
  }
});

// Obtener configuración de un cargador
router.get('/:id/settings', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.id;
  const userId = req.user?.id;

  try {
    // Verificar acceso
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT 1 FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );
    if (access.length === 0) {
      return res.status(403).json({ error: 'No tienes acceso a este cargador' });
    }

    // Obtener configuración
    const [chargerRows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT name, wifi_ssid, lighting_config, lock_methods FROM chargers WHERE id = ?',
      [chargerId]
    );
    if (chargerRows.length === 0) {
      return res.status(404).json({ error: 'Cargador no encontrado' });
    }

    // Parsear campos JSON si es necesario
    const charger = chargerRows[0];
    res.json({
      name: charger.name,
      network: { wifiSSID: charger.wifi_ssid || '', wifiPassword: '' }, // Si tienes wifiPassword, agrégalo aquí
      lighting: charger.lighting_config ? JSON.parse(charger.lighting_config) : {},
      lockMethods: charger.lock_methods ? JSON.parse(charger.lock_methods) : {}
    });
  } catch (error) {
    console.error('Error al obtener ajustes:', error);
    res.status(500).json({ error: 'Error al obtener ajustes' });
  }
});

//  * PUT /api/chargers/:id/power  * Actualiza la potencia máxima de un cargador
// Este endpoint permite a un usuario autenticado actualizar la potencia máxima de un cargador específico al que tiene acceso.
router.put('/:id/power', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.id;
  const { max_power } = req.body;
  const userId = req.user?.id;

  // Validar que la potencia esté entre 6 y 32
  if (max_power < 6 || max_power > 32) {
    return res.status(400).json({
      success: false,
      error: 'La potencia debe estar entre 6A y 32A'
    });
  }

  try {
    // Verificar que el usuario tiene permisos para modificar este cargador
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );
    // 🔐 Denegar si el usuario es 'user' (invitado)
    if (access.length === 0 || access[0].access_level === 'user') {
      return res.status(403).json({ success: false, error: 'No tienes permisos para esta acción' });
    }
    // Actualizar la potencia en la base de datos
    await connectionPool.query(
      'UPDATE chargers SET max_power = ? WHERE id = ?',
      [max_power, chargerId]
    );

    const [updated] = await connectionPool.query<RowDataPacket[]>(
      'SELECT * FROM chargers WHERE id = ?',
      [chargerId]
    );

    res.json({
      success: true,
      message: 'Potencia actualizada correctamente',
      charger: updated[0]
    });
  } catch (error) {
    console.error('Error al actualizar potencia:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar la potencia'
    });
  }
});

//  * PUT /api/chargers/:id/plug  * Controla el estado del enchufe del cargador  */
// Este endpoint permite a un usuario autenticado activar o desactivar el enchufe de un cargador específico al que tiene acceso.
router.put('/:id/plug', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.id;
  const { is_plugged } = req.body;
  const userId = req.user?.id;

  try {
    // Verificar permisos
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );
    // 🔐 Denegar si el usuario es 'user' (invitado)
    if (access.length === 0 || access[0].access_level === 'user') {
      return res.status(403).json({ success: false, error: 'No tienes permisos para esta acción' });
    }
    // Actualizar estado del enchufe
    const newStatus = is_plugged ? 'charging' : 'standby';
    console.log(`PlugControl - Actualizando cargador ${chargerId} a estado: ${newStatus}`);

    await connectionPool.query(
      'UPDATE chargers SET status = ? WHERE id = ?',
      [newStatus, chargerId]
    );

    console.log(`PlugControl - Estado actualizado correctamente en la base de datos`);

    // Registrar la acción en los logs
    await connectionPool.query(
      'INSERT INTO logs (charger_id, action, description, executed_at) VALUES (?, ?, ?, NOW())',
      [chargerId, is_plugged ? 'plug_in' : 'plug_out', `Usuario ${userId} ${is_plugged ? 'activó' : 'desactivó'} el cargador`]
    );

    res.json({
      success: true,
      message: `Cargador ${is_plugged ? 'activado' : 'desactivado'} correctamente`
    });
  } catch (error) {
    console.error('Error al controlar enchufe:', error);
    res.status(500).json({
      success: false,
      error: 'Error al controlar el enchufe'
    });
  }
});

//**  * POST /api/chargers/:id/schedules  * Agrega una nueva programacion de carga  */
// Este endpoint permite a un usuario autenticado agregar una nueva programacion de carga para un cargador específico al que tiene acceso.
router.post('/:id/schedules', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = Number(req.params.id); // Convertir a número
  const { schedule_name, start_time, end_time, week_days, action, power } = req.body;
  const userId = req.user?.id;
  const userEmail = req.user?.email;

  // Validación
  if (!schedule_name || !start_time || !end_time || !week_days || !action) {
    return res.status(400).json({
      success: false,
      error: 'Faltan datos requeridos'
    });
  }

  try {
    // Obtener nombre del usuario desde la BD
    const [userRows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT CONCAT(COALESCE(first_name, ""), " ", COALESCE(last_name, "")) as user_name, email FROM users WHERE id = ?',
      [userId]
    );

    let userName = 'Sin asignar';
    let finalUserEmail = userEmail;

    if (userRows.length > 0) {
      userName = (userRows[0].user_name || '').trim() || 'Sin asignar';
      finalUserEmail = userRows[0].email || userEmail;
    }

    // Insertar en BD con datos del usuario - Se activa por defecto (is_active = 1)
    const [result] = await connectionPool.query(
      'INSERT INTO charging_schedules (charger_id, schedule_name, start_time, end_time, week_days, action, power, user_id, user_name, user_email, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [chargerId, schedule_name, start_time, end_time, week_days.join(','), action, power || null, userId, userName, finalUserEmail]
    );

    // Enviar notificación de programacion creada
    await notificationService.sendScheduleCreatedNotification(
      chargerId,
      schedule_name,
      start_time,
      end_time
    );

    res.json({
      success: true,
      scheduleId: (result as any).insertId,
      message: 'programacion agregada correctamente'
    });
  } catch (error) {
    console.error('Error al agregar programacion:', error);
    res.status(500).json({
      success: false,
      error: 'Error al agregar programacion'
    });
  }
});

//  * DELETE /api/chargers/:id/schedules/:scheduleId  * Elimina una programacion de carga
// Este endpoint permite a un usuario autenticado eliminar una programacion de carga específica de un cargador al que tiene acceso.
// Requiere autenticación y verifica que el usuario tenga permisos para eliminar la programacion.
// Si el usuario no tiene permisos (por ejemplo, si es un usuario invitado), devuelve un error 403.
// Si la programacion no existe, devuelve un error 404. Si todo es correcto, elimina la programacion de la base de datos y devuelve un mensaje de éxito.
// Este endpoint es útil para que los usuarios puedan gestionar sus programaciones de carga, permitiendo eliminar aquellas que ya no son necesarias o que fueron creadas por error.
// También es un paso importante para mantener la flexibilidad y personalización de las cargas, permitiendo a los usuarios adaptar sus horarios de carga a sus necesidades
router.delete('/:id/schedules/:scheduleId', authenticate, async (req: AuthenticatedRequest, res) => {
  const { id: chargerId, scheduleId } = req.params;
  const userId = req.user?.id;

  try {
    // 1. Verificar que el usuario tiene acceso al cargador
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );
    if (access.length === 0) {
      return res.status(403).json({ success: false, error: 'No tienes acceso a este cargador' });
    }

    // 2. Obtener información de la programación antes de eliminarla
    const [scheduleInfo] = await connectionPool.query<RowDataPacket[]>(
      'SELECT schedule_name, user_id FROM charging_schedules WHERE id = ? AND charger_id = ?',
      [scheduleId, chargerId]
    );

    if (scheduleInfo.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Programación no encontrada'
      });
    }

    // 3. Verificar que el usuario es el CREADOR de la programación
    if (scheduleInfo[0].user_id !== userId && access[0].access_level !== 'owner') {
      return res.status(403).json({ success: false, error: 'Solo el creador puede eliminar esta programación' });
    }

    // 4. Eliminar la programación
    await connectionPool.query(
      'DELETE FROM charging_schedules WHERE id = ? AND charger_id = ?',
      [scheduleId, chargerId]
    );

    // Enviar notificación de programacion eliminada
    await notificationService.sendScheduleDeletedNotification(
      Number(chargerId),
      scheduleInfo[0].schedule_name
    );

    res.json({
      success: true,
      message: 'programacion eliminada correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar programacion:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar programacion'
    });
  }
});

// Scheduling Endpoints de editar una programacion existente
router.put('/:id/schedules/:scheduleId', authenticate, async (req: AuthenticatedRequest, res) => {
  const { id: chargerId, scheduleId } = req.params;
  const { schedule_name, start_time, end_time, week_days, action, power } = req.body;
  const userId = req.user?.id;
  const userEmail = req.user?.email;

  try {
    // 1. Verificar que el usuario tiene acceso al cargador
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );
    if (access.length === 0) {
      return res.status(403).json({ success: false, error: 'No tienes acceso a este cargador' });
    }

    // 2. Verificar que la programación existe y obtener su creador
    const [scheduleData] = await connectionPool.query<RowDataPacket[]>(
      'SELECT user_id FROM charging_schedules WHERE id = ? AND charger_id = ?',
      [scheduleId, chargerId]
    );

    if (scheduleData.length === 0) {
      return res.status(404).json({ success: false, error: 'Programación no encontrada' });
    }

    // 3. Solo el creador puede editar (o el owner del cargador)
    if (scheduleData[0].user_id !== userId && access[0].access_level !== 'owner') {
      return res.status(403).json({ success: false, error: 'Solo el creador puede editar esta programación' });
    }

    // 3. Obtener nombre del usuario desde la BD
    const [userRows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT CONCAT(COALESCE(first_name, ""), " ", COALESCE(last_name, "")) as user_name, email FROM users WHERE id = ?',
      [userId]
    );

    let userName = 'Sin asignar';
    let finalUserEmail = userEmail;

    if (userRows.length > 0) {
      userName = (userRows[0].user_name || '').trim() || 'Sin asignar';
      finalUserEmail = userRows[0].email || userEmail;
    }

    // 4. Actualizar la programacion con datos del usuario
    await connectionPool.query(
      `UPDATE charging_schedules 
       SET schedule_name = ?, start_time = ?, end_time = ?, week_days = ?, action = ?, power = ?, user_id = ?, user_name = ?, user_email = ? 
       WHERE id = ? AND charger_id = ?`,
      [schedule_name, start_time, end_time, week_days.join(','), action, power || null, userId, userName, finalUserEmail, scheduleId, chargerId]
    );

    res.json({
      success: true,
      message: 'Programación actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar programación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar programación'
    });
  }
});

//  * GET /api/chargers/:id/history  * Obtiene el historial de carga de un cargador
// Este endpoint permite a un usuario autenticado obtener el historial de carga de un cargador específico al que tiene acceso.
// Requiere autenticación y verifica que el usuario tenga permisos para acceder al historial.
// Si el usuario no tiene acceso, devuelve un error 403. Si el cargador no existe, devuelve un error 404.
// Si todo es correcto, devuelve un array con las sesiones de carga, incluyendo la fecha de inicio, energía total, duración y costo estimado.
// Este endpoint es útil para que los usuarios puedan revisar el historial de uso de sus cargadores, permitiendo ver cuándo se realizaron cargas, cuánta energía se consumió y el costo estimado de cada sesión.
//// También es un paso importante para que los usuarios puedan analizar su consumo de energía y optimizar sus
// hábitos de carga, ayudando a tomar decisiones más informadas sobre el uso de sus cargadores.
router.get('/:id/history', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.id;
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

    // Obtener historial de carga
    const [sessions] = await connectionPool.query<RowDataPacket[]>(
      `SELECT 
        id, 
        start_time, 
        total_energy, 
        max_power_used,
        duration_seconds, 
        estimated_cost
      FROM charging_sessions 
      WHERE charger_id = ? 
      ORDER BY start_time DESC
      LIMIT 30`,
      [chargerId]
    );

    //console.log('ChargerHistory - Sesiones encontradas:', sessions);

    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial'
    });
  }
});

//  * PUT /api/chargers/:id/lock  * Bloquea o desbloquea un cargador
// Este endpoint permite a un usuario autenticado bloquear o desbloquear un cargador específico al que tiene acceso.
// Requiere autenticación y verifica que el usuario tenga permisos para bloquear el cargador.
// Si el usuario no tiene permisos (por ejemplo, si es un usuario invitado), devuelve un error 403.
// Si el cargador no existe, devuelve un error 404. Si todo es correcto, actualiza el estado del cargador en la base de datos y registra la acción en los logs.
// También notifica a los clientes conectados a través de WebSocket y envía una notificación push al usuario.
// Este endpoint es útil para que los usuarios puedan controlar el acceso a sus cargadores, permitiendo bloquearlos cuando no están en uso o desbloquearlos para permitir el acceso.
// También es un paso importante para la seguridad y gestión de los cargadores, permitiendo a los usuarios tomar decisiones sobre quién puede usar sus cargadores en diferentes momentos.
// Además, al registrar la acción en los logs, se mantiene un historial de las acciones realizadas sobre el cargador, lo que puede ser útil para auditorías o revisiones futuras.
router.put('/:id/lock', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = Number(req.params.id); // Convertir a número
  const { is_locked } = req.body;
  const userId = req.user?.id;

  try {
    // Verificar permisos (solo owner/admin puede bloquear)
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );

    if (access.length === 0 || (access[0].access_level !== 'owner' && access[0].access_level !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para bloquear este cargador'
      });
    }

    // Actualizar estado en la base de datos
    const newStatus = is_locked ? 'locked' : 'standby';
    await connectionPool.query(
      'UPDATE chargers SET status = ? WHERE id = ?',
      [newStatus, chargerId]
    );

    // Registrar acción en los logs
    await connectionPool.query(
      'INSERT INTO logs (charger_id, action, description, executed_at) VALUES (?, ?, ?, NOW())',
      [chargerId, is_locked ? 'lock' : 'unlock', `Usuario ${userId} ${is_locked ? 'bloqueó' : 'desbloqueó'} el cargador`]
    );

    // Notificar a los clientes WebSocket
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      'SELECT network_status FROM chargers WHERE id = ?',
      [chargerId]
    );

    if (charger.length > 0) {
      webSocketServer.notifyStatusChange(
        chargerId,
        newStatus,
        charger[0].network_status
      );
    }

    // Enviar notificación push
    notificationService.sendStatusChangeNotification(chargerId, newStatus);

    res.json({
      success: true,
      message: `Cargador ${is_locked ? 'bloqueado' : 'desbloqueado'} correctamente`
    });
  } catch (error) {
    console.error('Error al bloquear/desbloquear cargador:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar estado de bloqueo'
    });
  }
});

//  * PUT /api/chargers/:id/lighting  * Actualiza la configuración de iluminación de un cargador
// Este endpoint permite a un usuario autenticado actualizar la configuración de iluminación de un cargador específico al que tiene acceso.
// Requiere autenticación y verifica que el usuario tenga permisos para modificar la configuración de iluminación 
router.put('/:id/lighting', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = Number(req.params.id);
  const { lighting } = req.body;
  const userId = req.user?.id;

  try {
    // Verificar permisos (solo owner/admin puede cambiar configuración)
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );

    if (access.length === 0 || access[0].access_level === 'user') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para modificar esta configuración'
      });
    }

    // Validar datos de iluminación
    const validStates = ['standby', 'charging', 'locked'];
    for (const state of validStates) {
      if (!lighting[state] || typeof lighting[state].enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: `Configuración inválida para estado ${state}`
        });
      }
    }

    // Actualizar en base de datos
    await connectionPool.query(
      'UPDATE chargers SET lighting_config = ? WHERE id = ?',
      [JSON.stringify(lighting), chargerId]
    );

    // Enviar comando al dispositivo físico (simulado)
    await sendCommandToDevice(chargerId, 'update_lighting', lighting);

    res.json({
      success: true,
      message: 'Configuración de iluminación actualizada'
    });
  } catch (error) {
    console.error('Error updating lighting:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar configuración de iluminación'
    });
  }
});

// Función para enviar comandos al dispositivo físico (simulado o real)
// Cuando tengas la API o base de datos de los cargadores, adapta la consulta según la estructura real
async function sendCommandToDevice(chargerId: number, command: string, data: any) {
  // 1. Obtener serial_number desde la base principal (charger)
  const [chargerRows] = await connectionPool.query<RowDataPacket[]>(
    'SELECT serial_number FROM chargers WHERE id = ?', [chargerId]
  );
  if (chargerRows.length === 0) throw new Error('Cargador no encontrado');
  const serial = chargerRows[0].serial_number;

  // 2. (Opcional) Consultar en devices_db usando el serial
  // const [deviceRows] = await deviceDbPool.query<RowDataPacket[]>(
  //   'SELECT * FROM devices WHERE serial = ?', [serial]
  // );
  // Aquí puedes adaptar la lógica según la estructura real de tu base de datos de cargadores

  // 3. (Opcional) Lógica para enviar comando real a la API del cargador
  // Ejemplo:
  // await axios.post(`http://ip-o-api-del-cargador/comando`, { command, data });

  // 4. Simulación/log para desarrollo
  console.log(`Enviando comando ${command} al cargador ${chargerId} (serial: ${serial})`, data);

  // 5. (Opcional) Registrar la acción en la base de datos del fabricante
  // if (deviceRows.length > 0) {
  //   await deviceDbPool.query(
  //     `INSERT INTO action_${serial} (action_type, description, executed_at) 
  //      VALUES (?, ?, NOW())`,
  //     [command, JSON.stringify(data)]
  //   );
  // }
}

//  * PUT /api/chargers/:id/charging-mode  * Cambia el modo de carga de un cargador
// Este endpoint permite a un usuario autenticado cambiar el modo de carga de un cargador específico al que tiene acceso.
// Requiere autenticación y verifica que el usuario tenga permisos para cambiar el modo de carga.
// Si el usuario no tiene permisos (por ejemplo, si es un usuario invitado), devuelve un error 403.
// Si el modo de carga no es válido, devuelve un error 400. Si el cargador no existe, devuelve un error 404.
// Si todo es correcto, actualiza el  modo de carga en la base de datos, envía un comando al dispositivo físico (simulado) y devuelve un mensaje de éxito.
// Este endpoint es útil para que los usuarios puedan personalizar la forma en que sus cargadores
router.put('/:id/charging-mode', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.id;
  const { mode } = req.body;
  const userId = req.user?.id;

  const validModes = ['grid', 'solar', 'mixed', 'surplus'];

  try {
    // Verificar permisos (solo owner/admin puede cambiar modo)
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );

    if (access.length === 0 || access[0].access_level === 'user') {
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para cambiar el modo de carga'
      });
    }

    // Validar modo
    if (!validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Modo de carga inválido'
      });
    }

    // Actualizar en base de datos
    await connectionPool.query(
      'UPDATE chargers SET charging_mode = ? WHERE id = ?',
      [mode, chargerId]
    );

    // Enviar comando al dispositivo físico (simulado)
    await sendCommandToDevice(Number(chargerId), 'set_charging_mode', { mode: mode as 'grid' | 'solar' | 'mixed' | 'surplus' });


    res.json({
      success: true,
      message: `Modo de carga cambiado a ${mode}`
    });
  } catch (error) {
    console.error('Error changing charging mode:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cambiar modo de carga'
    });
  }
});



function createAdminPool() {
  throw new Error('Function not implemented.');
}



router.get('/:id/current-session', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.id;
  const userId = req.user?.id;

  try {
    // Verificar acceso
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

    // Obtener serial del cargador
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      'SELECT serial_number FROM chargers WHERE id = ?',
      [chargerId]
    );

    if (charger.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cargador no encontrado'
      });
    }

    // Consultar sesión activa en device_db
    const [currentSession] = await deviceDbPool.query<RowDataPacket[]>(
      `SELECT * FROM charging_log_${charger[0].serial_number} 
       WHERE end_time IS NULL 
       ORDER BY start_time DESC LIMIT 1`
    );

    if (currentSession.length === 0) {
      return res.json({
        success: true,
        isCharging: false
      });
    }

    // Obtener tarifa del usuario
    const [userRate] = await connectionPool.query<RowDataPacket[]>(
      'SELECT rate_per_kwh FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );

    const rate = userRate[0]?.rate_per_kwh || 0.30;
    const sessionData = currentSession[0];
    const duration = Math.floor((new Date().getTime() - new Date(sessionData.start_time).getTime()) / 1000);

    res.json({
      success: true,
      isCharging: true,
      data: {
        startTime: sessionData.start_time,
        energy: sessionData.energy_kwh || 0,
        power: sessionData.power_peak || 0,
        duration,
        cost: (sessionData.energy_kwh || 0) * rate
      }
    });
  } catch (error) {
    console.error('Error getting current session:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener sesión actual'
    });
  }
});


//  * POST /api/chargers/:id/start-session  * Inicia una sesión de carga en un cargador específico
// Este endpoint permite a un usuario autenticado iniciar una sesión de carga en un cargador específico
// al que tiene acceso. Requiere autenticación y verifica que el usuario tenga permisos para
// iniciar una sesión de carga. Si el usuario no tiene acceso, devuelve un error 403. Si el cargador
// no está disponible (por ejemplo, si está ocupado o offline), devuelve un error 409
router.post('/:id/start-session', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = Number(req.params.id);
  const userId = req.user?.id;
  const { paymentMethodId } = req.body;

  if (!paymentMethodId) {
    return res.status(400).json({
      success: false,
      error: 'Método de pago requerido'
    });
  }

  try {
    // 1. Verificar permisos y obtener tarifa
    const [access] = await connectionPool.query<RowDataPacket[]>(
      `SELECT access_level, rate_per_kwh 
       FROM charger_users 
       WHERE charger_id = ? AND user_id = ?`,
      [chargerId, userId]
    );

    if (access.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No tienes acceso a este cargador'
      });
    }

    const ratePerKwh = access[0].rate_per_kwh;
    if (!ratePerKwh || isNaN(ratePerKwh)) {
      return res.status(400).json({
        success: false,
        error: 'Tarifa no configurada para este cargador'
      });
    }

    // 2. Verificar estado del cargador
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      `SELECT status, network_status, serial_number 
       FROM chargers 
       WHERE id = ?`,
      [chargerId]
    );

    if (charger.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cargador no encontrado'
      });
    }

    if (charger[0].status !== 'standby') {
      return res.status(409).json({
        success: false,
        error: 'El cargador no está disponible'
      });
    }

    if (charger[0].network_status !== 'online') {
      return res.status(503).json({
        success: false,
        error: 'El cargador está offline'
      });
    }

    // 3. Validar método de pago
    const isValid = await paymentService.validatePaymentMethod(userId as number, paymentMethodId);
    if (!isValid) {
      return res.status(402).json({
        success: false,
        error: 'Método de pago inválido'
      });
    }

    // 4. Crear sesión en ambas bases de datos (transaccional)
    const conn = await connectionPool.getConnection();
    try {
      await conn.beginTransaction();

      // Crear en charging_sessions
      const [sessionResult] = await conn.query(
        `INSERT INTO charging_sessions 
         (charger_id, user_id, start_time, charging_mode, payment_method_id, rate_per_kwh) 
         VALUES (?, ?, NOW(), 'grid', ?, ?)`,
        [chargerId, userId, paymentMethodId, ratePerKwh]
      );
      const sessionId = (sessionResult as any).insertId.toString();

      // Crear en charging_log_XXX del dispositivo
      await deviceDbPool.query(
        `INSERT INTO charging_log_${charger[0].serial_number} 
         (start_time, rate_per_kwh) 
         VALUES (NOW(), ?)`,
        [ratePerKwh]
      );

      // 5. Enviar comando al cargador físico
      await sendCommandToDevice(chargerId, 'start_charging', {
        max_power: 7000,
        rate_per_kwh: ratePerKwh
      });

      // 6. Actualizar estado del cargador
      await conn.query(
        `UPDATE chargers 
         SET status = 'charging' 
         WHERE id = ?`,
        [chargerId]
      );

      // 7. Registrar en logs
      await conn.query(
        `INSERT INTO logs 
         (charger_id, action, description) 
         VALUES (?, ?, ?)`,
        [chargerId, 'start_charging', `Usuario ${userId} inició sesión (Tarifa: ${ratePerKwh}/kWh)`]
      );

      await conn.commit();

      // 8. Notificar por WebSocket
      webSocketServer.notifyStatusChange(chargerId, 'charging', 'online', {
        ratePerKwh
      });

      // 9. Enviar notificación de carga iniciada
      const [userInfo] = await connectionPool.query<RowDataPacket[]>(
        'SELECT name FROM users WHERE id = ?',
        [userId]
      );
      const userName = userInfo[0]?.name || 'Usuario';
      await notificationService.sendManualChargingStartedNotification(chargerId, userName);

      res.json({
        success: true,
        sessionId,
        ratePerKwh,
        message: 'Sesión de carga iniciada'
      });

    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

  } catch (error) {
    console.error('Error al iniciar sesión de carga:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno al iniciar carga'
    });
  }
});


// //  * POST /api/chargers/:id/sessions/:id/stop  * Detiene una sesión de carga activa en un cargador específico
// Este endpoint permite a un usuario autenticado detener una sesión de carga activa en un cargador
// específico al que tiene acceso. Requiere autenticación y verifica que el usuario tenga permisos
// para detener la sesión. Si el usuario no tiene acceso, devuelve un error 403. Si la sesión no existe
// o no está activa, devuelve un error 404. Si todo es correcto, detiene la sesión de carga, actualiza la base de datos con los datos de consumo y duración, y
// envía un comando al dispositivo físico para detener la carga. También actualiza el estado del cargador a "standby" y registra la acción en los logs.
// Finalmente, notifica a los clientes conectados a través de WebSocket sobre el cambio de estado del cargador.
// Este endpoint  es útil para que los usuarios puedan finalizar sus sesiones de carga de manera controlada,
// permitiendo detener la carga cuando ya no es necesaria o cuando se ha alcanzado el nivel de carga deseado.
// También es un paso importante para la gestión eficiente de la energía, permitiendo a los usuarios optimizar su consumo y costos asociados a la carga de sus vehículos eléctricos.
router.post('/sessions/:id/stop', authenticate, async (req: AuthenticatedRequest, res) => {
  const sessionId = req.params.id;
  const userId = req.user?.id;

  try {
    console.log(`[STOP-LOG] Iniciando detención para sesión: ${sessionId}, por usuario: ${userId}`);
    // 1. Obtener información de la sesión
    const [session] = await connectionPool.query<RowDataPacket[]>(
      `SELECT 
         cs.id, 
         cs.charger_id, 
         cs.start_time, 
         cs.user_id,
         c.serial_number
       FROM charging_sessions cs
       JOIN chargers c ON cs.charger_id = c.id
       WHERE cs.id = ? AND cs.end_time IS NULL`,
      [sessionId]
    );

    if (session.length === 0) {
      console.error(`[STOP-LOG] Error: Sesión activa ${sessionId} no encontrada.`);
      return res.status(404).json({
        success: false,
        error: 'Sesión activa no encontrada'
      });
    }

    // 2. Verificar permisos (solo el usuario que inició puede detener)
    if (session[0].user_id !== userId) {
      console.error(`[STOP-LOG] Error: Usuario ${userId} no tiene permisos para sesión ${sessionId}.`);
      return res.status(403).json({
        success: false,
        error: 'No tienes permisos para esta acción'
      });
    }

    const chargerId = session[0].charger_id;
    const serialNumber = session[0].serial_number;

    console.log(`[STOP-LOG] Sesión encontrada. Cargador ID: ${chargerId}, Serial: ${serialNumber}`);
    // 3. Obtener datos de consumo del dispositivo físico
    const [chargingData] = await deviceDbPool.query<RowDataPacket[]>(
      `SELECT 
         energy_kwh, 
         power_peak 
       FROM charging_log_${serialNumber} 
       WHERE end_time IS NULL 
       ORDER BY start_time DESC LIMIT 1`
    );

    if (chargingData.length === 0) {
      console.error(`[STOP-LOG] Error: No se encontraron datos en charging_log_${serialNumber} con end_time IS NULL.`);
      return res.status(404).json({
        success: false,
        error: 'Datos de carga no encontrados'
      });
    }

    // 4. Calcular duración y costo
    console.log(`[STOP-LOG] Datos de consumo obtenidos:`, chargingData[0]);
    const startTime = new Date(session[0].start_time);
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    const energyConsumed = chargingData[0].energy_kwh || 0;

    const [rateRow] = await connectionPool.query<RowDataPacket[]>(
      `SELECT rate_per_kwh 
       FROM charger_users 
       WHERE charger_id = ? AND user_id = ?`,
      [chargerId, userId]
    );

    const ratePerKwh = rateRow[0]?.rate_per_kwh;
    const totalCost = energyConsumed * ratePerKwh;

    // 5. Actualizar sesión en la base de datos
    console.log(`[STOP-LOG] Actualizando charging_sessions (DB principal)...`);
    await connectionPool.query(
      `UPDATE charging_sessions 
       SET 
         end_time = ?,
         total_energy = ?,
         duration_seconds = ?,
         estimated_cost = ?
       WHERE id = ?`,
      [endTime, energyConsumed, durationSeconds, totalCost, sessionId]
    );

    console.log(`[STOP-LOG] Actualizando charging_log_${serialNumber} (DB dispositivo)...`);
    // 5.1. Actualizar sesión en la base de datos del dispositivo (¡ESTE ES EL PASO QUE FALTABA!)
    const [deviceLogResult] = await deviceDbPool.query<ResultSetHeader>(
      `UPDATE \`charging_log_${serialNumber}\`
       SET 
         end_time = ?,
         energy_kwh = ?,
         power_peak = ?
       WHERE end_time IS NULL
       ORDER BY start_time DESC LIMIT 1`,
      [endTime, energyConsumed, chargingData[0].power_peak || 0]
    );

    console.log(`[STOP-LOG] Resultado de la actualización en charging_log: Filas afectadas: ${deviceLogResult.affectedRows}`);

    // 6. Enviar comando al cargador físico (simulado)
    await sendCommandToDevice(chargerId, 'stop_charging', {});

    // 7. Actualizar estado del cargador
    await connectionPool.query(
      `UPDATE chargers 
       SET status = 'standby' 
       WHERE id = ?`,
      [chargerId]
    );

    // 8. Registrar en logs
    await connectionPool.query(
      `INSERT INTO logs 
       (charger_id, action, description) 
       VALUES (?, ?, ?)`,
      [chargerId, 'stop_charging', `Usuario ${userId} detuvo sesión de carga`]
    );

    // 9. Notificar por WebSocket
    webSocketServer.notifyStatusChange(chargerId, 'standby', 'online');

    // 10. Enviar notificación de carga finalizada
    const [userInfo] = await connectionPool.query<RowDataPacket[]>(
      'SELECT name FROM users WHERE id = ?',
      [userId]
    );
    const userName = userInfo[0]?.name || 'Usuario';
    await notificationService.sendChargingStoppedNotification(
      chargerId,
      userName,
      energyConsumed,
      totalCost,
      durationSeconds
    );

    res.json({
      success: true,
      totalEnergy: energyConsumed,
      totalCost,
      duration: durationSeconds,
      message: 'Carga detenida correctamente'
    });

  } catch (error) {
    console.error('[STOP-LOG] Error DETALLADO en el bloque catch:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno al detener carga'
    });
  }
});

//
//  * GET /api/chargers/:id/monthly-energy  * Obtiene el consumo mensual de un cargador específico

router.get('/:id/monthly-energy', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.id;
  const userId = req.user?.id;
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

  try {
    // Verificar acceso al cargador
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT 1 FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );

    if (access.length === 0) {
      return res.status(403).json({ success: false, error: 'No tienes acceso a este cargador' });
    }

    // Obtener consumo mensual
    const [energyData] = await connectionPool.query<RowDataPacket[]>(
      `SELECT SUM(total_energy) as monthly_energy 
             FROM charging_sessions 
             WHERE charger_id = ? 
             AND user_id = ?
             AND start_time >= ?`,
      [chargerId, userId, firstDayOfMonth]
    );

    res.json({
      success: true,
      monthly_energy: energyData[0].monthly_energy || 0
    });
  } catch (error) {
    console.error('Error al obtener consumo mensual:', error);
    res.status(500).json({ success: false, error: 'Error al obtener consumo mensual' });
  }
});

// GET /api/chargers/:id/energy-settings
router.get('/:id/energy-settings', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.id;
  const userId = req.user?.id;
  try {
    const [chargerRows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT charging_mode, serial_number FROM chargers WHERE id = ?', [chargerId]
    );
    if (chargerRows.length === 0) {
      return res.status(404).json({ error: 'Cargador no encontrado' });
    }
    const serial = chargerRows[0].serial_number;
    const [userRows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT rate_per_kwh FROM charger_users WHERE charger_id = ? AND user_id = ?', [chargerId, userId]
    );
    // Obtener precios por modo de administracion.pricing_devices
    const [priceRows] = await deviceDbPool.query<RowDataPacket[]>(
      'SELECT base_price_per_kwh, price_grid, price_solar, price_mixed, price_surplus FROM administracion.pricing_devices WHERE serial_number = ?', [serial]
    );
    res.json({
      charging_mode: chargerRows[0].charging_mode,
      rate_per_kwh: userRows[0]?.rate_per_kwh || null,
      prices: priceRows[0] || {}
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración energética' });
  }
});

// Opciones de fábrica
// --- RESET ---
router.post('/:chargerId/factory/reset', authenticate, async (req, res) => {
  const chargerId = req.params.chargerId;
  try {
    // Lógica real: poner el estado en 'standby' y actualizar last_updated
    await connectionPool.query(
      'UPDATE chargers SET status = ?, last_updated = NOW() WHERE id = ?',
      ['standby', chargerId]
    );
    res.json({ ok: true, message: 'Cargador reiniciado correctamente' });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error al reiniciar cargador' });
  }
  // Mock para pruebas:
  // res.json({ ok: true, message: 'Cargador reiniciado (mock)' });
});

// --- RESTORE ---
router.post('/:chargerId/factory/restore', authenticate, async (req, res) => {
  const chargerId = req.params.chargerId;
  try {
    // Lógica real: restaurar valores por defecto (ajusta según tus defaults)
    await connectionPool.query(
      'UPDATE chargers SET name = ?, max_power = 32, status = ?, last_updated = NOW() WHERE id = ?',
      ['Cargador', 'standby', chargerId]
    );
    res.json({ ok: true, message: 'Cargador restaurado a valores de fábrica correctamente' });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error al restaurar cargador' });
  }
  // Mock para pruebas:
  // res.json({ ok: true, message: 'Cargador restaurado a valores de fábrica (mock)' });
});


// GET /api/chargers/:chargerId/ping - Verifica el estado de conexión y energía de un cargador
router.get('/:chargerId/ping', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.chargerId;
  const userId = req.user?.id;

  try {
    // 1. Verificar acceso al cargador
    const [access] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );

    if (access.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'No tienes acceso a este cargador'
      });
    }

    // 2. Obtener información del cargador
    const [charger] = await connectionPool.query<RowDataPacket[]>(
      `SELECT 
        c.id,
        c.status,
        c.network_status,
        c.last_updated,
        pd.status as device_status,
        pd.executed_at as device_last_update
      FROM chargers c
      LEFT JOIN (
        SELECT pd1.* 
        FROM primary_devices pd1
        INNER JOIN (
          SELECT id_device, MAX(executed_at) as max_executed_at
          FROM primary_devices
          GROUP BY id_device
        ) pd2 ON pd1.id_device = pd2.id_device AND pd1.executed_at = pd2.max_executed_at
      ) pd ON pd.id_device = c.id
      WHERE c.id = ?`,
      [chargerId]
    );

    if (charger.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cargador no encontrado'
      });
    }

    // 3. Verificar última actualización
    const now = new Date();
    const lastUpdate = new Date(charger[0].last_updated);
    const deviceLastUpdate = charger[0].device_last_update ? new Date(charger[0].device_last_update) : null;
    const timeThreshold = 15000; // 15 segundos

    // Usar la actualización más reciente entre last_updated y device_last_update
    const mostRecentUpdate = deviceLastUpdate && deviceLastUpdate > lastUpdate ? deviceLastUpdate : lastUpdate;
    const timeDiff = now.getTime() - mostRecentUpdate.getTime();

    // 4. Determinar estado actual
    const isAlive = timeDiff < timeThreshold;
    const powerState = isAlive &&
      (charger[0].device_status === 'on' ||
        charger[0].status !== 'powered_off') ? 'on' : 'off';

    // 5. Actualizar estado en la base de datos si ha cambiado
    if (!isAlive && charger[0].network_status === 'online') {
      await connectionPool.query(
        'UPDATE chargers SET network_status = ?, status = ? WHERE id = ?',
        ['offline', 'powered_off', chargerId]
      );

      // Notificar cambio de estado por WebSocket
      webSocketServer.notifyStatusChange(
        Number(chargerId),
        'powered_off',
        'offline'
      );
    }

    res.json({
      success: true,
      isAlive,
      powerState,
      networkStatus: isAlive ? 'online' : 'offline',
      lastUpdate: mostRecentUpdate.toISOString()
    });

  } catch (error) {
    console.error('Error al hacer ping al cargador:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno al verificar estado del cargador'
    });
  }
});

// --- UNLINK ---
router.post('/:chargerId/factory/unlink', authenticate, async (req: AuthenticatedRequest, res) => {
  const chargerId = req.params.chargerId;
  if (!req.user || !req.user.id) {
    console.log('[UNLINK] Usuario no autenticado');
    return res.status(401).json({ ok: false, message: 'Usuario no autenticado' });
  }
  const userId = req.user.id;
  console.log(`[UNLINK] Intentando desvincular cargador ${chargerId} para usuario ${userId}`);
  try {
    // Verificar si existe la relación antes de eliminar
    const [exists] = await connectionPool.query<RowDataPacket[]>(
      'SELECT * FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );
    console.log(`[UNLINK] Relación charger_users encontrada:`, exists);
    if (exists.length === 0) {
      console.log(`[UNLINK] No existe relación charger_users para chargerId=${chargerId} y userId=${userId}`);
      return res.status(404).json({ ok: false, message: 'No existe relación para desvincular' });
    }
    // Eliminar la relación
    const [result] = await connectionPool.query(
      'DELETE FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );
    console.log(`[UNLINK] DELETE charger_users result:`, result);
    // Verificar si quedan usuarios
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM charger_users WHERE charger_id = ?',
      [chargerId]
    );
    console.log(`[UNLINK] Usuarios restantes para cargador ${chargerId}:`, rows[0]);
    if ((rows[0] as any).count === 0) {
      const [delResult] = await connectionPool.query('DELETE FROM chargers WHERE id = ?', [chargerId]);
      console.log(`[UNLINK] Cargador ${chargerId} eliminado porque no quedan usuarios. Resultado:`, delResult);
    }
    res.json({ ok: true, message: 'Cargador desvinculado correctamente' });
  } catch (err) {
    console.error('[UNLINK] Error al desvincular cargador:', err);
    res.status(500).json({ ok: false, message: 'Error al desvincular cargador', details: err instanceof Error ? err.message : String(err) });
  }
});



// Endpoint para actualizar el precio de un invitado (multiusuario)
router.put('/:chargerId/users/:userId/price', authenticate, async (req, res) => {
  const chargerId = req.params.chargerId;
  const userId = req.params.userId;
  const { rate_per_kwh } = req.body;
  try {
    // Obtener serial del cargador
    const [chargerRows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT serial_number FROM chargers WHERE id = ?', [chargerId]
    );
    if (chargerRows.length === 0) {
      return res.status(404).json({ error: 'Cargador no encontrado' });
    }
    const serial = chargerRows[0].serial_number;
    // Verificar si el userId es owner para este cargador
    const [userRows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?',
      [chargerId, userId]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado para este cargador' });
    }
    if (userRows[0].access_level === 'owner') {
      return res.status(403).json({ error: 'El propietario no puede cambiar su propio precio. Solo el administrador puede modificar el precio base.' });
    }
    // Obtener precio base de administracion.pricing_devices
    const [baseRows] = await deviceDbPool.query<RowDataPacket[]>(
      'SELECT base_price_per_kwh FROM administracion.pricing_devices WHERE serial_number = ?',
      [serial]
    );
    const basePrice = baseRows[0]?.base_price_per_kwh || 0.30;
    if (rate_per_kwh < basePrice) {
      return res.status(400).json({ error: 'El precio no puede ser menor al precio base de administración' });
    }
    // Actualizar precio
    await connectionPool.query(
      'UPDATE charger_users SET rate_per_kwh = ? WHERE charger_id = ? AND user_id = ?',
      [rate_per_kwh, chargerId, userId]
    );
    res.json({ success: true, message: 'Precio actualizado correctamente' });
  } catch (error) {
    console.error('Error actualizando precio de invitado:', error);
    res.status(500).json({ error: 'Error al actualizar precio de invitado' });
  }
});

// (Opcional) Lógica para actualizar precios de usuarios si el base sube:
// Puedes crear un script o endpoint que recorra charger_users y suba los precios por debajo del nuevo mínimo.
// Ejemplo:
// router.post('/update-prices-to-base', async (req, res) => {
//   const [devices] = await deviceDbPool.query<RowDataPacket[]>('SELECT serial_number, base_price_per_kwh FROM administracion.pricing_devices');
//   for (const device of devices) {
//     await connectionPool.query(
//       'UPDATE charger_users cu JOIN chargers c ON cu.charger_id = c.id SET cu.rate_per_kwh = ? WHERE c.serial_number = ? AND cu.rate_per_kwh < ?',
//       [device.base_price_per_kwh, device.serial_number, device.base_price_per_kwh]
//     );
//   }
//   res.json({ success: true, message: 'Precios actualizados al mínimo base donde era necesario' });
// });


// Función para enviar comandos al dispositivo físico (simulado o real)
// Cuando tengas la API o base de datos de los cargadores, adapta la consulta según la estructura real
//async function sendCommandToDevice(chargerId: number, command: string, data: any) {
// 1. Obtener serial_number desde la base principal (charger)
// const [chargerRows] = await connectionPool.query<RowDataPacket[]>(
//   'SELECT serial_number FROM chargers WHERE id = ?', [chargerId]
// );
//  if (chargerRows.length === 0) throw new Error('Cargador no encontrado');
//  const serial = chargerRows[0].serial_number;

// 2. (Opcional) Consultar en devices_db usando el serial
// const [deviceRows] = await deviceDbPool.query<RowDataPacket[]>(
//   'SELECT * FROM devices WHERE serial = ?', [serial]
// );
// Aquí puedes adaptar la lógica según la estructura real de tu base de datos de cargadores

// 3. (Opcional) Lógica para enviar comando real a la API del cargador
// Ejemplo:
// await axios.post(`http://ip-o-api-del-cargador/comando`, { command, data });

// 4. Simulación/log para desarrollo
// console.log(`Enviando comando ${command} al cargador ${chargerId} (serial: ${serial})`, data);

// 5. (Opcional) Registrar la acción en la base de datos del fabricante
// if (deviceRows.length > 0) {
//   await deviceDbPool.query(
//     `INSERT INTO action_${serial} (action_type, description, executed_at) 
//      VALUES (?, ?, NOW())`,
//     [command, JSON.stringify(data)]
//   );
// }
//}

// NOTA: El modo por defecto en la columna charging_mode es 'grid' (red). Si quieres cambiarlo, edita el DEFAULT en el ALTER TABLE:
// ALTER TABLE chargers ADD COLUMN charging_mode ENUM('grid','solar','mixed','surplus') NOT NULL DEFAULT 'grid';

// Obtener precios por modo para un cargador
router.get('/pricing/:serial_number', async (req, res) => {
  const { serial_number } = req.params;
  try {
    const [rows] = await deviceDbPool.query(
      `SELECT base_price_per_kwh, price_grid, price_solar, price_mixed, price_surplus FROM administracion.pricing_devices WHERE serial_number = ?`,
      [serial_number]
    ) as any[];
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Cargador no encontrado' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los precios' });
  }
});

// Nueva ruta para actualizar el tipo de uso de un cargador
// PUT /api/chargers/:id/usage-type * Actualiza el tipo de uso de un cargador (payment o home)  * Este endpoint permite a un usuario autenticado actualizar el tipo de uso de un cargador específico al que tiene acceso.
// Requiere autenticación y verifica que el usuario tenga permisos para actualizar el tipo de uso.
// Si el usuario no tiene permisos, devuelve un error 403. Si el tipo de uso no es válido, devuelve un error 400.
// Si el cargador no existe o no pertenece al usuario, devuelve un error 404. Si todo es correcto, actualiza el tipo de uso en la base de datos y devuelve un mensaje de éxito.
router.put('/:id/usage-type', authenticate, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
  }

  const { id } = req.params;
  const { usage_type } = req.body;

  // Validar que usage_type sea uno de los valores permitidos
  if (!['payment', 'home'].includes(usage_type)) {
    return res.status(400).json({ success: false, error: 'Tipo de uso inválido' });
  }

  let conn;
  try {
    conn = await connectionPool.getConnection();

    // Verificar que el cargador pertenece al usuario
    const [chargerRows] = await conn.query<RowDataPacket[]>(
      `SELECT c.id FROM chargers c 
       JOIN charger_users cu ON c.id = cu.charger_id 
       WHERE c.id = ? AND cu.user_id = ?`,
      [id, req.user.id]
    );

    if (chargerRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cargador no encontrado o no autorizado' });
    }

    // Actualizar el tipo de uso
    await conn.query(
      'UPDATE chargers SET usage_type = ? WHERE id = ?',
      [usage_type, id]
    );

    res.json({ success: true, message: 'Tipo de uso actualizado correctamente' });
  } catch (error) {
    console.error('Error actualizando tipo de uso:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  } finally {
    if (conn) conn.release();
  }
});




router.get('/api/ocpp-servers', async (req, res) => {
  try {
    const [servers] = await deviceDbPool.query('SELECT * FROM ocpp_servers ORDER BY name');
    res.json(servers);
  } catch (error) {
    console.error('Error fetching OCPP servers:', error);
    res.status(500).json({ error: 'Error al cargar servidores OCPP' });
  }
});

// ⚡ Endpoint interno para ejecutar programaciones (llamado por cron job del servidor)
// NO requiere autenticación porque es llamado internamente
router.post('/execute-schedules-cron', async (req, res) => {
  const executionTime = new Date().toISOString();
  console.log(`[ExecuteSchedules] ⏰ Iniciando verificación de programaciones a ${executionTime}`);

  try {
    const now = new Date();
    const today = now.getDay(); // 0=Dom, 1=Lun, 2=Mar...
    const dayMap = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const todayName = dayMap[today];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    console.log(`[ExecuteSchedules] 📅 Día actual: ${todayName}, Hora actual: ${timeString}`);

    // 1. Obtener todas las programaciones activas
    const [schedules] = await connectionPool.query<RowDataPacket[]>(
      `SELECT cs.*, c.serial_number, c.id as charger_id 
       FROM charging_schedules cs
       JOIN chargers c ON cs.charger_id = c.id
       WHERE cs.is_active = 1 AND cs.status != 'completed'
       ORDER BY cs.charger_id`
    );

    console.log(`[ExecuteSchedules] 📋 Se encontraron ${schedules.length} programaciones activas`);

    if (schedules.length === 0) {
      return res.json({
        success: true,
        message: 'Verificación completada: No hay programaciones para ejecutar',
        executed: 0,
        errors: 0,
        timestamp: executionTime
      });
    }

    let executed = 0;
    let errors = 0;

    // 2. Procesar cada programación
    for (const schedule of schedules) {
      try {
        const days = (schedule.week_days || '').split(',').map((d: string) => d.trim());

        // Verificar si es hoy
        if (!days.includes(todayName)) {
          continue;
        }

        // Verificar si es la hora (con tolerancia de 1 minuto)
        const [startHours, startMinutes] = (schedule.start_time || '').split(':');
        const scheduleStartMinutes = parseInt(startHours) * 60 + parseInt(startMinutes);

        if (Math.abs(currentMinutes - scheduleStartMinutes) <= 1 && schedule.status !== 'active') {
          console.log(`[ExecuteSchedules] ⚡ Ejecutando programación #${schedule.id} - ${schedule.schedule_name} en cargador ${schedule.charger_id}`);

          // 3. Cambiar estado a activo
          await connectionPool.query(
            'UPDATE charging_schedules SET status = ?, session_start_time = NOW() WHERE id = ?',
            ['active', schedule.id]
          );

          // 4. Llamar a remoteStartOcppCharging (si existe el usuario)
          if (schedule.user_id && schedule.serial_number) {
            try {
              // Importar la función de charger service
              const { remoteStartOcppCharging } = require('../../services/chargerService');
              const response = await remoteStartOcppCharging(schedule.serial_number, schedule.user_id);

              if (response?.success) {
                console.log(`[ExecuteSchedules] ✅ Carga iniciada para #${schedule.id}`);
                executed++;

                // 5. Enviar notificación al usuario
                if (notificationService && notificationService.sendNotification) {
                  try {
                    notificationService.sendNotification({
                      userId: schedule.user_id,
                      title: 'Carga Iniciada',
                      body: `${schedule.schedule_name} se ha iniciado automáticamente`,
                      data: {
                        chargerId: schedule.charger_id.toString(),
                        scheduleId: schedule.id.toString(),
                        type: 'schedule_started'
                      }
                    });
                  } catch (notifError: any) {
                    console.log('[ExecuteSchedules] Notificación fallida:', notifError?.message);
                  }
                }
              } else {
                console.error(`[ExecuteSchedules] ❌ Error al iniciar carga: ${response?.error}`);
                errors++;
              }
            } catch (ocppError) {
              console.error(`[ExecuteSchedules] Error OCPP para #${schedule.id}:`, ocppError);
              errors++;
            }
          }
        }
      } catch (scheduleError) {
        console.error(`[ExecuteSchedules] Error procesando programación #${schedule.id}:`, scheduleError);
        errors++;
      }
    }

    res.json({
      success: true,
      message: `Verificación completada: ${executed} ejecutadas, ${errors} errores`,
      executed,
      errors,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[ExecuteSchedules] Error general:', error);
    res.status(500).json({
      success: false,
      error: 'Error al ejecutar programaciones',
      details: error instanceof Error ? error.message : 'Desconocido'
    });
  }
});

export default router;

