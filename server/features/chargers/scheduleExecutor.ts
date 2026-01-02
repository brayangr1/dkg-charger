// server/features/chargers/scheduleExecutor.ts
import { connectionPool } from '../../config/db.config';
import { chargerService } from '../../services/chargerService';
import { notificationService } from '../../services/notificationService';
import { RowDataPacket } from 'mysql2';

export async function executeSchedules() {
  const now = new Date();
  const currentDay = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][now.getDay()];
  const currentTime = now.getHours() * 100 + now.getMinutes(); // Formato HHMM

  try {
    const [schedules] = await connectionPool.query<RowDataPacket[]>(
      `SELECT * FROM charging_schedules 
       WHERE week_days LIKE ? 
       AND start_time <= ? 
       AND end_time >= ?`,
      [`%${currentDay}%`, currentTime, currentTime]
    );

    for (const schedule of schedules) {
      const chargerId = schedule.charger_id;
      
      if (schedule.action === 'enable') {
        // Activar carga con potencia específica si está definida
        await chargerService.togglePlug(chargerId, true);
        if (schedule.power) {
          await chargerService.updateChargerPower(chargerId, schedule.power);
        }
        
        // Notificación
        await notificationService.sendChargingStartedNotification(
          chargerId,
          schedule.schedule_name
        );
      } else {
        // Desactivar carga
        await chargerService.togglePlug(chargerId, false);
      }
    }
  } catch (error) {
    console.error('Error ejecutando programaciones:', error);
  }
}

// Iniciar el ejecutor de programaciones
export function startScheduleExecutor() {
  // Ejecutar inmediatamente al iniciar
  executeSchedules();
  
  // Luego ejecutar cada minuto
  setInterval(executeSchedules, 60000);
}

// En tu archivo de inicialización del servidor (app.ts o index.ts)
// importar y llamar a startScheduleExecutor()