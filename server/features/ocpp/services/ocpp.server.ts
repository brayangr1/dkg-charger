import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { OCPPDatabaseService } from './ocpp.database.service';
import { connectionPool, deviceDbPool } from '../../../config/db.config';
import {
    OCPPMessage,
    ChargePointConnection,
    OCPPAction,
    OCPPStatus,
    ChargePointStatus,
    BootNotificationRequest,
    BootNotificationResponse,
    HeartbeatRequest,
    HeartbeatResponse,
    AuthorizeRequest,
    AuthorizeResponse,
    OCPPRequest,
    OCPPResponse,
    OCPPError,
    MessageType
} from '../types/ocpp.types';
import { ocppService } from './ocpp.service';

export class OCPPServer {
    private wss: WebSocket.Server;
    private connections: Map<string, ChargePointConnection>;
    private heartbeatInterval: number = 40; // 4 segundos
    private dbService: OCPPDatabaseService;

    // Propiedades para el monitor de heartbeat
    private heartbeatCheckInterval: NodeJS.Timeout | null = null;
    private heartbeatTimeout: number = 40000; // 40 segundos en ms
    private heartbeatCheckFrequency: number = 40000; // 40 segundos en ms

    constructor(port: number = 8887) {
        this.wss = new WebSocket.Server({ port });
        this.connections = new Map();
        this.dbService = new OCPPDatabaseService();
        this.setupWebSocketServer();
        this.startHeartbeatMonitor(); // Iniciar monitor de heartbeat
        console.log(`[OCPP] Servidor iniciado en puerto ${port}`);
    }

    private setupWebSocketServer() {
        this.wss.on('connection', async (ws: WebSocket, req: any) => {
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
            const registrationSuccess = await ocppService.registerCharger(chargePointId, ws);

            if (!registrationSuccess) {
                console.error(`[OCPP] No se pudo registrar el cargador ${chargePointId} - No existe en la base de datos`);
                return; // La conexion ya fue cerrada por registerCharger
            }

            // Solo registrar la conexion si el registro en el servicio fue exitoso
            this.connections.set(chargePointId, {
                wsConnection: ws,
                chargePointId,
                lastHeartbeat: new Date(),
                status: ChargePointStatus.Available
            });

            console.log(`[OCPP] Punto de carga CONECTADO: ${chargePointId}`);

            // Configurar handlers
            ws.on('message', async (message: string) => {
                try {
                    const text = message.toString().trim();
                    // Quick sanity check: OCPP messages are JSON arrays, so must start with '['
                    if (!text || text[0] !== '[') {
                        return;
                    }

                    const parsed = JSON.parse(text) as [MessageType, ...any[]];
                    await this.handleOCPPMessage(ws, chargePointId, parsed, cleanIP);
                } catch (error) {
                    console.error('[OCPP] Error procesando mensaje:', (error instanceof Error) ? error.message : String(error));
                    try {
                        this.sendError(ws, "MessageFormatError", "Invalid message format");
                    } catch (sendErr) {
                        // Ignorar error de envio
                    }
                }
            });

            ws.on('close', (code, reason) => {
                console.log(`[OCPP] Punto de carga DESCONECTADO: ${chargePointId}`);
                this.connections.delete(chargePointId);

                // Notificar al servicio OCPP que el cargador se desconecto
                ocppService.unregisterCharger(chargePointId);
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
    private startHeartbeatMonitor(): void {
        console.log(`[OCPP] Iniciando monitor de heartbeat - Chequeo cada ${this.heartbeatCheckFrequency / 1000} seg, timeout: ${this.heartbeatTimeout / 1000} seg`);

        this.heartbeatCheckInterval = setInterval(() => {
            this.checkHeartbeatTimeouts();
        }, this.heartbeatCheckFrequency) as any;
    }

    /**
     * Verifica todas las conexiones activas y cierra aquellas
     * que excedan el timeout de heartbeat
     */
    private checkHeartbeatTimeouts(): void {
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
                } catch (closeError) {
                    console.error(`[OCPP] Error cerrando conexion de ${chargePointId}:`, closeError);
                }

                // Eliminar del mapa de conexiones
                this.connections.delete(chargePointId);

                // Notificar al servicio OCPP
                ocppService.unregisterCharger(chargePointId);

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
    private async updateChargerStatusInDB(chargePointId: string, status: string): Promise<void> {
        try {
            await connectionPool.query(
                `UPDATE chargers 
                 SET device_status = ?, 
                     status = ?,
                     last_updated = NOW()
                 WHERE serial_number = ?`,
                [status, status, chargePointId]
            );
        } catch (error) {
            console.error(`[OCPP] Error actualizando estado en BD para ${chargePointId}:`, error);
            throw error;
        }
    }

    /**
     * Detiene el monitor de heartbeat (para cleanup)
     */
    public stopHeartbeatMonitor(): void {
        if (this.heartbeatCheckInterval) {
            clearInterval(this.heartbeatCheckInterval);
            this.heartbeatCheckInterval = null;
            console.log('[OCPP] Monitor de heartbeat detenido');
        }
    }

    // ===== FIN SISTEMA DE HEARTBEAT TIMEOUT =====

    private extractChargePointId(url: string): string | null {
        const match = url.match(/\/ocpp\/([^/]+)$/);
        return match ? match[1] : null;
    }

    // Enviar respuesta OCPP genérica

    private async handleOCPPMessage(
        ws: WebSocket,
        chargePointId: string,
        message: [MessageType, ...any[]],
        chargerIP?: string
    ) {
        const messageTypeId = message[0] as MessageType;

        if (typeof messageTypeId !== 'number' || ![2, 3, 4].includes(messageTypeId)) {
            this.sendError(ws, "MessageTypeError", "Invalid message type");
            return;
        }

        if (messageTypeId === 2) { // Request
            const [, uniqueId, action, payload] = message as OCPPRequest;

            if (typeof action !== 'string' || typeof uniqueId !== 'string') {
                this.sendError(ws, "MessageFormatError", "Invalid message format");
                return;
            }

            await this.handleRequest(ws, chargePointId, uniqueId, action, payload, chargerIP);
        } else if (messageTypeId === 3) { // Response
            // Manejar respuestas si es necesario
        } else if (messageTypeId === 4) { // Error
            const [, uniqueId, errorCode, errorDescription, errorDetails] = message as OCPPError;
            console.error(`[OCPP] Error recibido de ${chargePointId}:`, { errorCode, errorDescription });
        }
    }

    // Manejar solicitudes OCPP específicas (Request)
    private async handleRequest(
        ws: WebSocket,
        chargePointId: string,
        uniqueId: string,
        action: string,
        payload: any,
        chargerIP?: string
    ) {
        console.log(`[OCPP] Procesando solicitud ${action} de ${chargePointId}`);

        switch (action) {
            case 'BootNotification':
                await this.handleBootNotification(ws, chargePointId, uniqueId, payload, chargerIP);
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

    // Manejar BootNotification 
    private async handleBootNotification(
        ws: WebSocket,
        chargePointId: string,
        uniqueId: string,
        payload: BootNotificationRequest,
        chargerIP?: string
    ) {
        console.log(`[OCPP] BootNotification de ${chargePointId}`);

        const result = await this.dbService.registerBootNotification(chargePointId, payload, chargerIP);

        const response: BootNotificationResponse = {
            status: result.status === 'Connected' ? OCPPStatus.Accepted : OCPPStatus.Rejected,
            currentTime: new Date().toISOString(),
            interval: this.heartbeatInterval
        };

        this.sendResponse(ws, uniqueId, response);
    }

    // Manejar Heartbeat 
    private async handleStatusNotification(
        ws: WebSocket,
        chargePointId: string,
        uniqueId: string,
        payload: any
    ) {
        console.log(`[OCPP] StatusNotification de ${chargePointId}: ${payload.status}`);

        // Actualizar estado en el mapa de conexiones
        const connection = this.connections.get(chargePointId);
        if (connection) {
            connection.status = payload.status;
            connection.lastHeartbeat = new Date();
        }

        // Actualizar en base de datos
        try {
            await connectionPool.query(
                "UPDATE chargers SET status = ?, last_updated = NOW() WHERE serial_number = ?",
                [payload.status, chargePointId]
            );
        } catch (error) {
            console.error(`[OCPP] Error actualizando estado:`, error);
        }

        this.sendResponse(ws, uniqueId, {});
    }

    // Manejar MeterValues ( valores del medidor los valores se guardan en la base de datos se crea una tabla por 
    // cada cargador en la base de datos de dispositivos y se guarda un registro por cada lectura) 
    private async handleMeterValues(
        ws: WebSocket,
        chargePointId: string,
        uniqueId: string,
        payload: any
    ) {
        console.log(`[OCPP] MeterValues de ${chargePointId}`);

        try {
            // Extraer información importante del payload
            const { connectorId, transactionId, meterValue } = payload;
            
            // Validación mejorada
            if (!meterValue || !Array.isArray(meterValue)) {
                console.warn(`[OCPP] MeterValues inválidos para ${chargePointId}`);
                this.sendResponse(ws, uniqueId, {});
                return;
            }

            if (!transactionId) {
                console.warn(`[OCPP] MeterValues sin transactionId para ${chargePointId}`);
                this.sendResponse(ws, uniqueId, {});
                return;
            }

            console.log(`[DEBUG] Buscando cargador: ${chargePointId}, TransactionId: ${transactionId}`);

            // Buscar el cargador en la base de datos
            const [chargers]: [any[], any] = await connectionPool.query(
                `SELECT id, owner_id FROM chargers WHERE serial_number = ?`,
                [chargePointId]
            );

            if (chargers.length === 0) {
                console.warn(`[OCPP] Cargador no encontrado: ${chargePointId}`);
                this.sendResponse(ws, uniqueId, {});
                return;
            }

            const chargerId = chargers[0].id;
            const ownerId = chargers[0].owner_id;

            // Buscar sesión por ocpp_transaction_id - MEJORADO
            const [sessions]: [any[], any] = await connectionPool.query(
                `SELECT id, user_id, rate_per_kwh, max_power_used, total_energy
                FROM charging_sessions 
                WHERE ocpp_transaction_id = ? AND status = 'active'`,
                [transactionId]
            );

            console.log(`[DEBUG] Sesiones encontradas para TX ${transactionId}:`, sessions.length);
            
            if (sessions.length === 0) {
                console.warn(
                    `[OCPP] No se encontró sesión activa para transactionId: ${transactionId}. ` +
                    `Cargador: ${chargePointId}. Esto puede causar que max_power_used no se actualice.`
                );
            }

            const sessionId = sessions.length > 0 ? sessions[0].id : null;
            const existingMaxPower = sessions.length > 0 ? parseFloat(sessions[0].max_power_used) || 0 : 0;
            const ratePerKwh = sessions.length > 0 ? sessions[0].rate_per_kwh : 0.30;

            console.log(`[DEBUG] sessionId: ${sessionId}, existingMaxPower: ${existingMaxPower} kW`);

            // Procesar cada lectura de medidor
            let totalEnergy = 0;
            let maxPower = existingMaxPower; // Iniciar con el valor existente

            for (const meterVal of meterValue) {
                const { timestamp, sampledValue } = meterVal;
                
                // Validación mejorada
                if (!timestamp) {
                    console.warn(`[OCPP] MeterValue sin timestamp`);
                    continue;
                }

                if (!sampledValue || !Array.isArray(sampledValue)) {
                    console.warn(`[OCPP] MeterValue sin sampledValue válido`);
                    continue;
                }

                // Procesar cada muestra
                for (const sample of sampledValue) {
                    const { value, measurand, unit, context, format } = sample;
                    
                    // Validación mejorada
                    if (!value || isNaN(parseFloat(value))) {
                        console.warn(`[OCPP] Valor inválido: ${value} para ${measurand}`);
                        continue;
                    }

                    const numericValue = parseFloat(value);
                    
                    // Procesar energía activa importada
                    if (measurand === 'Energy.Active.Import.Register') {
                        let energyKwh = numericValue;
                        
                        // Convertir según unidad
                        if (unit === 'Wh') {
                            energyKwh = energyKwh / 1000;
                            console.log(`[DEBUG] Energía convertida: ${value} Wh -> ${energyKwh.toFixed(2)} kWh`);
                        }
                        
                        totalEnergy = energyKwh; // Último valor es el más reciente

                        console.log(
                            `[OCPP] Energía para TX ${transactionId}: ${energyKwh.toFixed(2)} kWh`
                        );

                        // Guardar en tabla de auditoría
                        try {
                            const [result]: [any, any] = await deviceDbPool.query(
                                `INSERT INTO meter_values_${chargePointId}
                                (charge_point_id, connector_id, transaction_id, timestamp, 
                                value, context, format, measurand, unit)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    chargePointId,
                                    connectorId || 1,
                                    transactionId,
                                    new Date(timestamp),
                                    value,
                                    context || 'Sample.Periodic',
                                    format || 'Raw',
                                    measurand,
                                    unit
                                ]
                            );
                            console.log(`[DEBUG] Energía guardada. ID:`, result.insertId);
                        } catch (err: unknown) {
                            const error = err as Error & { sql?: string };
                            console.error(`[OCPP] Error guardando energía en meter_values:`, error.message);
                            if (error.sql) {
                                console.error(`[OCPP] SQL Error:`, error.sql);
                            }
                        }
                    }
                    
                    // Procesar potencia activa importada - CORREGIDO
                    if (measurand === 'Power.Active.Import') {
                        let powerKw = numericValue;
                        
                        // Convertir según unidad
                        if (unit === 'W') {
                            powerKw = powerKw / 1000;
                            console.log(`[DEBUG] Potencia convertida: ${value} W -> ${powerKw.toFixed(2)} kW`);
                        } else if (unit === 'kW') {
                            // Ya está en kW
                            console.log(`[DEBUG] Potencia en kW: ${value} kW`);
                        } else {
                            console.warn(`[OCPP] Unidad desconocida para potencia: ${unit}, valor: ${value}`);
                        }
                        
                        // TOMAR EL MÁXIMO, NO SOBREESCRIBIR
                        maxPower = Math.max(maxPower, powerKw);
                        
                        console.log(
                            `[OCPP] Potencia para TX ${transactionId}: ${powerKw.toFixed(2)} kW | Máximo actual: ${maxPower.toFixed(2)} kW`
                        );

                        // Guardar en tabla de auditoría
                        try {
                            const [result]: [any, any] = await deviceDbPool.query(
                                `INSERT INTO meter_values_${chargePointId}
                                (charge_point_id, connector_id, transaction_id, timestamp, 
                                value, context, format, measurand, unit)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    chargePointId,
                                    connectorId || 1,
                                    transactionId,
                                    new Date(timestamp),
                                    value,
                                    context || 'Sample.Periodic',
                                    format || 'Raw',
                                    measurand,
                                    unit
                                ]
                            );
                            console.log(`[DEBUG] Potencia guardada. ID:`, result.insertId);
                        } catch (err: unknown) {
                            const error = err as Error & { sql?: string };
                            console.error(`[OCPP] Error guardando potencia en meter_values:`, error.message);
                            if (error.sql) {
                                console.error(`[OCPP] SQL Error:`, error.sql);
                            }
                        }
                    }
                }
            }

            // Actualizar charging_sessions en tiempo real - CORREGIDO
            if (sessionId && (totalEnergy > 0 || maxPower > 0)) {
                const estimatedCost = (totalEnergy * ratePerKwh).toFixed(2);
                
                console.log(`[DEBUG] Actualizando sesión ${sessionId}:`);
                console.log(`[DEBUG] - total_energy: ${totalEnergy.toFixed(2)} kWh`);
                console.log(`[DEBUG] - max_power_used: ${maxPower.toFixed(2)} kW (máximo entre ${existingMaxPower} y ${maxPower})`);
                console.log(`[DEBUG] - estimated_cost: €${estimatedCost}`);
                
                try {
                    const [result]: [any, any] = await connectionPool.query(
                        `UPDATE charging_sessions 
                        SET total_energy = ?,
                            max_power_used = GREATEST(COALESCE(max_power_used, 0), ?),
                            estimated_cost = ?,
                            rate_per_kwh = ?,
                            last_meter_update = NOW()
                        WHERE id = ?`,
                        [
                            totalEnergy.toFixed(2),
                            maxPower.toFixed(2),
                            estimatedCost,
                            ratePerKwh,
                            sessionId
                        ]
                    );
                    
                    console.log(`[DEBUG] Sesión actualizada. Filas afectadas:`, result.affectedRows);
                    
                    // Verificar que se actualizó correctamente
                    if (result.affectedRows === 0) {
                        console.warn(`[OCPP] ¡CUIDADO! No se actualizó ninguna fila para sessionId ${sessionId}`);
                    }
                    
                    console.log(
                        `[OCPP] ✅ Sesión ${sessionId} actualizada: ` +
                        `${totalEnergy.toFixed(2)} kWh | ${maxPower.toFixed(2)} kW | €${estimatedCost} ` +
                        `(Tarifa: €${ratePerKwh}/kWh)`
                    );
                    
                } catch (err: unknown) {
                    const error = err as Error & { sql?: string };
                    console.error(
                        `[OCPP] ❌ Error actualizando charging_sessions ${sessionId}:`, error.message
                    );
                    if (error.sql) {
                        console.error(`[OCPP] SQL Error:`, error.sql);
                    }
                }
            } else {
                if (!sessionId) {
                    console.warn(`[OCPP] No se actualizó charging_sessions porque sessionId es null`);
                } else {
                    console.warn(`[OCPP] No se actualizó charging_sessions porque totalEnergy (${totalEnergy}) y maxPower (${maxPower}) son 0`);
                }
            }

            // NUEVO: También actualizar la tabla general meter_values para compatibilidad
            try {
                const [syncResult]: [any, any] = await connectionPool.query(
                    `INSERT INTO meter_values 
                    (charge_point_id, connector_id, transaction_id, timestamp, 
                    value, context, format, measurand, unit)
                    SELECT charge_point_id, connector_id, transaction_id, timestamp, 
                            value, context, format, measurand, unit
                    FROM meter_values_${chargePointId}
                    WHERE transaction_id = ? 
                    AND timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
                    ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
                    [transactionId]
                );
                console.log(`[DEBUG] Datos sincronizados en tabla general meter_values. Filas afectadas:`, syncResult.affectedRows);
            } catch (err: unknown) {
                const error = err as Error;
                console.warn(`[OCPP] Error sincronizando con tabla general:`, error.message);
            }

        } catch (error: unknown) {
            const err = error as Error;
            console.error(`[OCPP] ❌ Error procesando MeterValues para ${chargePointId}:`, err);
            console.error(err.stack);
        }

        // Enviar respuesta inmediata al cargador
        this.sendResponse(ws, uniqueId, {});
    }
// Manejar Heartbeat 
    private async handleHeartbeat(
        ws: WebSocket,
        chargePointId: string,
        uniqueId: string
    ) {
        // console.log(`[OCPP] Heartbeat de ${chargePointId}`);

        // Actualizar timestamp en memoria
        const connection = this.connections.get(chargePointId);
        if (connection) {
            connection.lastHeartbeat = new Date();
        }

        // Actualizar tambien en el servicio singleton para consistencia
        ocppService.updateChargerHeartbeat(chargePointId);

        // Actualizar en base de datos (opcional, para persistencia)
        await this.dbService.updateHeartbeat(chargePointId);

        const response: HeartbeatResponse = {
            currentTime: new Date().toISOString()
        };

        this.sendResponse(ws, uniqueId, response);
    }

// Manejar Authorize ( autorizacion de usuario )
    private async handleAuthorize(
        ws: WebSocket,
        uniqueId: string,
        payload: AuthorizeRequest
    ) {
        console.log(`[OCPP] Authorize para: ${payload.idTag}`);

        const response: AuthorizeResponse = {
            idTagInfo: {
                status: OCPPStatus.Accepted,
                expiryDate: new Date(Date.now() + 86400000).toISOString() // 24 horas
            }
        };

        this.sendResponse(ws, uniqueId, response);
    }

    private sendResponse(ws: WebSocket, uniqueId: string, payload: any) {
        const response = [3, uniqueId, payload];
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(response));
        }
    }

    private sendError(ws: WebSocket, errorCode: string, errorDescription: string) {
        const uniqueId = uuidv4(); // En caso de error generico
        const response = [4, uniqueId, errorCode, errorDescription, {}];
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(response));
        }
    }

    // Nuevos metodos para Start/Stop Transaction
    // ...funcionales completos...
    private async handleStartTransaction(
        ws: WebSocket,
        chargePointId: string,
        uniqueId: string,
        payload: any
    ) {
        console.log(`[OCPP] StartTransaction de ${chargePointId}`, payload);

        const transactionId = Math.floor(Math.random() * 100000); // Generar ID simple

        // Guardar la transacción en base de datos
        try {
            // Obtener el charger_id
            const [chargerResult] = await connectionPool.query(
                `SELECT id FROM chargers WHERE serial_number = ?`,
                [chargePointId]
            ) as any;

            if (chargerResult.length === 0) {
                console.error(`[OCPP] Cargador no encontrado en BD: ${chargePointId}`);
                this.sendError(ws, "InternalError", "Charger not found in database");
                const response = {
                    transactionId,
                    idTagInfo: {
                        status: OCPPStatus.Rejected,
                        expiryDate: new Date(Date.now() + 86400000).toISOString()
                    }
                };
                this.sendResponse(ws, uniqueId, response);
                return;
            }

            const chargerId = chargerResult[0].id;

            // Insertar en transactions
            const [transactionResult] = await connectionPool.query(
                `INSERT INTO transactions (charger_id, connector_id, id_tag, start_timestamp, meter_start, status)
                 VALUES (?, ?, ?, NOW(), 0, 'active')`,
                [chargerId, payload.connectorId || 1, payload.idTag || 'unknown']
            ) as any;

            const dbTransactionId = (transactionResult as any).insertId;
            console.log(`[OCPP] Transacción guardada en BD: ${dbTransactionId} para ${chargePointId}`);

            // Obtener user_id si existe (si idTag es un número, asumir que es user_id)
            let userId = null;
            try {
                const tagAsNumber = parseInt(payload.idTag, 10);
                if (!isNaN(tagAsNumber)) {
                    userId = tagAsNumber;
                }
            } catch (e) {
                console.log(`[OCPP] No se pudo convertir idTag a número: ${payload.idTag}`);
            }

            // Insertar en charging_sessions
            if (userId) {
                // Obtener rate_per_kwh de charger_users
                const [chargerUserResult] = await connectionPool.query(
                    `SELECT rate_per_kwh FROM charger_users WHERE charger_id = ? AND user_id = ?`,
                    [chargerId, userId]
                ) as any;

                const ratePerKwh = chargerUserResult.length > 0 ? chargerUserResult[0].rate_per_kwh : 0.30;

                const [sessionResult] = await connectionPool.query(
                    `INSERT INTO charging_sessions 
                     (charger_id, user_id, start_time, charging_mode, ocpp_transaction_id, status, rate_per_kwh)
                     VALUES (?, ?, NOW(), 'grid', ?, 'active', ?)`,
                    [chargerId, userId, transactionId, ratePerKwh]
                ) as any;

                const chargingSessionId = (sessionResult as any).insertId;
                console.log(
                    `[OCPP] Sesión de carga creada: ${chargingSessionId} ` +
                    `(OCPP TX: ${transactionId}) para usuario ${userId} en cargador ${chargePointId} ` +
                    `(Tarifa: €${ratePerKwh}/kWh)`
                );
            }

            // Actualizar estado del cargador a 'charging'
            await connectionPool.query(
                `UPDATE chargers SET status = 'charging', last_updated = NOW() WHERE serial_number = ?`,
                [chargePointId]
            );

        } catch (error) {
            console.error(`[OCPP] Error guardando StartTransaction para ${chargePointId}:`, error);
        }

        const response = {
            idTagInfo: {
                status: OCPPStatus.Accepted,
                expiryDate: new Date(Date.now() + 86400000).toISOString()
            },
            transactionId,
        };

        this.sendResponse(ws, uniqueId, response);
    }

    private async handleStopTransaction(
        ws: WebSocket,
        chargePointId: string,
        uniqueId: string,
        payload: any
    ) {
        console.log(`[OCPP] StopTransaction de ${chargePointId}`, payload);

        // Marcar la transacción como detenida en base de datos y actualizar charging_sessions
        try {
            // Obtener el charger_id
            const [chargerResult] = await connectionPool.query(
                `SELECT id FROM chargers WHERE serial_number = ?`,
                [chargePointId]
            ) as any;

            if (chargerResult.length === 0) {
                console.error(`[OCPP] Cargador no encontrado en BD: ${chargePointId}`);
                this.sendError(ws, "InternalError", "Charger not found in database");
                const response = {
                    idTagInfo: {
                        status: OCPPStatus.Rejected
                    }
                };
                this.sendResponse(ws, uniqueId, response);
                return;
            }

            const chargerId = chargerResult[0].id;

            // Obtener la transacción activa más reciente
            const [transactionResult] = await connectionPool.query(
                `SELECT id FROM transactions 
                 WHERE charger_id = ? AND status = 'active'
                 ORDER BY id DESC LIMIT 1`,
                [chargerId] 
            ) as any;

            if (transactionResult.length > 0) {
                const txId = transactionResult[0].id;

                // Actualizar transaction
                await connectionPool.query(
                    `UPDATE transactions 
                     SET status = 'stopped', end_time = NOW(), meter_stop = ?
                     WHERE id = ?`,
                    [payload.meterStop || 0, txId]
                );

                console.log(`[OCPP] Transacción ${txId} detenida para ${chargePointId}`);
            }

            // Obtener la sesión de carga activa más reciente para actualizar
            const [sessionResult] = await connectionPool.query(
                `SELECT cs.id, cs.start_time, cs.charger_id, cs.user_id, cs.rate_per_kwh
                 FROM charging_sessions cs
                 WHERE cs.charger_id = ? AND cs.end_time IS NULL
                 ORDER BY cs.id DESC LIMIT 1`,
                [chargerId]
            ) as any;

            if (sessionResult.length > 0) {
                const session = sessionResult[0];
                const sessionId = session.id;
                const startTime = new Date(session.start_time);
                const endTime = new Date();

                // Calcular duración en segundos
                const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

                // Calcular energía (en Wh del medidor dividido 1000 = kWh)
                const meterStop = payload.meterStop || 0;
                const totalEnergy = Math.max(0, meterStop / 1000); // Convertir Wh a kWh

                // Obtener rate_per_kwh de la sesión (ya está guardado durante StartTransaction)
                const ratePerKwh = session.rate_per_kwh || 0.30;
                const estimatedCost = totalEnergy * ratePerKwh;

                // Actualizar charging_sessions
                // NO sobrescribir max_power_used porque ya fue actualizado correctamente durante MeterValues
                await connectionPool.query(
                    `UPDATE charging_sessions 
                     SET end_time = NOW(), 
                         total_energy = ?,
                         duration_seconds = ?,
                         estimated_cost = ?
                     WHERE id = ?`,
                    [
                        totalEnergy.toFixed(2),
                        durationSeconds,
                        estimatedCost.toFixed(2),
                        sessionId
                    ]
                );

                console.log(`[OCPP] Sesión de carga ${sessionId} completada:
                  - Usuario: ${session.user_id}
                  - Duración: ${durationSeconds}s (${(durationSeconds/60).toFixed(2)} min)
                  - Energía: ${totalEnergy.toFixed(2)} kWh
                  - Costo estimado: €${estimatedCost.toFixed(2)}`);
            } else {
                console.warn(`[OCPP] No se encontró sesión activa para el cargador ${chargePointId}`);
            }

            // Actualizar estado del cargador a 'available'
            await connectionPool.query(
                `UPDATE chargers SET status = 'available', last_updated = NOW() WHERE serial_number = ?`,
                [chargePointId]
            );

        } catch (error) {
            console.error(`[OCPP] Error procesando StopTransaction para ${chargePointId}:`, error);
        }

        const response = {
            idTagInfo: {
                status: OCPPStatus.Accepted
            }
        };

        this.sendResponse(ws, uniqueId, response);
    }
}