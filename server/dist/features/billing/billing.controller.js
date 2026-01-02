"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBilling = exports.upsertBilling = exports.getMyBilling = void 0;
const billing_service_1 = require("./billing.service");
const getMyBilling = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('[billing.controller] getMyBilling userId:', userId);
        const billing = await billing_service_1.billingService.getByUserId(userId);
        res.json({ success: true, billing });
    }
    catch (error) {
        console.error('Error getting billing details:', error);
        res.status(500).json({ success: false, error: 'Error obteniendo datos de facturación' });
    }
};
exports.getMyBilling = getMyBilling;
const upsertBilling = async (req, res) => {
    try {
        const userId = req.user.id;
        const payload = req.body;
        console.log('[billing.controller] upsertBilling userId:', userId, 'payload:', payload);
        const result = await billing_service_1.billingService.upsertForUser(userId, payload);
        res.json({ success: true, billing: result });
    }
    catch (error) {
        console.error('Error upserting billing details:', error);
        res.status(500).json({ success: false, error: 'Error guardando datos de facturación' });
    }
};
exports.upsertBilling = upsertBilling;
const deleteBilling = async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('[billing.controller] deleteBilling userId:', userId);
        const deleted = await billing_service_1.billingService.deleteByUserId(userId);
        res.json({ success: deleted });
    }
    catch (error) {
        console.error('Error deleting billing details:', error);
        res.status(500).json({ success: false, error: 'Error eliminando datos de facturación' });
    }
};
exports.deleteBilling = deleteBilling;
exports.default = {
    getMyBilling: exports.getMyBilling,
    upsertBilling: exports.upsertBilling,
    deleteBilling: exports.deleteBilling,
};
