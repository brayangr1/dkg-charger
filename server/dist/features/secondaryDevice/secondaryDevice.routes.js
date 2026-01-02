"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const db_config_1 = require("../../config/db.config");
const router = (0, express_1.Router)();
// GET /api/chargers/:id/secondary-device
router.get('/:id/secondary-device', auth_1.authenticate, async (req, res) => {
    const chargerId = req.params.id;
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'Usuario no autenticado'
        });
    }
    console.log(`[SecondaryDevice] GET - Usuario ${userId} solicitando estado del dispositivo ${chargerId}`);
    try {
        // 1. Verificar que el usuario tiene acceso al cargador
        const [access] = await db_config_1.connectionPool.query('SELECT 1 FROM charger_users WHERE charger_id = ? AND user_id = ?', [chargerId, userId]);
        if (access.length === 0) {
            console.log(`[SecondaryDevice] Usuario ${userId} no tiene acceso al cargador ${chargerId}`);
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a este cargador'
            });
        }
        // 2. Verificar si el cargador existe
        const [chargerExists] = await db_config_1.connectionPool.query('SELECT id FROM chargers WHERE id = ?', [chargerId]);
        if (chargerExists.length === 0) {
            console.log(`[SecondaryDevice] Cargador ${chargerId} no encontrado`);
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        // 3. Obtener estado del dispositivo secundario
        console.log(`[SecondaryDevice] Buscando estado del dispositivo para cargador ${chargerId}`);
        const [rows] = await db_config_1.connectionPool.query('SELECT device_status FROM secondary_devices WHERE charger_id = ?', [chargerId]);
        if (rows.length === 0) {
            console.log(`[SecondaryDevice] Creando registro inicial para cargador ${chargerId}`);
            await db_config_1.connectionPool.query('INSERT INTO secondary_devices (charger_id, device_status) VALUES (?, ?)', [chargerId, false]);
            return res.json({ success: true, device_status: false });
        }
        console.log(`[SecondaryDevice] Estado encontrado para cargador ${chargerId}:`, rows[0].device_status);
        res.json({ success: true, device_status: rows[0].device_status });
    }
    catch (error) {
        console.error('[SecondaryDevice] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estado del dispositivo'
        });
    }
});
// POST /api/chargers/:id/secondary-device
router.post('/:id/secondary-device', auth_1.authenticate, async (req, res) => {
    const chargerId = req.params.id;
    const userId = req.user?.id;
    const { device_status } = req.body;
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'Usuario no autenticado'
        });
    }
    console.log(`[SecondaryDevice] POST - Usuario ${userId} intentando actualizar dispositivo ${chargerId} a estado: ${device_status}`);
    if (typeof device_status !== 'boolean') {
        console.log('[SecondaryDevice] Error: device_status no es booleano:', device_status);
        return res.status(400).json({
            success: false,
            error: 'El estado del dispositivo debe ser un booleano'
        });
    }
    try {
        // 1. Verificar que el usuario tiene acceso al cargador
        const [access] = await db_config_1.connectionPool.query('SELECT 1 FROM charger_users WHERE charger_id = ? AND user_id = ?', [chargerId, userId]);
        if (access.length === 0) {
            console.log(`[SecondaryDevice] Usuario ${userId} no tiene acceso al cargador ${chargerId}`);
            return res.status(403).json({
                success: false,
                error: 'No tienes acceso a este cargador'
            });
        }
        // 2. Verificar si el cargador existe
        const [chargerExists] = await db_config_1.connectionPool.query('SELECT id FROM chargers WHERE id = ?', [chargerId]);
        if (chargerExists.length === 0) {
            console.log(`[SecondaryDevice] Cargador ${chargerId} no encontrado`);
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        // 3. Actualizar estado
        console.log(`[SecondaryDevice] Actualizando estado para cargador ${chargerId}`);
        const result = await db_config_1.connectionPool.query('UPDATE secondary_devices SET device_status = ? WHERE charger_id = ?', [device_status, chargerId]);
        // Si no se actualizó ningún registro, insertarlo
        if (result[0].affectedRows === 0) {
            console.log(`[SecondaryDevice] Creando nuevo registro para cargador ${chargerId}`);
            await db_config_1.connectionPool.query('INSERT INTO secondary_devices (charger_id, device_status) VALUES (?, ?)', [chargerId, device_status]);
        }
        console.log(`[SecondaryDevice] Estado actualizado exitosamente para cargador ${chargerId}`);
        res.json({
            success: true,
            message: `Dispositivo secundario ${device_status ? 'encendido' : 'apagado'} correctamente`
        });
    }
    catch (error) {
        console.error('[SecondaryDevice] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar el estado del dispositivo'
        });
    }
});
exports.default = router;
