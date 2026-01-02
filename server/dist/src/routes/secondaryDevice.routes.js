"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const db_config_1 = require("../../config/db.config");
const router = (0, express_1.Router)();
// GET /api/chargers/:id/secondary-device
// Obtener el estado del dispositivo secundario
router.get('/:id/secondary-device', auth_1.authenticate, async (req, res) => {
    const chargerId = req.params.id;
    console.log(`Recibida petición GET para obtener estado del dispositivo ${chargerId}`);
    try {
        // Primero verificar si el cargador existe
        const [chargerExists] = await db_config_1.connectionPool.query('SELECT id FROM chargers WHERE id = ?', [chargerId]);
        if (chargerExists.length === 0) {
            console.log(`Cargador ${chargerId} no encontrado`);
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        console.log(`Buscando estado del dispositivo secundario para cargador ${chargerId}`);
        const [rows] = await db_config_1.connectionPool.query('SELECT device_status FROM secondary_devices WHERE charger_id = ?', [chargerId]);
        if (rows.length === 0) {
            console.log(`No se encontró dispositivo secundario para cargador ${chargerId}, creando uno nuevo`);
            // Si no existe, lo creamos
            await db_config_1.connectionPool.query('INSERT INTO secondary_devices (charger_id, device_status) VALUES (?, ?)', [chargerId, false]);
            return res.json({ success: true, device_status: false });
        }
        console.log(`Estado del dispositivo encontrado:`, rows[0]);
        res.json({ success: true, device_status: rows[0].device_status });
    }
    catch (error) {
        console.error('Error al obtener estado del dispositivo secundario:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estado del dispositivo'
        });
    }
});
// POST /api/chargers/:id/secondary-device
// Actualizar el estado del dispositivo secundario
router.post('/:id/secondary-device', auth_1.authenticate, async (req, res) => {
    const chargerId = req.params.id;
    const { device_status } = req.body;
    console.log(`Recibida petición POST para actualizar dispositivo ${chargerId} a estado: ${device_status}`);
    if (typeof device_status !== 'boolean') {
        console.log('Error: device_status no es booleano:', device_status);
        return res.status(400).json({
            success: false,
            error: 'El estado del dispositivo debe ser un booleano'
        });
    }
    try {
        // Primero verificar si el cargador existe
        const [chargerExists] = await db_config_1.connectionPool.query('SELECT id FROM chargers WHERE id = ?', [chargerId]);
        if (chargerExists.length === 0) {
            console.log(`Cargador ${chargerId} no encontrado`);
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        console.log(`Actualizando estado del dispositivo secundario para cargador ${chargerId}`);
        // Primero intentamos actualizar
        const [result] = await db_config_1.connectionPool.query('UPDATE secondary_devices SET device_status = ? WHERE charger_id = ?', [device_status, chargerId]);
        // Si no se actualizó ningún registro, lo insertamos
        if (result.affectedRows === 0) {
            console.log('No existe el dispositivo, creando uno nuevo');
            await db_config_1.connectionPool.query('INSERT INTO secondary_devices (charger_id, device_status) VALUES (?, ?)', [chargerId, device_status]);
        }
        console.log('Actualización exitosa');
        res.json({
            success: true,
            message: `Dispositivo secundario ${device_status ? 'encendido' : 'apagado'} correctamente`
        });
    }
    catch (error) {
        console.error('Error al actualizar estado del dispositivo secundario:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar el estado del dispositivo'
        });
    }
});
exports.default = router;
