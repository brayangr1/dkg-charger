"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeSchedules = executeSchedules;
exports.startScheduleExecutor = startScheduleExecutor;
// server/features/chargers/scheduleExecutor.ts
const db_config_1 = require("../../config/db.config");
const chargerService_1 = require("../../services/chargerService");
const notificationService_1 = require("../../services/notificationService");
async function executeSchedules() {
    const now = new Date();
    const currentDay = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][now.getDay()];
    const currentTime = now.getHours() * 100 + now.getMinutes(); // Formato HHMM
    try {
        const [schedules] = await db_config_1.connectionPool.query(`SELECT * FROM charging_schedules 
       WHERE week_days LIKE ? 
       AND start_time <= ? 
       AND end_time >= ?`, [`%${currentDay}%`, currentTime, currentTime]);
        for (const schedule of schedules) {
            const chargerId = schedule.charger_id;
            if (schedule.action === 'enable') {
                // Activar carga con potencia específica si está definida
                await chargerService_1.chargerService.togglePlug(chargerId, true);
                if (schedule.power) {
                    await chargerService_1.chargerService.updateChargerPower(chargerId, schedule.power);
                }
                // Notificación
                await notificationService_1.notificationService.sendChargingStartedNotification(chargerId, schedule.schedule_name);
            }
            else {
                // Desactivar carga
                await chargerService_1.chargerService.togglePlug(chargerId, false);
            }
        }
    }
    catch (error) {
        console.error('Error ejecutando programaciones:', error);
    }
}
// Iniciar el ejecutor de programaciones
function startScheduleExecutor() {
    // Ejecutar inmediatamente al iniciar
    executeSchedules();
    // Luego ejecutar cada minuto
    setInterval(executeSchedules, 60000);
}
// En tu archivo de inicialización del servidor (app.ts o index.ts)
// importar y llamar a startScheduleExecutor()
