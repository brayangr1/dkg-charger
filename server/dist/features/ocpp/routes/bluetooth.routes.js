"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_config_1 = require("../../../config/db.config");
const router = (0, express_1.Router)();
// Endpoint para actualizar estado de conexión Bluetooth
router.post('/bluetooth-status', async (req, res) => {
    try {
        const { serial, bluetoothId, connected } = req.body;
        if (!serial) {
            return res.status(400).json({
                success: false,
                error: 'Número de serie requerido'
            });
        }
        // 1. Verificar si el cargador existe
        const [rows] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [serial]);
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        // 2. Actualizar estado Bluetooth
        await db_config_1.connectionPool.query(`UPDATE chargers SET 
        bluetooth_connected = ?,
        mac_address = COALESCE(?, mac_address),
        last_bluetooth_connection = CASE WHEN ? THEN NOW() ELSE last_bluetooth_connection END
       WHERE serial_number = ?`, [connected, bluetoothId, connected, serial]);
        return res.json({
            success: true,
            message: connected ? 'Bluetooth conectado' : 'Bluetooth desconectado',
            updated_at: new Date()
        });
    }
    catch (error) {
        console.error('Error actualizando estado Bluetooth:', error);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});
exports.default = router;
