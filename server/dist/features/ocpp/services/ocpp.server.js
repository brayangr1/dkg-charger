"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCPPServer = void 0;
const ws_1 = __importDefault(require("ws"));
const uuid_1 = require("uuid");
const ocpp_database_service_1 = require("./ocpp.database.service");
const db_config_1 = require("../../../config/db.config");
const ocpp_types_1 = require("../types/ocpp.types");
const ocpp_service_1 = require("./ocpp.service");
class OCPPServer {
    constructor(port = 8887) {
        this.heartbeatInterval = 40; // 4 segundos
        // Propiedades para el monitor de heartbeat
        this.heartbeatCheckInterval = null;
        this.heartbeatTimeout = 40000; // 40 segundos en ms
        this.heartbeatCheckFrequency = 40000; // 40 segundos en ms
        this.wss = new ws_1.default.Server({ port });
        this.connections = new Map();
        this.dbService = new ocpp_database_service_1.OCPPDatabaseService();
        this.setupWebSocketServer();
        this.startHeartbeatMonitor(); // Iniciar monitor de heartbeat
        console.log(`[OCPP] Servidor iniciado en puerto ${port}`);
    }
    setupWebSocketServer() {
        this.wss.on('connection', async (ws, req) => {
            // Extraer IPv4 limpia si esta en formato IPv6
            const rawIP = req.socket.remoteAddress;
            const cleanIP = rawIP?.replace(/^::ffff:/, '') || rawIP;
            console.log(`[OCPP] Nueva conexion WebSocket entrante - IP: ${cleanIP}`);
            // Extraer el ID del punto de carga de la URL
            const chargePointId = this.extractChargePointId(req.url);
            if (!chargePointId) {
                console.error('[OCPP] ERROR: ID de punto de carga no proporcionado - Cerrando conexion');
                ws.close();
                return;
            }
            console.log(`[OCPP] ID de punto de carga extraido: ${chargePointId}`);
            // Intentar registrar el cargador en el servicio OCPP
            const registrationSuccess = await ocpp_service_1.ocppService.registerCharger(chargePointId, ws);
            if (!registrationSuccess) {
                console.error(`[OCPP] No se pudo registrar el cargador ${chargePointId} - No existe en la base de datos`);
                return; // La conexion ya fue cerrada por registerCharger
            }
            // Solo registrar la conexion si el registro en el servicio fue exitoso
            this.connections.set(chargePointId, {
                wsConnection: ws,
                chargePointId,
                lastHeartbeat: new Date(),
                status: ocpp_types_1.ChargePointStatus.Available
            });
            console.log(`[OCPP] Punto de carga CONECTADO: ${chargePointId}`);
            // Configurar handlers
            ws.on('message', async (message) => {
                try {
                    const text = message.toString().trim();
                    // Quick sanity check: OCPP messages are JSON arrays, so must start with '['
                    if (!text || text[0] !== '[') {
                        return;
                    }
                    const parsed = JSON.parse(text);
                    await this.handleOCPPMessage(ws, chargePointId, parsed);
                }
                catch (error) {
                    console.error('[OCPP] Error procesando mensaje:', (error instanceof Error) ? error.message : String(error));
                    try {
                        this.sendError(ws, "MessageFormatError", "Invalid message format");
                    }
                    catch (sendErr) {
                        // Ignorar error de envio
                    }
                }
            });
            ws.on('close', (code, reason) => {
                console.log(`[OCPP] Punto de carga DESCONECTADO: ${chargePointId}`);
                this.connections.delete(chargePointId);
                // Notificar al servicio OCPP que el cargador se desconecto
                ocpp_service_1.ocppService.unregisterCharger(chargePointId);
            });
            ws.on('error', (error) => {
                console.error(`[OCPP] Error en conexion ${chargePointId}:`, error.message);
                this.connections.delete(chargePointId);
            });
        });
    }
    // ===== SISTEMA DE HEARTBEAT TIMEOUT AUTOMATICO =====
    /**
     * Inicia el monitor de heartbeat que verifica periodicamente
     * las conexiones inactivas
     */
    startHeartbeatMonitor() {
        console.log(`[OCPP] Iniciando monitor de heartbeat - Chequeo cada ${this.heartbeatCheckFrequency / 1000} seg, timeout: ${this.heartbeatTimeout / 1000} seg`);
        this.heartbeatCheckInterval = setInterval(() => {
            this.checkHeartbeatTimeouts();
        }, this.heartbeatCheckFrequency);
    }
    /**
     * Verifica todas las conexiones activas y cierra aquellas
     * que excedan el timeout de heartbeat
     */
    checkHeartbeatTimeouts() {
        const now = Date.now();
        const timeoutCount = this.heartbeatTimeout;
        console.log(`[Heartbeat Monitor] Revisando ${this.connections.size} conexiones activas...`);
        for (const [chargePointId, connection] of this.connections.entries()) {
            const timeSinceLastHeartbeat = now - connection.lastHeartbeat.getTime();
            const minutesSinceHeartbeat = Math.floor(timeSinceLastHeartbeat / 120000);
            if (timeSinceLastHeartbeat > timeoutCount) {
                console.log(`[Heartbeat Monitor] Cargador ${chargePointId} sin heartbeat hace ${minutesSinceHeartbeat} min - TIMEOUT`);
                // Cerrar conexion WebSocket
                try {
                    connection.wsConnection.close();
                    console.log(`[OCPP] Cerrando conexion por timeout: ${chargePointId}`);
                }
                catch (closeError) {
                    console.error(`[OCPP] Error cerrando conexion de ${chargePointId}:`, closeError);
                }
                // Eliminar del mapa de conexiones
                this.connections.delete(chargePointId);
                // Notificar al servicio OCPP
                ocpp_service_1.ocppService.unregisterCharger(chargePointId);
                // Actualizar estado en base de datos
                this.updateChargerStatusInDB(chargePointId, 'offline')
                    .then(() => {
                    console.log(`[OCPP] Actualizando estado en BD para ${chargePointId} -> offline`);
                })
                    .catch(error => {
                    console.error(`[OCPP] Error actualizando estado en BD para ${chargePointId}:`, error);
                });
            }
        }
    }
    /**
     * Actualiza el estado del cargador en la base de datos
     */
    async updateChargerStatusInDB(chargePointId, status) {
        try {
            await db_config_1.connectionPool.query(`UPDATE chargers 
                 SET device_status = ?, 
                     status = ?,
                     last_updated = NOW()
                 WHERE serial_number = ?`, [status, status, chargePointId]);
        }
        catch (error) {
            console.error(`[OCPP] Error actualizando estado en BD para ${chargePointId}:`, error);
            throw error;
        }
    }
    /**
     * Detiene el monitor de heartbeat (para cleanup)
     */
    stopHeartbeatMonitor() {
        if (this.heartbeatCheckInterval) {
            clearInterval(this.heartbeatCheckInterval);
            this.heartbeatCheckInterval = null;
            console.log('[OCPP] Monitor de heartbeat detenido');
        }
    }
    // ===== FIN SISTEMA DE HEARTBEAT TIMEOUT =====
    extractChargePointId(url) {
        const match = url.match(/\/ocpp\/([^/]+)$/);
        return match ? match[1] : null;
    }
    async handleOCPPMessage(ws, chargePointId, message) {
        const messageTypeId = message[0];
        if (typeof messageTypeId !== 'number' || ![2, 3, 4].includes(messageTypeId)) {
            this.sendError(ws, "MessageTypeError", "Invalid message type");
            return;
        }
        if (messageTypeId === 2) { // Request
            const [, uniqueId, action, payload] = message;
            if (typeof action !== 'string' || typeof uniqueId !== 'string') {
                this.sendError(ws, "MessageFormatError", "Invalid message format");
                return;
            }
            await this.handleRequest(ws, chargePointId, uniqueId, action, payload);
        }
        else if (messageTypeId === 3) { // Response
            // Manejar respuestas si es necesario
        }
        else if (messageTypeId === 4) { // Error
            const [, uniqueId, errorCode, errorDescription, errorDetails] = message;
            console.error(`[OCPP] Error recibido de ${chargePointId}:`, { errorCode, errorDescription });
        }
    }
    async handleRequest(ws, chargePointId, uniqueId, action, payload) {
        console.log(`[OCPP] Procesando solicitud ${action} de ${chargePointId}`);
        switch (action) {
            case 'BootNotification':
                await this.handleBootNotification(ws, chargePointId, uniqueId, payload);
                break;
            case 'Heartbeat':
                await this.handleHeartbeat(ws, chargePointId, uniqueId);
                break;
            case 'Authorize':
                await this.handleAuthorize(ws, uniqueId, payload);
                break;
            case 'StatusNotification':
                await this.handleStatusNotification(ws, chargePointId, uniqueId, payload);
                break;
            case 'StartTransaction':
                await this.handleStartTransaction(ws, chargePointId, uniqueId, payload);
                break;
            case 'StopTransaction':
                await this.handleStopTransaction(ws, chargePointId, uniqueId, payload);
                break;
            case 'MeterValues':
                await this.handleMeterValues(ws, chargePointId, uniqueId, payload);
                break;
            default:
                console.warn(`[OCPP] Accion no soportada: ${action}`);
                this.sendError(ws, "NotImplemented", `Action ${action} not implemented`);
        }
    }
    async handleBootNotification(ws, chargePointId, uniqueId, payload) {
        console.log(`[OCPP] BootNotification de ${chargePointId}`);
        const result = await this.dbService.registerBootNotification(chargePointId, payload);
        const response = {
            status: result.status === 'Connected' ? ocpp_types_1.OCPPStatus.Accepted : ocpp_types_1.OCPPStatus.Rejected,
            currentTime: new Date().toISOString(),
            interval: this.heartbeatInterval
        };
        this.sendResponse(ws, uniqueId, response);
    }
    async handleStatusNotification(ws, chargePointId, uniqueId, payload) {
        console.log(`[OCPP] StatusNotification de ${chargePointId}: ${payload.status}`);
        // Actualizar estado en el mapa de conexiones
        const connection = this.connections.get(chargePointId);
        if (connection) {
            connection.status = payload.status;
            connection.lastHeartbeat = new Date();
        }
        // Actualizar en base de datos
        try {
            await db_config_1.connectionPool.query("UPDATE chargers SET status = ?, last_updated = NOW() WHERE serial_number = ?", [payload.status, chargePointId]);
        }
        catch (error) {
            console.error(`[OCPP] Error actualizando estado:`, error);
        }
        this.sendResponse(ws, uniqueId, {});
    }
    async handleMeterValues(ws, chargePointId, uniqueId, payload) {
        console.log(`[OCPP] MeterValues de ${chargePointId}`);
        // Procesar valores del medidor si es necesario
        if (payload.meterValue && Array.isArray(payload.meterValue)) {
            for (const val of payload.meterValue) {
                // Aqui se podria guardar el consumo en la base de datos
                // console.log(`[OCPP] Lectura de medidor:`, val);
            }
        }
        this.sendResponse(ws, uniqueId, {});
    }
    async handleHeartbeat(ws, chargePointId, uniqueId) {
        // console.log(`[OCPP] Heartbeat de ${chargePointId}`);
        // Actualizar timestamp en memoria
        const connection = this.connections.get(chargePointId);
        if (connection) {
            connection.lastHeartbeat = new Date();
        }
        // Actualizar tambien en el servicio singleton para consistencia
        ocpp_service_1.ocppService.updateChargerHeartbeat(chargePointId);
        // Actualizar en base de datos (opcional, para persistencia)
        await this.dbService.updateHeartbeat(chargePointId);
        const response = {
            currentTime: new Date().toISOString()
        };
        this.sendResponse(ws, uniqueId, response);
    }
    async handleAuthorize(ws, uniqueId, payload) {
        console.log(`[OCPP] Authorize para: ${payload.idTag}`);
        const response = {
            idTagInfo: {
                status: ocpp_types_1.OCPPStatus.Accepted,
                expiryDate: new Date(Date.now() + 86400000).toISOString() // 24 horas
            }
        };
        this.sendResponse(ws, uniqueId, response);
    }
    sendResponse(ws, uniqueId, payload) {
        const response = [3, uniqueId, payload];
        if (ws.readyState === ws_1.default.OPEN) {
            ws.send(JSON.stringify(response));
        }
    }
    sendError(ws, errorCode, errorDescription) {
        const uniqueId = (0, uuid_1.v4)(); // En caso de error generico
        const response = [4, uniqueId, errorCode, errorDescription, {}];
        if (ws.readyState === ws_1.default.OPEN) {
            ws.send(JSON.stringify(response));
        }
    }
    // Nuevos metodos para Start/Stop Transaction
    async handleStartTransaction(ws, chargePointId, uniqueId, payload) {
        console.log(`[OCPP] StartTransaction de ${chargePointId}`);
        const transactionId = Math.floor(Math.random() * 100000); // Generar ID simple
        const response = {
            transactionId,
            idTagInfo: {
                status: ocpp_types_1.OCPPStatus.Accepted,
                expiryDate: new Date(Date.now() + 86400000).toISOString()
            }
        };
        this.sendResponse(ws, uniqueId, response);
    }
    async handleStopTransaction(ws, chargePointId, uniqueId, payload) {
        console.log(`[OCPP] StopTransaction de ${chargePointId}`);
        const response = {
            idTagInfo: {
                status: ocpp_types_1.OCPPStatus.Accepted
            }
        };
        this.sendResponse(ws, uniqueId, response);
    }
}
exports.OCPPServer = OCPPServer;
