"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const db_config_1 = require("../../config/db.config");
const router = (0, express_1.Router)();
// Registrar dispositivo de autenticación
router.post('/', auth_1.authenticate, async (req, res) => {
    const { chargerId, deviceType, deviceIdentifier, deviceName } = req.body;
    const userId = req.user?.id;
    try {
        // Verificar permisos (solo owner/admin puede registrar dispositivos)
        const [access] = await db_config_1.connectionPool.query('SELECT access_level FROM charger_users WHERE charger_id = ? AND user_id = ?', [chargerId, userId]);
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
        const [result] = await db_config_1.connectionPool.query('INSERT INTO locking_devices (charger_id, device_type, device_identifier, device_name) VALUES (?, ?, ?, ?)', [chargerId, deviceType, deviceIdentifier, deviceName]);
        res.json({
            success: true,
            deviceId: result.insertId
        });
    }
    catch (error) {
        console.error('Error registering device:', error);
        res.status(500).json({
            success: false,
            error: 'Error al registrar dispositivo'
        });
    }
});
// Obtener dispositivos de un cargador
router.get('/:chargerId', auth_1.authenticate, async (req, res) => {
    const chargerId = req.params.chargerId;
    const userId = req.user?.id;
    try {
        // Verificar que el usuario tiene acceso al cargador
        const [access] = await db_config_1.connectionPool.query('SELECT 1 FROM charger_users WHERE charger_id = ? AND user_id = ?', [chargerId, userId]);
        if (access.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a este cargador'
            });
        }
        // Obtener dispositivos
        const [devices] = await db_config_1.connectionPool.query('SELECT * FROM locking_devices WHERE charger_id = ?', [chargerId]);
        res.json({
            success: true,
            devices
        });
    }
    catch (error) {
        console.error('Error getting devices:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener dispositivos'
        });
    }
});
// Eliminar dispositivo
router.delete('/:deviceId', auth_1.authenticate, async (req, res) => {
    const deviceId = req.params.deviceId;
    const userId = req.user?.id;
    try {
        // Verificar permisos (solo owner/admin puede eliminar)
        const [device] = await db_config_1.connectionPool.query(`SELECT ld.* FROM locking_devices ld
       JOIN charger_users cu ON ld.charger_id = cu.charger_id
       WHERE ld.id = ? AND cu.user_id = ?`, [deviceId, userId]);
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
        await db_config_1.connectionPool.query('DELETE FROM locking_devices WHERE id = ?', [deviceId]);
        res.json({
            success: true,
            message: 'Dispositivo eliminado'
        });
    }
    catch (error) {
        console.error('Error deleting device:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar dispositivo'
        });
    }
});
exports.default = router;
