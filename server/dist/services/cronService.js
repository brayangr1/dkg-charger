"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeManualReset = exports.startCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const db_config_1 = require("../config/db.config");
// Función para reiniciar automáticamente todos los usuarios el día de corte
const autoResetMonthlyLimits = async () => {
    try {
        console.log('=== INICIANDO REINICIO AUTOMÁTICO MENSUAL ===');
        console.log('Fecha:', new Date().toISOString());
        // Obtener todos los usuarios con límites de energía
        const [users] = await db_config_1.connectionPool.query(`
      SELECT 
        cu.id,
        cu.user_id,
        cu.charger_id,
        cu.monthly_energy_used,
        cu.monthly_energy_accumulated,
        cu.monthly_cost_accumulated,
        cu.rate_per_kwh,
        cu.energy_limit,
        i.accepted_at
      FROM charger_users cu
      JOIN invitations i ON i.guest_email = (
        SELECT email FROM users WHERE id = cu.user_id
      ) AND i.charger_id = cu.charger_id
      WHERE cu.energy_limit IS NOT NULL AND cu.energy_limit > 0
    `);
        console.log(`Encontrados ${users.length} usuarios para verificar reinicio`);
        let resetCount = 0;
        for (const user of users) {
            try {
                const acceptedDate = new Date(user.accepted_at);
                const cutoffDay = acceptedDate.getDate();
                const today = new Date();
                // Verificar si hoy es el día de corte para este usuario
                if (today.getDate() === cutoffDay) {
                    console.log(`Reiniciando usuario ${user.user_id} (día de corte: ${cutoffDay})`);
                    const currentEnergy = parseFloat(user.monthly_energy_used) || 0;
                    const currentAccumulated = parseFloat(user.monthly_energy_accumulated) || 0;
                    const currentCostAccumulated = parseFloat(user.monthly_cost_accumulated) || 0;
                    const ratePerKwh = parseFloat(user.rate_per_kwh) || 0;
                    // Calcular totales
                    const totalMonthlyEnergy = currentEnergy + currentAccumulated;
                    const currentMonthlyCost = currentEnergy * ratePerKwh;
                    const newAccumulatedCost = currentCostAccumulated + currentMonthlyCost;
                    // Reiniciar
                    await db_config_1.connectionPool.query('UPDATE charger_users SET monthly_energy_used = 0, monthly_energy_accumulated = ?, monthly_cost_accumulated = ? WHERE id = ?', [totalMonthlyEnergy, newAccumulatedCost, user.id]);
                    console.log(`Usuario ${user.user_id} reiniciado: energía=${totalMonthlyEnergy}, costo=${newAccumulatedCost}`);
                    resetCount++;
                }
            }
            catch (err) {
                console.error(`Error reiniciando usuario ${user.user_id}:`, err);
            }
        }
        console.log(`=== REINICIO AUTOMÁTICO MENSUAL COMPLETADO: ${resetCount} usuarios reiniciados ===`);
    }
    catch (err) {
        console.error('Error en reinicio automático mensual:', err);
    }
};
// Función para iniciar el cron job
const startCronJobs = () => {
    console.log('🚀 Iniciando cron jobs...');
    // Programar el cron job para ejecutarse todos los días a las 00:01
    // Esto verificará si es día de corte para algún usuario
    node_cron_1.default.schedule('1 0 * * *', () => {
        console.log('⏰ Ejecutando verificación diaria de reinicio automático...');
        autoResetMonthlyLimits();
    });
    console.log('✅ Cron job de reinicio automático mensual programado');
    console.log('📅 Se ejecutará todos los días a las 00:01');
};
exports.startCronJobs = startCronJobs;
// Función para ejecutar manualmente (para pruebas)
const executeManualReset = async () => {
    console.log('🔧 Ejecutando reinicio automático manual...');
    await autoResetMonthlyLimits();
};
exports.executeManualReset = executeManualReset;
