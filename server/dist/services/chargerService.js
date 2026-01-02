"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disableCharger = exports.chargerService = void 0;
const db_config_1 = require("../config/db.config");
exports.chargerService = {
    async togglePlug(chargerId, state) {
        await db_config_1.connectionPool.query('UPDATE chargers SET status = ? WHERE id = ?', [state ? 'charging' : 'standby', chargerId]);
    },
    async updateChargerPower(chargerId, power) {
        await db_config_1.connectionPool.query('UPDATE chargers SET max_power = ? WHERE id = ?', [power, chargerId]);
    },
    async getCharger(chargerId) {
        const [rows] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE id = ?', [chargerId]);
        return rows[0];
    },
    // NUEVO MÉTODO PARA ACTUALIZAR ESTADO DE INVITADO
    async updateGuestStatus(userId, isGuest) {
        await db_config_1.connectionPool.query('UPDATE users SET is_guest = ? WHERE id = ?', [isGuest, userId]);
    }
};
const disableCharger = async (chargerId) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        await conn.query('UPDATE chargers SET status = "locked" WHERE id = ?', [chargerId]);
        return true;
    }
    catch (error) {
        console.error('Error al desactivar cargador:', error);
        return false;
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.disableCharger = disableCharger;
