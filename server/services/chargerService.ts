import { connectionPool } from '../config/db.config';
import { notificationService } from './notificationService';
import { RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';
import { ocppService } from '../features/ocpp/services/ocpp.service';

export const chargerService = {
  async togglePlug(chargerId: number, state: boolean): Promise<void> {
    await connectionPool.query(
      'UPDATE chargers SET status = ? WHERE id = ?',
      [state ? 'charging' : 'standby', chargerId]
    );
  },

  async updateChargerPower(chargerId: number, power: number): Promise<void> {
    await connectionPool.query(
      'UPDATE chargers SET max_power = ? WHERE id = ?',
      [power, chargerId]
    );
  },

  async getCharger(chargerId: number): Promise<any> {
    const [rows] = await connectionPool.query<RowDataPacket[]>(
      'SELECT * FROM chargers WHERE id = ?',
      [chargerId]
    );
    return rows[0];
  },

  // NUEVO MÉTODO PARA ACTUALIZAR ESTADO DE INVITADO
  async updateGuestStatus(userId: number, isGuest: boolean): Promise<void> {
    await connectionPool.query(
      'UPDATE users SET is_guest = ? WHERE id = ?',
      [isGuest, userId]
    );
  }
};

export const disableCharger = async (chargerId: number): Promise<boolean> => {
  let conn: PoolConnection | undefined;

  try {
    conn = await connectionPool.getConnection();

    await conn.query(
      'UPDATE chargers SET status = "locked" WHERE id = ?',
      [chargerId]
    );

    return true;
  } catch (error) {
    console.error('Error al desactivar cargador:', error);
    return false;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Inicia una carga remota OCPP
 * @param serial Serial del cargador
 * @param userId ID del usuario
 */
export const remoteStartOcppCharging = async (serial: string, userId: number) => {
  try {
    const [chargerResult] = await connectionPool.query(
      'SELECT id FROM chargers WHERE serial_number = ?',
      [serial]
    ) as any;

    if (chargerResult.length === 0) {
      return { success: false, error: 'Cargador no encontrado' };
    }

    const chargerId = chargerResult[0].id;

    const payload = {
      connectorId: 1,
      idTag: String(userId)
    };

    const success = await ocppService.sendCommand(serial, 'RemoteStartTransaction', payload);

    if (success) {
      try {
        await connectionPool.query(
          'UPDATE chargers SET status = ? WHERE id = ?',
          ['pending_charge', chargerId]
        );
      } catch (error) {
        console.warn(`[chargerService] Error actualizando estado del cargador:`, error);
      }
      return { success: true };
    } else {
      return { success: false, error: 'Cargador no conectado' };
    }
  } catch (error) {
    console.error(`[chargerService] Error crítico iniciado carga remota:`, error);
    return { success: false, error: 'Error interno' };
  }
};

export const remoteStopOcppCharging = async (serial: string, transactionId: string | number) => {
  try {
    const [chargerResult] = await connectionPool.query(
      'SELECT id FROM chargers WHERE serial_number = ?',
      [serial]
    ) as any;

    if (chargerResult.length === 0) {
      return { success: false, error: 'Cargador no encontrado' };
    }

    const chargerId = chargerResult[0].id;

    const payload = {
      transactionId: Number(transactionId)
    };

    const success = await ocppService.sendCommand(serial, 'RemoteStopTransaction', payload);

    if (success) {
      try {
        await connectionPool.query(
          'UPDATE chargers SET status = ? WHERE id = ?',
          ['standby', chargerId]
        );
      } catch (error) {
        console.warn(`[chargerService] Error actualizando estado del cargador:`, error);
      }
      return { success: true };
    } else {
      return { success: false, error: 'Cargador no conectado' };
    }
  } catch (error) {
    console.error(`[chargerService] Error crítico detenido carga remota:`, error);
    return { success: false, error: 'Error interno' };
  }
};