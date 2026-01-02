import { OCPPDatabaseService } from './ocpp.database.service';
import { connectionPool } from '../../../config/db.config';

export class OCPPService {
    private dbService: OCPPDatabaseService;
    private connectedChargers: Map<string, {
        wsConnection: any,
        chargePointId: string,
        lastHeartbeat: Date,
        status: string,
        ip?: string,
        isLocalWiFi?: boolean,
        vpnConnection?: boolean,
        connectionType?: string
    }> = new Map();

    constructor() {
        this.dbService = new OCPPDatabaseService();
        console.log('[OCPP] Servicio OCPP inicializado');
        this.resetAllChargersStatus();
    }

    // Resetear estado de todos los cargadores al iniciar
    private async resetAllChargersStatus() {
        try {
            console.log('[OCPP] Reseteando estado de conexion de todos los cargadores a offline...');
            await connectionPool.query(
                "UPDATE chargers SET network_status = 'offline' WHERE network_status = 'online'"
            );
            console.log('[OCPP] Estado de conexion reseteado correctamente');
        } catch (error) {
            console.error('[OCPP] Error reseteando estado de cargadores:', error);
        }
    }

    // Add method to get charger connection info including IP and type
    getChargerConnection(chargePointId: string) {
        const connection = this.connectedChargers.get(chargePointId);
        if (!connection) return null;

        const ip = connection.ip;
        const isLocalWiFi = ip && (
            ip.startsWith('192.168.') ||
            ip.startsWith('10.') ||
            (ip.startsWith('172.') &&
                parseInt(ip.split('.')[1]) >= 16 &&
                parseInt(ip.split('.')[1]) <= 31)
        );

        // Check for common VPN and internet IP types
        const isVPN = ip && (
            ip.startsWith('172.') ||  // Common VPN range
            ip.startsWith('10.') ||   // Could be VPN or local
            ip.includes('vpn') ||     // VPN in hostname
            ip.includes('tun') ||     // TUN/TAP interfaces
            ip.includes('ppp')        // Point-to-Point tunnels
        );

        let connectionType = 'desconectado';
        if (ip) {
            if (isLocalWiFi) connectionType = 'red_local';
            else if (isVPN) connectionType = 'vpn';
            else connectionType = 'internet';
        }

        return {
            chargePointId: connection.chargePointId,
            status: connection.status,
            lastHeartbeat: connection.lastHeartbeat,
            ip: connection.ip,
            isLocalWiFi: isLocalWiFi,
            vpnConnection: isVPN,
            connectionType: connectionType
        };
    }

    // ===== METODO SOLICITADO =====

    /**
     * Actualiza el heartbeat de un cargador para mantener consistencia
     * con el sistema de monitor de timeout automatico
     */
    updateChargerHeartbeat(chargePointId: string): void {
        const charger = this.connectedChargers.get(chargePointId);
        if (charger) {
            charger.lastHeartbeat = new Date();
            console.log(`[OCPP] Heartbeat actualizado para ${chargePointId}`);
        } else {
            console.warn(`[OCPP] Intento de actualizar heartbeat de cargador no conectado: ${chargePointId}`);
        }
    }

    // ===== FIN METODO SOLICITADO =====

    // Registrar cargador conectado
    async registerCharger(chargePointId: string, wsConnection: any): Promise<boolean> {
        console.log(`[OCPP] Registrando cargador en servicio OCPP - ID: ${chargePointId}`);

        // Verificar si el cargador existe en la base de datos
        const [rows] = await connectionPool.query(
            'SELECT * FROM chargers WHERE serial_number = ?',
            [chargePointId]
        ) as any[];

        if (rows.length === 0) {
            console.warn(`[OCPP] Cargador ${chargePointId} no encontrado en BD. Rechazando conexion.`);
            wsConnection.close();
            return false;
        }

        // Obtener IP del socket
        const req = wsConnection._socket || wsConnection.upgradeReq?.socket;
        let ip = req?.remoteAddress;
        // Limpiar formato IPv6 mapped to IPv4
        if (ip && ip.startsWith('::ffff:')) {
            ip = ip.substring(7);
        }

        // Detectar tipo de conexión
        const isLocalWiFi = ip && (
            ip.startsWith('192.168.') ||
            ip.startsWith('10.') ||
            (ip.startsWith('172.') &&
                parseInt(ip.split('.')[1]) >= 16 &&
                parseInt(ip.split('.')[1]) <= 31)
        );

        const isVPN = ip && (
            ip.startsWith('172.') ||
            ip.startsWith('10.') ||
            ip.includes('vpn') ||
            ip.includes('tun') ||
            ip.includes('ppp')
        );

        let connectionType = 'internet';
        if (isLocalWiFi) connectionType = 'red_local';
        else if (isVPN) connectionType = 'vpn';

        console.log(`[OCPP] Conexion detectada para ${chargePointId}: IP=${ip}, Tipo=${connectionType}`);

        // Guardar conexión en memoria
        this.connectedChargers.set(chargePointId, {
            wsConnection,
            chargePointId,
            lastHeartbeat: new Date(),
            status: 'Connected',
            ip,
            isLocalWiFi,
            vpnConnection: isVPN,
            connectionType
        });

        // Actualizar estado en BD
        try {
            await connectionPool.query(
                `UPDATE chargers SET 
                 network_status = 'online',
                 last_updated = NOW()
                 WHERE serial_number = ?`,
                [chargePointId]
            );
            console.log(`[OCPP] Estado actualizado en BD para ${chargePointId}: online`);
        } catch (error) {
            console.error(`[OCPP] Error actualizando estado en BD para ${chargePointId}:`, error);
        }

        return true;
    }

    // Desregistrar cargador
    async unregisterCharger(chargePointId: string) {
        console.log(`[OCPP] Desregistrando cargador ${chargePointId}`);
        this.connectedChargers.delete(chargePointId);

        try {
            await connectionPool.query(
                "UPDATE chargers SET network_status = 'offline', last_updated = NOW() WHERE serial_number = ?",
                [chargePointId]
            );
            console.log(`[OCPP] Estado actualizado en BD para ${chargePointId}: offline`);
        } catch (error) {
            console.error(`[OCPP] Error actualizando estado offline en BD para ${chargePointId}:`, error);
        }
    }

    // Enviar comando a cargador
    async sendCommand(chargePointId: string, action: string, payload: any): Promise<boolean> {
        console.log(`[OCPP] Intentando enviar comando ${action} a ${chargePointId}`);

        const charger = this.connectedChargers.get(chargePointId);
        if (!charger) {
            console.warn(`[OCPP] No se puede enviar comando: Cargador ${chargePointId} no esta conectado`);
            return false;
        }

        try {
            const uniqueId = Math.random().toString(36).substring(2, 15);
            // Mensaje tipo 2 (CALL)
            const message = [2, uniqueId, action, payload];

            if (charger.wsConnection.readyState === 1) { // OPEN
                charger.wsConnection.send(JSON.stringify(message));
                console.log(`[OCPP] Comando ${action} enviado a ${chargePointId} (ID: ${uniqueId})`);
                return true;
            } else {
                console.warn(`[OCPP] Socket no esta abierto para ${chargePointId}`);
                return false;
            }
        } catch (error) {
            console.error(`[OCPP] Error enviando comando a ${chargePointId}:`, error);
            return false;
        }
    }

    // Obtener lista de cargadores conectados
    getConnectedChargers() {
        const chargers: any[] = [];
        this.connectedChargers.forEach(charger => {
            chargers.push({
                chargePointId: charger.chargePointId,
                status: charger.status,
                lastHeartbeat: charger.lastHeartbeat,
                ip: charger.ip || 'unknown',
                connectionType: charger.connectionType || 'desconectado',
                isLocalWiFi: charger.isLocalWiFi || false,
                vpnConnection: charger.vpnConnection || false
            });
        });
        return chargers;
    }

    // Verificar si cargador esta conectado
    isChargerConnected(chargePointId: string): boolean {
        const isConnected = this.connectedChargers.has(chargePointId);
        console.log(`[OCPP] Verificando conexion de cargador ${chargePointId}: ${isConnected ? 'Conectado' : 'Desconectado'}`);
        return isConnected;
    }
}

// Exportar una instancia unica (Singleton)
export const ocppService = new OCPPService();