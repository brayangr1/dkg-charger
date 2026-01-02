import admin from 'firebase-admin';
import { connectionPool } from '../config/db.config';
import { RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

class NotificationService {
  public async sendNotification(params: { userId: number; title: string; body: string; data?: any }) {
    try {
      const { userId, title, body, data } = params;

      // 1. Obtener los tokens del usuario
      const [tokens] = await connectionPool.query<RowDataPacket[]>(
        `SELECT device_token FROM user_devices WHERE user_id = ?`,
        [userId]
      );

      if (!tokens || tokens.length === 0) {
        console.log(`[NotificationService] No hay tokens registrados para el usuario ${userId}`);
        return;
      }

      // 2. Preparar el mensaje
      const multicastMessage: admin.messaging.MulticastMessage = {
        notification: { title, body },
        data: data ? Object.keys(data).reduce((acc: any, key) => {
          acc[key] = String(data[key]);
          return acc;
        }, {}) : {},
        tokens: tokens.map((t) => t.device_token)
      };

      // 3. Enviar vía FCM
      const response = await this.fcm.sendEachForMulticast(multicastMessage);
      console.log(`[NotificationService] Notificación enviada a usuario ${userId}: ${response.successCount} éxito, ${response.failureCount} error`);

    } catch (error) {
      console.error('[NotificationService] Error enviando notificación individual:', error);
    }
  }
  private static instance: NotificationService;
  private fcm: admin.messaging.Messaging;

  private constructor() {
    this.fcm = admin.messaging();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async sendChargerNotification(chargerId: number, title: string, body: string, data?: any) {
    try {
      const [users] = await connectionPool.query<RowDataPacket[]>(
        `SELECT u.id, u.firebase_uid, cu.access_level 
         FROM users u
         JOIN charger_users cu ON u.id = cu.user_id
         WHERE cu.charger_id = ?`,
        [chargerId]
      );

      if (!users || users.length === 0) return;

      const [tokens] = await connectionPool.query<RowDataPacket[]>(
        `SELECT device_token FROM user_devices WHERE user_id IN (?)`,
        [users.map((u) => u.id)]
      );

      if (!tokens || tokens.length === 0) return;

      const multicastMessage: admin.messaging.MulticastMessage = {
        notification: { title, body },
        data: {
          chargerId: chargerId.toString(),
          type: 'charger_notification',
          ...data
        },
        tokens: tokens.map((t) => t.device_token)
      };

      await this.fcm.sendEachForMulticast(multicastMessage);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // ✅ NOTIFICACIONES DE PROGRAMACIÓN
  public async sendScheduleCreatedNotification(
    chargerId: number,
    scheduleName: string,
    startTime: string,
    endTime: string
  ) {
    const title = `Nueva programación creada`;
    const body = `Programación "${scheduleName}" activa de ${startTime} a ${endTime}`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'schedule_created',
      scheduleName,
      startTime,
      endTime
    });
  }

  public async sendScheduleDeletedNotification(chargerId: number, scheduleName: string) {
    const title = `Programación eliminada`;
    const body = `La programación "${scheduleName}" ha sido eliminada`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'schedule_deleted',
      scheduleName
    });
  }

  public async sendChargingStartedNotification(chargerId: number, scheduleName: string) {
    const title = `Carga iniciada automáticamente`;
    const body = `Programación "${scheduleName}" ha iniciado la carga`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'charging_started_auto',
      scheduleName
    });
  }

  // ✅ NOTIFICACIONES DE CARGA MANUAL
  public async sendManualChargingStartedNotification(chargerId: number, userName: string) {
    const title = `Carga iniciada manualmente`;
    const body = `${userName} ha iniciado una sesión de carga`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'charging_started_manual',
      userName
    });
  }

  public async sendChargingStoppedNotification(
    chargerId: number,
    userName: string,
    energyConsumed: number,
    totalCost: number,
    duration: number
  ) {
    const title = `Carga finalizada`;
    const body = `${userName} ha finalizado la carga. Consumo: ${energyConsumed.toFixed(2)} kWh - Costo: $${totalCost.toFixed(2)}`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'charging_stopped',
      userName,
      energyConsumed,
      totalCost,
      duration
    });
  }

  // ✅ NOTIFICACIONES DE ERRORES
  public async sendChargerErrorNotification(chargerId: number, errorType: string, errorMessage: string) {
    const title = `Error en el cargador`;
    const body = `Error ${errorType}: ${errorMessage}`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'charger_error',
      errorType,
      errorMessage
    });
  }

  public async sendConnectionLostNotification(chargerId: number) {
    const title = `Cargador desconectado`;
    const body = `El cargador ha perdido la conexión`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'connection_lost'
    });
  }

  public async sendConnectionRestoredNotification(chargerId: number) {
    const title = `Cargador reconectado`;
    const body = `El cargador ha restaurado la conexión`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'connection_restored'
    });
  }

  // ✅ NOTIFICACIONES DE ESTADO
  public async sendStatusChangeNotification(chargerId: number, newStatus: string) {
    try {
      const [chargerRows] = await connectionPool.query<RowDataPacket[]>(
        'SELECT name FROM chargers WHERE id = ?',
        [chargerId]
      );

      if (!chargerRows || chargerRows.length === 0) return;

      const title = `Estado del cargador cambiado`;
      const body = `El cargador ${chargerRows[0].name} está ahora en estado ${this.translateStatus(newStatus)}`;

      await this.sendChargerNotification(chargerId, title, body, {
        notificationType: 'status_change',
        newStatus
      });
    } catch (error) {
      console.error('Error retrieving charger info:', error);
    }
  }

  // ✅ NOTIFICACIONES DE INVITACIONES
  public async sendInvitationNotification(chargerId: number, invitedBy: string, invitedEmail: string) {
    const title = `Nueva invitación`;
    const body = `${invitedBy} te ha invitado a gestionar este cargador`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'invitation',
      invitedBy,
      invitedEmail
    });
  }

  public async sendInvitationAcceptedNotification(chargerId: number, acceptedBy: string) {
    const title = `Invitación aceptada`;
    const body = `${acceptedBy} ha aceptado la invitación al cargador`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'invitation_accepted',
      acceptedBy
    });
  }

  // ✅ NOTIFICACIONES DE MANTENIMIENTO
  public async sendMaintenanceNotification(chargerId: number, maintenanceType: string, scheduledDate?: string) {
    const title = `Mantenimiento programado`;
    const body = scheduledDate
      ? `Mantenimiento ${maintenanceType} programado para ${scheduledDate}`
      : `Mantenimiento ${maintenanceType} requerido`;

    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'maintenance',
      maintenanceType,
      scheduledDate
    });
  }

  // ✅ NOTIFICACIONES DE CONSUMO
  public async sendHighConsumptionAlert(chargerId: number, currentConsumption: number, threshold: number) {
    const title = `Alerta de alto consumo`;
    const body = `El consumo actual (${currentConsumption.toFixed(2)} kWh) ha superado el umbral de ${threshold} kWh`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'high_consumption',
      currentConsumption,
      threshold
    });
  }

  public async sendCostLimitReachedNotification(chargerId: number, currentCost: number, limit: number) {
    const title = `Límite de costo alcanzado`;
    const body = `El costo actual ($${currentCost.toFixed(2)}) ha alcanzado el límite de $${limit.toFixed(2)}`;
    await this.sendChargerNotification(chargerId, title, body, {
      notificationType: 'cost_limit_reached',
      currentCost,
      limit
    });
  }

  private translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'charging': 'Cargando',
      'standby': 'Listo',
      'locked': 'Bloqueado',
      'error': 'Error',
      'maintenance': 'En mantenimiento',
      'offline': 'Desconectado',
      'online': 'Conectado'
    };
    return statusMap[status] || status;
  }
}

export const sendNotification = async (userId: number, message: string): Promise<boolean> => {
  let conn: PoolConnection | undefined;
  try {
    conn = await connectionPool.getConnection();

    // Guardar notificación en la base de datos
    await conn.query(
      'INSERT INTO notifications (user_id, message, status) VALUES (?, ?, "pending")',
      [userId, message]
    );

    // Aquí iría la lógica para enviar notificación push, email, etc.
    // Ejemplo con Firebase Cloud Messaging:
    // await sendPushNotification(userId, message);

    return true;
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    return false;
  } finally {
    if (conn) conn.release();
  }
};

// Función auxiliar para ejemplo
const sendPushNotification = async (userId: number, message: string) => {
  // Implementación real dependería de tu sistema de notificaciones
  console.log(`Enviando notificación a usuario ${userId}: ${message}`);
};

// ✅ Exportar instancia única
export const notificationService = NotificationService.getInstance();