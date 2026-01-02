import { PoolConnection } from 'mysql2/promise';
import { connectionPool } from '../config/db.config';
import { disableCharger } from './chargerService';
import { sendNotification } from './notificationService';
import { RowDataPacket } from 'mysql2';

export const checkEnergyLimit = async (userId: number, chargerId: number): Promise<void> => {
  let conn: PoolConnection | undefined;
  
  try {
    conn = await connectionPool.getConnection();
    
    const [result] = await conn.query<RowDataPacket[]>(`
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
        await disableCharger(chargerId);
        // Enviar notificación
        await sendNotification(
          userId, 
          'Has alcanzado tu límite mensual de energía'
        );
      }
    }
  } catch (error) {
    console.error('Error verificando límite de energía:', error);
    throw error; // Opcional: relanzar el error para manejo superior
  } finally {
    if (conn) conn.release();
  }
};