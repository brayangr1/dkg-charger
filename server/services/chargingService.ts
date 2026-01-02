// server/services/chargingService.ts
import { connectionPool, deviceDbPool } from '../config/db.config';
import { RowDataPacket } from 'mysql2/promise';

interface ChargingSessionParams {
  chargerId: number;
  userId: number | undefined
  paymentMethodId: string;
  ratePerKwh: number;
  
}

export const createChargingSession = async (params: {
  chargerId: number;
  userId: number;
  paymentMethodId: string;
  ratePerKwh: number;
}): Promise<string> => {
  const conn = await connectionPool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Obtener serial del cargador
    const [charger] = await conn.query<RowDataPacket[]>(
      `SELECT serial_number FROM chargers WHERE id = ?`,
      [params.chargerId]
    );

    if (charger.length === 0) {
      throw new Error('Cargador no encontrado');
    }

    // 2. Crear registro en charging_sessions
    const [result] = await conn.query(
      `INSERT INTO charging_sessions 
       (charger_id, user_id, start_time, charging_mode, payment_method_id, rate_per_kwh) 
       VALUES (?, ?, NOW(), 'grid', ?, ?)`,
      [params.chargerId, params.userId, params.paymentMethodId, params.ratePerKwh]
    );

    const sessionId = (result as any).insertId.toString();

    // 3. Crear registro en la tabla del dispositivo
    await deviceDbPool.query(
      `INSERT INTO charging_log_${charger[0].serial_number} 
       (start_time, rate_per_kwh) 
       VALUES (NOW(), ?)`,
      [params.ratePerKwh]
    );

    await conn.commit();
    return sessionId;

  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

