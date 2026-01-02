"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const deviceSync_service_1 = require("../../services/deviceSync.service");
const router = (0, express_1.Router)();
// POST /api/sync/sync-all
router.post('/sync-all', async (req, res) => {
    try {
        await (0, deviceSync_service_1.syncAllDevices)();
        res.json({ success: true, message: 'Todos los dispositivos sincronizados' });
    }
    catch (err) {
        console.error('❌ Error en sync-all:', err);
        res.status(500).json({ success: false, error: 'Error en sincronización global' });
    }
});
// POST /api/sync/:serial
router.post('/:serial', async (req, res) => {
    const { serial } = req.params;
    try {
        await (0, deviceSync_service_1.syncChargerData)(serial);
        res.json({ success: true, message: `Dispositivo ${serial} sincronizado` });
    }
    catch (err) {
        res.status(500).json({ success: false, error: 'Error al sincronizar' });
    }
});
exports.default = router;
