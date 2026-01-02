"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.sendNotification = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const db_config_1 = require("../config/db.config");
class NotificationService {
    constructor() {
        this.fcm = firebase_admin_1.default.messaging();
    }
    static getInstance() {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }
    async sendChargerNotification(chargerId, title, body, data) {
        try {
            const [users] = await db_config_1.connectionPool.query(`SELECT u.id, u.firebase_uid, cu.access_level 
         FROM users u
         JOIN charger_users cu ON u.id = cu.user_id
         WHERE cu.charger_id = ?`, [chargerId]);
            if (!users || users.length === 0)
                return;
            const [tokens] = await db_config_1.connectionPool.query(`SELECT device_token FROM user_devices WHERE user_id IN (?)`, [users.map((u) => u.id)]);
            if (!tokens || tokens.length === 0)
                return;
            const multicastMessage = {
                notification: { title, body },
                data: {
                    chargerId: chargerId.toString(),
                    type: 'charger_notification',
                    ...data
                },
                tokens: tokens.map((t) => t.device_token)
            };
            await this.fcm.sendEachForMulticast(multicastMessage);
        }
        catch (error) {
            console.error('Error sending notification:', error);
        }
    }
    // ✅ NOTIFICACIONES DE PROGRAMACIÓN
    async sendScheduleCreatedNotification(chargerId, scheduleName, startTime, endTime) {
        const title = `Nueva programación creada`;
        const body = `Programación "${scheduleName}" activa de ${startTime} a ${endTime}`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'schedule_created',
            scheduleName,
            startTime,
            endTime
        });
    }
    async sendScheduleDeletedNotification(chargerId, scheduleName) {
        const title = `Programación eliminada`;
        const body = `La programación "${scheduleName}" ha sido eliminada`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'schedule_deleted',
            scheduleName
        });
    }
    async sendChargingStartedNotification(chargerId, scheduleName) {
        const title = `Carga iniciada automáticamente`;
        const body = `Programación "${scheduleName}" ha iniciado la carga`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'charging_started_auto',
            scheduleName
        });
    }
    // ✅ NOTIFICACIONES DE CARGA MANUAL
    async sendManualChargingStartedNotification(chargerId, userName) {
        const title = `Carga iniciada manualmente`;
        const body = `${userName} ha iniciado una sesión de carga`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'charging_started_manual',
            userName
        });
    }
    async sendChargingStoppedNotification(chargerId, userName, energyConsumed, totalCost, duration) {
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
    async sendChargerErrorNotification(chargerId, errorType, errorMessage) {
        const title = `Error en el cargador`;
        const body = `Error ${errorType}: ${errorMessage}`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'charger_error',
            errorType,
            errorMessage
        });
    }
    async sendConnectionLostNotification(chargerId) {
        const title = `Cargador desconectado`;
        const body = `El cargador ha perdido la conexión`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'connection_lost'
        });
    }
    async sendConnectionRestoredNotification(chargerId) {
        const title = `Cargador reconectado`;
        const body = `El cargador ha restaurado la conexión`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'connection_restored'
        });
    }
    // ✅ NOTIFICACIONES DE ESTADO
    async sendStatusChangeNotification(chargerId, newStatus) {
        try {
            const [chargerRows] = await db_config_1.connectionPool.query('SELECT name FROM chargers WHERE id = ?', [chargerId]);
            if (!chargerRows || chargerRows.length === 0)
                return;
            const title = `Estado del cargador cambiado`;
            const body = `El cargador ${chargerRows[0].name} está ahora en estado ${this.translateStatus(newStatus)}`;
            await this.sendChargerNotification(chargerId, title, body, {
                notificationType: 'status_change',
                newStatus
            });
        }
        catch (error) {
            console.error('Error retrieving charger info:', error);
        }
    }
    // ✅ NOTIFICACIONES DE INVITACIONES
    async sendInvitationNotification(chargerId, invitedBy, invitedEmail) {
        const title = `Nueva invitación`;
        const body = `${invitedBy} te ha invitado a gestionar este cargador`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'invitation',
            invitedBy,
            invitedEmail
        });
    }
    async sendInvitationAcceptedNotification(chargerId, acceptedBy) {
        const title = `Invitación aceptada`;
        const body = `${acceptedBy} ha aceptado la invitación al cargador`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'invitation_accepted',
            acceptedBy
        });
    }
    // ✅ NOTIFICACIONES DE MANTENIMIENTO
    async sendMaintenanceNotification(chargerId, maintenanceType, scheduledDate) {
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
    async sendHighConsumptionAlert(chargerId, currentConsumption, threshold) {
        const title = `Alerta de alto consumo`;
        const body = `El consumo actual (${currentConsumption.toFixed(2)} kWh) ha superado el umbral de ${threshold} kWh`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'high_consumption',
            currentConsumption,
            threshold
        });
    }
    async sendCostLimitReachedNotification(chargerId, currentCost, limit) {
        const title = `Límite de costo alcanzado`;
        const body = `El costo actual ($${currentCost.toFixed(2)}) ha alcanzado el límite de $${limit.toFixed(2)}`;
        await this.sendChargerNotification(chargerId, title, body, {
            notificationType: 'cost_limit_reached',
            currentCost,
            limit
        });
    }
    translateStatus(status) {
        const statusMap = {
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
const sendNotification = async (userId, message) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        // Guardar notificación en la base de datos
        await conn.query('INSERT INTO notifications (user_id, message, status) VALUES (?, ?, "pending")', [userId, message]);
        // Aquí iría la lógica para enviar notificación push, email, etc.
        // Ejemplo con Firebase Cloud Messaging:
        // await sendPushNotification(userId, message);
        return true;
    }
    catch (error) {
        console.error('Error al enviar notificación:', error);
        return false;
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.sendNotification = sendNotification;
// Función auxiliar para ejemplo
const sendPushNotification = async (userId, message) => {
    // Implementación real dependería de tu sistema de notificaciones
    console.log(`Enviando notificación a usuario ${userId}: ${message}`);
};
// ✅ Exportar instancia única
exports.notificationService = NotificationService.getInstance();
