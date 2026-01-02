/**
 * Servicio de ejecución de programaciones de carga
 * Ejecuta automáticamente las programaciones según su hora establecida
 */

import cron from 'node-cron';
import axios from 'axios';
import { connectionPool } from '../config/db.config';
import { notificationService } from './notificationService';
import { remoteStartOcppCharging } from './chargerService';

export class ScheduleExecutor {
  private task: any = null;
  private readonly API_BASE = process.env.API_BASE_URL || 'http://localhost:5010/api';
  private readonly INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-key';

  /**
   * Inicia el monitor de programaciones
   * Se ejecuta cada minuto para verificar si hay programaciones por ejecutar
   */
  public start() {
    console.log('[ScheduleExecutor] Iniciando monitor de programaciones...');

    // Ejecutar cada minuto (*/1 * * * * *)
    this.task = cron.schedule('*/1 * * * * *', async () => {
      try {
        await this.executeSchedules();
      } catch (error) {
        console.error('[ScheduleExecutor] Error en cron job:', error);
      }
    });

    console.log('[ScheduleExecutor] Monitor iniciado. Ejecutándose cada minuto.');
  }

  /**
   * Detiene el monitor de programaciones
   */
  public stop() {
    if (this.task) {
      this.task.stop();
      console.log('[ScheduleExecutor] Monitor detenido.');
    }
  }

  /**
   * Ejecuta las programaciones que deben ejecutarse en este momento
   */
  private async executeSchedules() {
    const executionTime = new Date().toISOString();
    // console.log(`[ScheduleExecutor] ⏰ Iniciando verificación de programaciones a ${executionTime}`);

    try {
      const now = new Date();
      const today = now.getDay(); // 0=Dom, 1=Lun, 2=Mar...
      const dayMap = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const todayName = dayMap[today];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // 1. Obtener todas las programaciones activas
      const [schedules] = await connectionPool.query(
        `SELECT cs.*, c.serial_number, c.id as charger_id 
         FROM charging_schedules cs
         JOIN chargers c ON cs.charger_id = c.id
         WHERE cs.is_active = 1 AND cs.status != 'completed'
         ORDER BY cs.charger_id`
      ) as any[];

      if ((schedules as any[]).length === 0) return;

      let executed = 0;
      let errors = 0;

      // 2. Procesar cada programación
      for (const schedule of (schedules as any[])) {
        try {
          const days = (schedule.week_days || '').split(',').map((d: string) => d.trim());

          // Verificar si es hoy
          if (!days.includes(todayName)) continue;

          // Verificar si es la hora (con tolerancia de 1 minuto)
          const [startHours, startMinutes] = (schedule.start_time || '').split(':');
          if (!startHours || !startMinutes) continue;

          const scheduleStartMinutes = parseInt(startHours) * 60 + parseInt(startMinutes);
          const timeDiff = currentMinutes - scheduleStartMinutes;

          // A. Si es la hora exacta (±1 min) y NO está activa -> INICIAR
          if (Math.abs(timeDiff) <= 1 && schedule.status !== 'active') {
            console.log(`[ScheduleExecutor] ⚡ Ejecutando programación #${schedule.id} - ${schedule.schedule_name}`);

            await connectionPool.query(
              'UPDATE charging_schedules SET status = ? WHERE id = ?',
              ['active', schedule.id]
            );

            if (schedule.user_id && schedule.serial_number) {
              const response = await remoteStartOcppCharging(schedule.serial_number, schedule.user_id);
              if (response?.success) {
                console.log(`[ScheduleExecutor] ✅ Carga iniciada para #${schedule.id}`);
                executed++;
                if (notificationService?.sendNotification) {
                  notificationService.sendNotification({
                    userId: schedule.user_id,
                    title: 'Carga Iniciada',
                    body: `${schedule.schedule_name} se ha iniciado automáticamente`,
                    data: {
                      chargerId: schedule.charger_id.toString(),
                      scheduleId: schedule.id.toString(),
                      type: 'schedule_started'
                    }
                  });
                }
              } else {
                console.error(`[ScheduleExecutor] ❌ Error: ${response?.error}`);
                errors++;
              }
            }
          }
          // B. Si ya pasaron mas de 2 minutos de la hora de inicio y sigue 'active' -> volver a 'pending' para mañana
          else if (timeDiff > 2 && schedule.status === 'active') {
            await connectionPool.query(
              'UPDATE charging_schedules SET status = ? WHERE id = ?',
              ['pending', schedule.id]
            );
          }
        } catch (scheduleError) {
          console.error(`[ScheduleExecutor] Error procesando programación #${schedule.id}:`, scheduleError);
          errors++;
        }
      }

      if (executed > 0) {
        console.log(`[ScheduleExecutor] Result: ${executed} ejecutadas, ${errors} errores`);
      }
    } catch (error) {
      console.error('[ScheduleExecutor] Error general en el ejecutor:', error);
    }
  }

  /**
   * Ejecuta manualmente las programaciones (útil para testing)
   */
  public async executeManually() {
    console.log('[ScheduleExecutor] Ejecutando manualmente...');
    await this.executeSchedules();
  }
}

// Exportar instancia singleton
export const scheduleExecutor = new ScheduleExecutor();
