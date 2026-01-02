"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncChargerData = syncChargerData;
exports.getAllDeviceSerials = getAllDeviceSerials;
exports.syncAllDevices = syncAllDevices;
const deviceDb_config_1 = require("../config/deviceDb.config");
const db_config_1 = require("../config/db.config");
/**
 * Buscar el ID del cargador en la base principal por serial
 */
async function getChargerIdBySerial(serial) {
    const conn = await db_config_1.connectionPool.getConnection();
    try {
        const [rows] = await conn.query('SELECT id FROM chargers WHERE serial_number = ?', [serial]);
        if (rows.length > 0)
            return rows[0].id;
        return null;
    }
    catch (err) {
        console.error(`❌ Error buscando charger_id para ${serial}:`, err);
        return null;
    }
    finally {
        conn.release();
    }
}
/**
 * Sincronizar datos de carga y acciones de un cargador (por serial)
 */
async function syncChargerData(serial) {
    const logTable = `charging_log_${serial}`;
    const actionTable = `action_${serial}`;
    // 🔎 Obtener charger_id real desde tu base principal
    const chargerId = await getChargerIdBySerial(serial);
    if (!chargerId) {
        console.warn(`⚠️ El cargador con serial ${serial} no está registrado en la base principal`);
        return;
    }
    const connDevice = await deviceDb_config_1.deviceDbPool.getConnection();
    const connMain = await db_config_1.connectionPool.getConnection();
    try {
        // 🔄 Obtener registros de carga del equipo
        const [logRows] = await connDevice.query(`SELECT * FROM \`${logTable}\``);
        for (const log of logRows) {
            const start = new Date(log.start_time);
            const end = new Date(log.end_time);
            const duration = (end.getTime() - start.getTime()) / 1000;
            await connMain.query(`INSERT INTO charging_sessions 
         (charger_id, user_id, start_time, end_time, total_energy, duration_seconds, estimated_cost, charging_mode, max_power_used)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                chargerId,
                1, // TODO: Cambiar por user_id real si lo tienes
                log.start_time,
                log.end_time,
                log.energy_kwh,
                duration,
                0, // calcular tarifa luego
                'grid',
                log.power_peak
            ]);
        }
        // 🔄 Obtener acciones del equipo
        const [actionRows] = await connDevice.query(`SELECT * FROM \`${actionTable}\``);
        for (const act of actionRows) {
            await connMain.query(`INSERT INTO charger_logs (charger_id, action, description, executed_at)
         VALUES (?, ?, ?, ?)`, [
                chargerId,
                act.action_type,
                act.description,
                act.executed_at
            ]);
        }
        // 🔄 Sincronizar estados de primary_devices
        // Obtener el último estado de la tabla de acciones del dispositivo
        const [lastActionRows] = await connDevice.query(`SELECT * FROM \`${actionTable}\` ORDER BY executed_at DESC LIMIT 1`);
        // Si hay un estado, actualizar primary_devices
        if (lastActionRows.length > 0) {
            const lastActionRow = lastActionRows[0];
            if (lastActionRow.status !== undefined) {
                // Verificar si ya existe un registro con el mismo estado y timestamp reciente
                const [existingRow] = await connMain.query(`SELECT id FROM primary_devices 
           WHERE id_device = ? AND status = ? 
           AND executed_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
           ORDER BY executed_at DESC LIMIT 1`, [chargerId, lastActionRow.status]);
                // Solo insertar si no existe un registro reciente con el mismo estado
                if (existingRow.length === 0) {
                    await connMain.query(`INSERT INTO primary_devices (action_type, id_user, id_device, description, status, executed_at) 
             VALUES (?, ?, ?, ?, ?, ?)`, [
                        lastActionRow.action_type,
                        lastActionRow.id_user,
                        lastActionRow.id_device,
                        lastActionRow.description,
                        lastActionRow.status,
                        lastActionRow.executed_at
                    ]);
                    console.log(`✔ Estado sincronizado para dispositivo ${serial}: ${lastActionRow.status}`);
                }
            }
        }
        console.log(`✔ Dispositivo ${serial} sincronizado correctamente`);
    }
    catch (err) {
        console.error(`❌ Error al sincronizar ${serial}:`, err);
    }
    finally {
        connDevice.release();
        connMain.release();
    }
}
/**
 * Obtener todos los seriales de la base de datos de dispositivos
 */
async function getAllDeviceSerials() {
    const conn = await deviceDb_config_1.deviceDbPool.getConnection();
    try {
        const [rows] = await conn.query('SELECT serial FROM devices');
        return rows.map((row) => row.serial);
    }
    catch (err) {
        console.error('❌ Error obteniendo seriales:', err);
        return [];
    }
    finally {
        conn.release();
    }
}
/**
 * Ejecutar sincronización de todos los dispositivos
 */
async function syncAllDevices() {
    const serials = await getAllDeviceSerials();
    console.log(`🔄 Sincronizando ${serials.length} dispositivos...`);
    for (const serial of serials) {
        await syncChargerData(serial);
    }
    console.log('✅ Sincronización de todos los dispositivos completada');
}
