"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncDeviceStatus = syncDeviceStatus;
exports.syncAllDeviceStatuses = syncAllDeviceStatuses;
const deviceDb_config_1 = require("../config/deviceDb.config");
const db_config_1 = require("../config/db.config");
// Función para obtener el ID del cargador en la base de datos principal
async function getChargerIdBySerial(serial) {
    const [rows] = await db_config_1.connectionPool.query('SELECT id FROM chargers WHERE serial_number = ?', [serial]);
    if (rows.length > 0) {
        return rows[0].id;
    }
    return null;
}
// Función para sincronizar el estado más reciente de un dispositivo
async function syncDeviceStatus(serial) {
    try {
        // Obtener el ID del cargador
        const chargerId = await getChargerIdBySerial(serial);
        if (!chargerId) {
            console.warn(`No se encontró el cargador con serial ${serial} en la base de datos principal`);
            return;
        }
        // Nombre de la tabla de acciones para este dispositivo
        const actionTable = `action_${serial}`;
        // Obtener el último estado de la tabla de acciones del dispositivo
        const [lastActionRows] = await deviceDb_config_1.deviceDbPool.query(`SELECT * FROM \`${actionTable}\` ORDER BY executed_at DESC LIMIT 1`);
        // Si hay un estado, actualizar primary_devices
        if (lastActionRows.length > 0) {
            const lastActionRow = lastActionRows[0];
            // Verificar si ya existe un registro con el mismo estado y timestamp reciente
            const [existingRow] = await db_config_1.connectionPool.query(`SELECT id FROM primary_devices 
         WHERE id_device = ? AND status = ? 
         AND executed_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
         ORDER BY executed_at DESC LIMIT 1`, [chargerId, lastActionRow.status]);
            // Solo insertar si no existe un registro reciente con el mismo estado
            if (existingRow.length === 0) {
                await db_config_1.connectionPool.query(`INSERT INTO primary_devices (action_type, id_user, id_device, description, status, executed_at) 
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
    catch (error) {
        console.error(`Error sincronizando estado para dispositivo ${serial}:`, error);
    }
}
// Función para sincronizar todos los dispositivos
async function syncAllDeviceStatuses() {
    try {
        // Obtener todos los seriales de dispositivos
        const [devices] = await deviceDb_config_1.deviceDbPool.query('SELECT serial FROM devices');
        // Sincronizar cada dispositivo
        for (const device of devices) {
            await syncDeviceStatus(device.serial);
        }
        console.log('Sincronización de estados completada para todos los dispositivos');
    }
    catch (error) {
        console.error('Error en la sincronización masiva de estados:', error);
    }
}
