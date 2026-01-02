// server/services/chargingMonitor.ts
import { deviceDbPool } from '../config/deviceDb.config';
import { connectionPool } from '../config/db.config';
import { RowDataPacket } from 'mysql2/promise';
import { webSocketServer } from '../src/app';

export async function monitorActiveChargingSessions() {
  try {
    // Obtener todos los cargadores en estado 'charging'
    const [activeChargers] = await connectionPool.query<RowDataPacket[]>(
      `SELECT c.id, c.serial_number, cu.user_id 
       FROM chargers c
       JOIN charger_users cu ON c.id = cu.charger_id
       WHERE c.status = 'charging'`
    );

    for (const charger of activeChargers) {
      // Consultar la tabla de logs específica del dispositivo
      const [currentSession] = await deviceDbPool.query<RowDataPacket[]>(
        `SELECT * FROM charging_log_${charger.serial_number} 
         WHERE end_time IS NULL 
         ORDER BY start_time DESC LIMIT 1`
      );

      if (currentSession.length > 0) {
        const sessionData = currentSession[0];
        
        // Calcular costo basado en la tarifa del usuario
        const [userRate] = await connectionPool.query<RowDataPacket[]>(
          `SELECT rate_per_kwh FROM charger_users 
           WHERE charger_id = ? AND user_id = ?`,
          [charger.id, charger.user_id]
        );

        const rate = userRate[0]?.rate_per_kwh || 0.30; // Precio por defecto
        const estimatedCost = (sessionData.energy_kwh || 0) * rate;

        // Enviar actualización por WebSocket (usar API: notifyChargingUpdate(chargerId, data))
        webSocketServer.notifyChargingUpdate(charger.id, {
          energy: sessionData.energy_kwh,
          power: sessionData.power_peak,
          duration: Math.floor((new Date().getTime() - new Date(sessionData.start_time).getTime()) / 1000),
          cost: estimatedCost,
          ratePerKwh: rate
        });
      }
    }
  } catch (error) {
    console.error('Error monitoring charging sessions:', error);
  }
}

import { CONFIG } from '../config/env.config';

// Iniciar el monitoreo con el intervalo configurado
