"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingService = void 0;
const db_config_1 = require("../../config/db.config");
exports.billingService = {
    async getByUserId(userId) {
        const [rows] = await db_config_1.connectionPool.query('SELECT * FROM billing_details WHERE user_id = ? LIMIT 1', [userId]);
        return rows[0] || null;
    },
    async upsertForUser(userId, payload) {
        // Intentar actualizar si existe
        const existing = await this.getByUserId(userId);
        if (existing) {
            await db_config_1.connectionPool.query(`UPDATE billing_details SET company_name = ?, first_name = ?, last_name = ?, cif = ?, phone = ?, address = ?, postal_code = ?, city = ?, country = ?, is_default = ? WHERE user_id = ?`, [
                payload.company_name || null,
                payload.first_name || null,
                payload.last_name || null,
                payload.cif || null,
                payload.phone || null,
                payload.address || null,
                payload.postal_code || null,
                payload.city || null,
                payload.country || null,
                payload.is_default ? 1 : 0,
                userId,
            ]);
            return await this.getByUserId(userId);
        }
        const [result] = await db_config_1.connectionPool.query(`INSERT INTO billing_details (user_id, company_name, first_name, last_name, cif, phone, address, postal_code, city, country, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [
            userId,
            payload.company_name || null,
            payload.first_name || null,
            payload.last_name || null,
            payload.cif || null,
            payload.phone || null,
            payload.address || null,
            payload.postal_code || null,
            payload.city || null,
            payload.country || null,
            payload.is_default ? 1 : 0,
        ]);
        return await this.getByUserId(userId);
    },
    async deleteByUserId(userId) {
        const [res] = await db_config_1.connectionPool.query('DELETE FROM billing_details WHERE user_id = ?', [userId]);
        return res.affectedRows > 0;
    }
};
exports.default = exports.billingService;
