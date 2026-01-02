"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkEnergyLimit = void 0;
const db_config_1 = require("../config/db.config");
const chargerService_1 = require("./chargerService");
const notificationService_1 = require("./notificationService");
const checkEnergyLimit = async (userId, chargerId) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        const [result] = await conn.query(`
      SELECT 
        cu.energy_limit,
        (SELECT COALESCE(SUM(total_energy), 0) 
         FROM charging_sessions 
         WHERE charger_id = ? AND user_id = ? 
         AND MONTH(start_time) = MONTH(CURRENT_DATE())
        ) AS monthly_usage
      FROM charger_users cu
      WHERE cu.user_id = ? AND cu.charger_id = ?
    `, [chargerId, userId, userId, chargerId]);
        if (result.length > 0 && result[0].energy_limit) {
            const energyLimit = result[0].energy_limit;
            const monthlyUsage = result[0].monthly_usage;
            if (monthlyUsage >= energyLimit) {
                // Desactivar cargador
                await (0, chargerService_1.disableCharger)(chargerId);
                // Enviar notificación
                await (0, notificationService_1.sendNotification)(userId, 'Has alcanzado tu límite mensual de energía');
            }
        }
    }
    catch (error) {
        console.error('Error verificando límite de energía:', error);
        throw error; // Opcional: relanzar el error para manejo superior
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.checkEnergyLimit = checkEnergyLimit;
