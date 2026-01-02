"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = void 0;
const express_1 = require("express");
const ocpp_service_1 = require("../services/ocpp.service");
const db_config_1 = require("../../../config/db.config");
const env_config_1 = require("../../../config/env.config");
const router = (0, express_1.Router)();
exports.default = router;
// const ocppService = new OCPPService(); // Removed instantiation, using singleton imported above
// Endpoint unificado para agregar cargadores - Bluetooth, QR, Manual, WiFi
router.post('/register-charger', async (req, res) => {
    try {
        console.log('Solicitud POST /register-charger recibida');
        console.log(' Cuerpo de la solicitud:', req.body);
        const { serial, name, method = 'manual', // 'bluetooth' | 'qr' | 'manual' | 'wifi'
        bluetoothId, model = 'OCPP', max_power = 32, firmware_version = '1.0', owner_id = null, wifi_ssid, wifi_password } = req.body;
        // Validaciones básicas
        if (!serial) {
            console.warn(' Número de serie requerido para registro de cargador');
            return res.status(400).json({
                success: false,
                error: 'Número de serie requerido'
            });
        }
        console.log(` [register-charger] Registrando cargador: ${serial}, método: ${method}`);
        // Validar serial
        const trimmedSerial = serial.trim();
        if (!trimmedSerial) {
            console.warn(' Serial no válido para registro de cargador');
            return res.status(400).json({
                success: false,
                error: 'Serial no válido'
            });
        }
        // 1. VERIFICAR SI EL CARGADOR YA EXISTE
        console.log(` Verificando si cargador ${trimmedSerial} ya existe en base de datos`);
        const [existingRows] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [trimmedSerial]);
        if (existingRows.length > 0) {
            const existingCharger = existingRows[0];
            console.log(` [register-charger] Cargador ${trimmedSerial} ya existe`, existingCharger);
            return res.json({
                success: true,
                charger: existingCharger,
                message: 'Cargador ya estaba registrado',
                already_exists: true
            });
        }
        // 2. DETERMINAR TIPO DE CARGADOR (DKG vs OCPP)
        let chargerType = 'ocpp'; // Por defecto asumimos OCPP
        let deviceData = null;
        try {
            console.log(` Verificando si ${trimmedSerial} es un cargador DKG`);
            // Buscar en devices_db para ver si es DKG
            const [deviceRows] = await db_config_1.deviceDbPool.query('SELECT * FROM devices WHERE serial = ?', [trimmedSerial]);
            if (deviceRows.length > 0) {
                chargerType = 'dkg';
                deviceData = deviceRows[0];
                console.log(` [register-charger] Cargador ${trimmedSerial} detectado como DKG`);
            }
            else {
                // Verificar si tiene tablas en devices_db (backup check)
                console.log(` Verificando tablas de dispositivo para ${trimmedSerial}`);
                const [tables] = await db_config_1.deviceDbPool.query("SHOW TABLES LIKE ?", [`action_${trimmedSerial}`]);
                const [logTables] = await db_config_1.deviceDbPool.query("SHOW TABLES LIKE ?", [`charging_log_${trimmedSerial}`]);
                if (tables.length > 0 || logTables.length > 0) {
                    chargerType = 'dkg';
                    console.log(` [register-charger] Cargador ${trimmedSerial} detectado como DKG por tablas existentes`);
                }
                else {
                    console.log(` [register-charger] Cargador ${trimmedSerial} determinado como tipo OCPP`);
                }
            }
        }
        catch (dbError) {
            console.warn(` [register-charger] Error verificando devices_db: ${dbError}`);
            // Continuamos con OCPP por defecto
        }
        console.log(` [register-charger] Tipo final: ${chargerType} para ${trimmedSerial}`);
        // 3. PREPARAR DATOS DEL CARGADOR
        const chargerName = name || `Cargador ${trimmedSerial.substring(trimmedSerial.length - 4)}`;
        const chargerData = {
            serial_number: trimmedSerial,
            name: chargerName,
            model: model,
            max_power: max_power,
            firmware_version: firmware_version,
            mac_address: '',
            owner_id: owner_id,
            charger_type: chargerType,
            network_status: 'offline',
            status: 'standby',
            registered_at: new Date(),
            last_updated: new Date()
        };
        // 4. INSERTAR EN LA BASE DE DATOS
        const [insertResult] = await db_config_1.connectionPool.query(`INSERT INTO chargers SET ?`, [chargerData]);
        const chargerId = insertResult.insertId;
        // Actualizar objeto con ID generado
        const finalCharger = {
            id: chargerId,
            ...chargerData
        };
        console.log(`[register-charger] Cargador insertado con ID: ${chargerId}`);
        // 5. CONFIGURACIÓN ADICIONAL SEGÚN TIPO
        if (chargerType === 'dkg') {
            // Para DKG: crear tablas, grupos, etc. (similar a tu endpoint /add actual)
            await setupDkgCharger(finalCharger, owner_id, deviceData);
        }
        else {
            // Para OCPP: configuración mínima
            await setupOcppCharger(finalCharger, owner_id);
        }
        // 6. CONFIGURAR WiFi SI SE PROPORCIONA
        if (wifi_ssid) {
            try {
                await configureChargerWifi(trimmedSerial, wifi_ssid, wifi_password, chargerType);
                console.log(`[register-charger] Configuración WiFi programada para ${trimmedSerial}`);
            }
            catch (wifiError) {
                console.warn(`[register-charger] Error configurando WiFi: ${wifiError}`);
                // No fallamos el registro por error en WiFi
            }
        }
        // 7. RESPUESTA FINAL
        const response = {
            success: true,
            charger: finalCharger,
            message: `Cargador ${chargerType.toUpperCase()} registrado exitosamente`,
            charger_type: chargerType,
            method: method,
            wifi_configured: !!wifi_ssid
        };
        console.log(`[register-charger] Registro completado: ${JSON.stringify(response)}`);
        return res.json(response);
    }
    catch (error) {
        console.error('[register-charger] Error general:', error);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor al registrar cargador',
            details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
        });
    }
});
router.post('/register-bluetooth', async (req, res) => {
    try {
        // Mantener compatibilidad con el formato actual del móvil
        let { id, name, bluetoothId, model = 'OCPP', max_power = 32, firmware_version = '1.0', owner_id = null } = req.body;
        // Usar el serial number como identificador principal
        const serial = id || req.body.serial;
        console.log(`[register-bluetooth] Registrando cargador: ${serial}, bluetoothId: ${bluetoothId}`);
        if (!serial || !bluetoothId) {
            return res.status(400).json({
                success: false,
                error: 'Campos requeridos: serial/id y bluetoothId'
            });
        }
        // Validar serial
        const trimmedSerial = serial.trim();
        if (!trimmedSerial) {
            return res.status(400).json({
                success: false,
                error: 'Serial no válido'
            });
        }
        // 1. VERIFICAR SI EL CARGADOR YA EXISTE
        const [existingRows] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [trimmedSerial]);
        let charger;
        let alreadyExists = false;
        // 2. DETERMINAR TIPO DE CARGADOR
        let chargerType = 'ocpp';
        let deviceData = null;
        try {
            const [deviceRows] = await db_config_1.deviceDbPool.query('SELECT * FROM devices WHERE serial = ?', [trimmedSerial]);
            if (deviceRows.length > 0) {
                chargerType = 'dkg';
                deviceData = deviceRows[0];
                console.log(`[register-bluetooth] Cargador ${trimmedSerial} detectado como DKG`);
            }
            else {
                const [tables] = await db_config_1.deviceDbPool.query("SHOW TABLES LIKE ?", [`action_${trimmedSerial}`]);
                if (tables.length > 0) {
                    chargerType = 'dkg';
                    console.log(`[register-bluetooth] Cargador ${trimmedSerial} detectado como DKG por tablas`);
                }
            }
        }
        catch (dbError) {
            console.warn(`[register-bluetooth] Error verificando devices_db: ${dbError}`);
            // Continuamos con OCPP por defecto
        }
        if (existingRows.length > 0) {
            // Actualizar cargador existente
            charger = existingRows[0];
            alreadyExists = true;
            console.log(`[register-bluetooth] Actualizando cargador existente ${trimmedSerial}`);
            await db_config_1.connectionPool.query(`UPDATE chargers SET 
          name = ?,
          model = ?,
          max_power = ?,
          firmware_version = ?,
          owner_id = ?,
          mac_address = ?,
          bluetooth_connected = TRUE,
          last_bluetooth_connection = NOW(),
          last_updated = NOW()
         WHERE id = ?`, [
                name || charger.name,
                model,
                max_power,
                firmware_version,
                owner_id || charger.owner_id,
                bluetoothId,
                charger.id
            ]);
            // Actualizar el objeto charger con los nuevos valores
            charger = {
                ...charger,
                name: name || charger.name,
                model,
                max_power,
                firmware_version,
                owner_id: owner_id || charger.owner_id,
                mac_address: bluetoothId,
                bluetooth_connected: true,
                last_bluetooth_connection: new Date(),
                last_updated: new Date()
            };
        }
        else {
            // Crear nuevo cargador
            const chargerName = name || `Cargador ${trimmedSerial.substring(trimmedSerial.length - 4)}`;
            const chargerData = {
                serial_number: trimmedSerial,
                name: chargerName,
                model: model,
                max_power: max_power,
                firmware_version: firmware_version,
                mac_address: bluetoothId,
                owner_id: owner_id,
                charger_type: chargerType,
                network_status: 'offline',
                status: 'standby',
                bluetooth_connected: true,
                last_bluetooth_connection: new Date(),
                registered_at: new Date(),
                last_updated: new Date()
            };
            const [insertResult] = await db_config_1.connectionPool.query(`INSERT INTO chargers SET ?`, [chargerData]);
            const chargerId = insertResult.insertId;
            charger = {
                id: chargerId,
                ...chargerData
            };
            console.log(`[register-bluetooth] Nuevo cargador insertado con ID: ${chargerId}`);
            // Configuración adicional según tipo
            if (chargerType === 'dkg') {
                await setupDkgCharger(charger, owner_id, deviceData);
            }
            else {
                await setupOcppCharger(charger, owner_id);
            }
        }
        // 6. RESPUESTA FINAL (mantener formato compatible)
        const response = {
            success: true,
            charger: charger,
            message: alreadyExists ?
                'Cargador actualizado correctamente' :
                `Cargador ${charger.charger_type?.toUpperCase()} registrado exitosamente`,
            normalized_serial: trimmedSerial
        };
        if (!alreadyExists) {
            response.charger_type = charger.charger_type;
        }
        console.log(`[register-bluetooth] Proceso completado: ${JSON.stringify(response)}`);
        return res.json(response);
    }
    catch (error) {
        console.error('[register-bluetooth] Error general:', error);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor al registrar cargador'
        });
    }
});
// Obtener estado de cargadores conectados
router.get('/connected-chargers', async (req, res) => {
    try {
        const connectedChargers = ocpp_service_1.ocppService.getConnectedChargers();
        res.json({ success: true, chargers: connectedChargers });
    }
    catch (error) {
        console.error('Error obteniendo cargadores conectados:', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});
// Verificar estado de un cargador específico
router.get('/status/:serial', async (req, res) => {
    try {
        const serial = req.params.serial;
        if (!serial) {
            return res.status(400).json({ success: false, error: 'serial requerido' });
        }
        // Verificar en base de datos incluyendo estado Bluetooth
        const [dbRows] = await db_config_1.connectionPool.query(`SELECT id, serial_number, status, network_status, last_updated,
                    bluetooth_connected, last_bluetooth_connection, wifi_ssid
             FROM chargers 
             WHERE serial_number = ?`, [serial]);
        const chargers = dbRows;
        if (chargers.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado en base de datos'
            });
        }
        const charger = chargers[0];
        const ocppConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        // Si el cargador está conectado por OCPP, actualizar estado en la base de datos
        if (ocppConnected && charger.network_status !== 'online') {
            await db_config_1.connectionPool.query('UPDATE chargers SET network_status = ?, last_updated = NOW() WHERE serial_number = ?', ['online', serial]);
            charger.network_status = 'online';
            charger.last_updated = new Date();
        }
        // Obtener transacción activa si existe
        const [activeTxRows] = await db_config_1.connectionPool.query('SELECT id FROM transactions WHERE charger_id = ? AND status = \'active\' ORDER BY id DESC LIMIT 1', [charger.id]);
        const activeTransactionId = activeTxRows.length > 0 ? activeTxRows[0].id : null;
        res.json({
            success: true,
            charger: {
                serial: charger.serial_number,
                status: charger.status,
                networkStatus: charger.network_status,
                connected: ocppConnected,
                bluetoothStatus: {
                    connected: charger.bluetooth_connected || false,
                    lastConnection: charger.last_bluetooth_connection
                },
                wifi_ssid: charger.wifi_ssid,
                lastUpdated: charger.last_updated,
                activeTransactionId: activeTransactionId
            }
        });
    }
    catch (error) {
        console.error('Error consultando estado:', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});
// Comando: Iniciar carga remota
router.post('/remote-start/:serial', async (req, res) => {
    try {
        const serial = req.params.serial;
        const { connectorId = 1, idTag } = req.body;
        console.log(` [OCPP-API] Recibida solicitud de INICIO de carga remota para: ${serial}`);
        console.log(` [OCPP-API] Datos de inicio: ConnectorId=${connectorId}, IdTag=${idTag}`);
        if (!serial) {
            console.warn(` [OCPP-API] Falta serial en solicitud de inicio`);
            return res.status(400).json({ success: false, error: 'serial requerido' });
        }
        if (!idTag) {
            console.warn(` [OCPP-API] Falta idTag en solicitud de inicio para ${serial}`);
            return res.status(400).json({
                success: false,
                error: 'idTag requerido'
            });
        }
        const payload = {
            connectorId,
            idTag
        };
        console.log(` [OCPP-API] Enviando comando RemoteStartTransaction a ${serial}...`);
        const success = await ocpp_service_1.ocppService.sendCommand(serial, 'RemoteStartTransaction', payload);
        if (success) {
            console.log(` [OCPP-API] Comando de INICIO enviado exitosamente a ${serial}`);
            res.json({
                success: true,
                message: 'Comando de inicio enviado correctamente'
            });
        }
        else {
            console.error(` [OCPP-API] Falló el envío del comando de INICIO a ${serial} (¿Cargador desconectado?)`);
            res.status(400).json({
                success: false,
                error: 'Cargador no conectado'
            });
        }
    }
    catch (error) {
        console.error(` [OCPP-API] Error crítico procesando remote-start para ${req.params.serial}:`, error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});
// Comando: Detener carga remota
router.post('/remote-stop/:serial', async (req, res) => {
    try {
        const serial = req.params.serial;
        const { transactionId } = req.body;
        console.log(` [OCPP-API] Recibida solicitud de PARADA de carga remota para: ${serial}`);
        console.log(` [OCPP-API] Datos de parada: TransactionId=${transactionId}`);
        if (!serial) {
            console.warn(` [OCPP-API] Falta serial en solicitud de parada`);
            return res.status(400).json({ success: false, error: 'serial requerido' });
        }
        if (!transactionId) {
            console.warn(` [OCPP-API] Falta transactionId en solicitud de parada para ${serial}`);
            return res.status(400).json({
                success: false,
                error: 'transactionId requerido'
            });
        }
        const payload = {
            transactionId: parseInt(transactionId)
        };
        console.log(` [OCPP-API] Enviando comando RemoteStopTransaction a ${serial} (Transacción: ${transactionId})...`);
        const success = await ocpp_service_1.ocppService.sendCommand(serial, 'RemoteStopTransaction', payload);
        if (success) {
            console.log(` [OCPP-API] Comando de PARADA enviado exitosamente a ${serial}`);
            res.json({
                success: true,
                message: 'Comando de detención enviado correctamente'
            });
        }
        else {
            console.error(` [OCPP-API] Falló el envío del comando de PARADA a ${serial} (¿Cargador desconectado?)`);
            res.status(400).json({
                success: false,
                error: 'Cargador no conectado'
            });
        }
    }
    catch (error) {
        console.error(` [OCPP-API] Error crítico procesando remote-stop para ${req.params.serial}:`, error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});
// Comando: Reiniciar cargador
router.post('/reset/:serial', async (req, res) => {
    try {
        const serial = req.params.serial;
        const { type = 'Soft' } = req.body; // 'Hard' o 'Soft'
        if (!serial) {
            return res.status(400).json({ success: false, error: 'serial requerido' });
        }
        const payload = { type };
        const success = await ocpp_service_1.ocppService.sendCommand(serial, 'Reset', payload);
        if (success) {
            res.json({
                success: true,
                message: `Comando de reinicio ${type} enviado`
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'Cargador no conectado'
            });
        }
    }
    catch (error) {
        console.error('Error enviando reset:', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});
// Comando: Desbloquear conector
router.post('/unlock-connector/:serial', async (req, res) => {
    try {
        const serial = req.params.serial;
        const { connectorId = 1 } = req.body;
        if (!serial) {
            return res.status(400).json({ success: false, error: 'serial requerido' });
        }
        const payload = { connectorId };
        const success = await ocpp_service_1.ocppService.sendCommand(serial, 'UnlockConnector', payload);
        if (success) {
            res.json({
                success: true,
                message: 'Comando de desbloqueo enviado'
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'Cargador no conectado'
            });
        }
    }
    catch (error) {
        console.error('Error enviando unlock:', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});
router.get('/health', async (req, res) => {
    try {
        const connectedChargers = ocpp_service_1.ocppService.getConnectedChargers();
        res.json({
            success: true,
            service: 'OCPP Server',
            status: 'running',
            timestamp: new Date().toISOString(),
            connectedChargers: connectedChargers.length,
            details: {
                port: 8887,
                protocol: 'WebSocket OCPP 1.6',
                endpoints: {
                    status: '/api/ocpp/status/:serial',
                    remoteStart: '/api/ocpp/remote-start/:serial',
                    remoteStop: '/api/ocpp/remote-stop/:serial',
                    reset: '/api/ocpp/reset/:serial',
                    unlockConnector: '/api/ocpp/unlock-connector/:serial',
                    connectedChargers: '/api/ocpp/connected-chargers',
                    health: '/api/ocpp/health'
                }
            },
            chargers: connectedChargers
        });
    }
    catch (error) {
        console.error('Error en health check OCPP:', error);
        res.status(500).json({
            success: false,
            service: 'OCPP Server',
            status: 'error',
            error: 'Error interno del servidor OCPP'
        });
    }
});
// Endpoint para debug de comandos OCPP
router.post('/debug-send/:serial', async (req, res) => {
    try {
        const serial = req.params.serial;
        const { action, payload } = req.body;
        if (!serial) {
            return res.status(400).json({ success: false, error: 'serial requerido' });
        }
        console.log(`🔧 [DEBUG] Enviando comando OCPP a ${serial}:`, { action, payload });
        const success = await ocpp_service_1.ocppService.sendCommand(serial, action, payload);
        if (success) {
            res.json({
                success: true,
                message: `Comando ${action} enviado correctamente`,
                details: {
                    chargePointId: serial,
                    action: action,
                    payload: payload,
                    timestamp: new Date().toISOString()
                }
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'Cargador no conectado - no se pudo enviar el comando'
            });
        }
    }
    catch (error) {
        console.error('Error en debug OCPP:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});
// Diagnóstico completo del cargador
router.get('/diagnostic/:serial', async (req, res) => {
    try {
        const serial = req.params.serial;
        if (!serial) {
            return res.status(400).json({ success: false, error: 'serial requerido' });
        }
        // 1. Verificar en base de datos incluyendo WiFi, Bluetooth y servidor OCPP
        const [dbRows] = await db_config_1.connectionPool.query(`SELECT c.id, c.serial_number, c.status, c.network_status, c.last_updated, 
                    c.model, c.max_power, c.firmware_version, c.wifi_ssid,
                    c.bluetooth_connected, c.last_bluetooth_connection,
                    o.url as ocpp_server_url, o.name as ocpp_server_name
             FROM chargers c
             LEFT JOIN ocpp_servers o ON c.ocpp_server_id = o.id
             WHERE c.serial_number = ?`, [serial]);
        const chargers = dbRows;
        if (chargers.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado en base de datos'
            });
        }
        const charger = chargers[0];
        const isConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        // 2. Verificar si hay tablas en devices_db
        let hasActionTable = false;
        let hasLogTable = false;
        try {
            const [tables] = await db_config_1.deviceDbPool.query("SHOW TABLES LIKE ?", [`action_${serial}`]);
            hasActionTable = tables.length > 0;
            const [logTables] = await db_config_1.deviceDbPool.query("SHOW TABLES LIKE ?", [`charging_log_${serial}`]);
            hasLogTable = logTables.length > 0;
        }
        catch (tableError) {
            console.log(`Tablas para ${serial} no existen aún`);
        }
        // 3. Información de conexión OCPP
        const connectionInfo = {
            ocppWebSocketUrl: `${env_config_1.CONFIG.OCPP_URL}/ocpp/${serial}`,
            ocppPort: 8887,
            protocol: 'OCPP 1.6'
        };
        res.json({
            success: true,
            diagnostic: {
                basicInfo: {
                    serial: charger.serial_number,
                    model: charger.model,
                    maxPower: charger.max_power,
                    firmware: charger.firmware_version,
                    status: charger.status,
                    networkStatus: charger.network_status,
                    lastUpdated: charger.last_updated,
                    wifi_ssid: charger.wifi_ssid || 'No conectado',
                    bluetoothStatus: {
                        connected: charger.bluetooth_connected || false,
                        lastConnection: charger.last_bluetooth_connection
                    }
                },
                connection: {
                    connected: isConnected,
                    ocppWebSocketUrl: charger.ocpp_server_url ?
                        `${charger.ocpp_server_url}/ocpp/${serial}` :
                        connectionInfo.ocppWebSocketUrl,
                    ocppServerName: charger.ocpp_server_name || 'Servidor por defecto',
                    recommendedConfig: {
                        serverUrl: charger.ocpp_server_url || env_config_1.CONFIG.OCPP_URL,
                        chargePointId: serial,
                        protocol: 'OCPP 1.6',
                        heartbeatInterval: 300
                    }
                },
                database: {
                    existsInChargersTable: true,
                    hasActionTable: hasActionTable,
                    hasLogTable: hasLogTable,
                    tablesAutoCreated: 'Al primer BootNotification OCPP'
                },
                actions: {
                    connectCargador: `Configurar cargador para conectar a: ${connectionInfo.ocppWebSocketUrl}`,
                    testConnection: `Usar: POST /api/ocpp/remote-start/${serial} con body JSON`,
                    monitor: `Ver logs en tiempo real: pm2 logs server-app`
                }
            }
        });
    }
    catch (error) {
        console.error('Error en diagnóstico:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
});
// Endpoint para obtener estado completo del cargador (Bluetooth + OCPP + WiFi)
router.get('/estado-completo/:serial', async (req, res) => {
    try {
        const serial = req.params.serial;
        if (!serial) {
            return res.status(400).json({
                success: false,
                error: 'Número de serie requerido'
            });
        }
        // Obtener información completa del cargador
        const [rows] = await db_config_1.connectionPool.query(`SELECT c.*,
      TIMESTAMPDIFF(SECOND, c.last_bluetooth_connection, NOW()) as tiempo_desde_bluetooth
             FROM chargers c 
             WHERE c.serial_number = ? `, [serial]);
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const charger = rows[0];
        const ocppConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        // Determinar estado de conectividad
        const bluetoothActivo = charger.bluetooth_connected &&
            charger.tiempo_desde_bluetooth < 30; // 30 segundos de tolerancia
        // Obtener IP e información de conexión del cargador
        const currentConnection = ocppConnected ? ocpp_service_1.ocppService.getChargerConnection(serial) : null;
        const currentIP = currentConnection ? currentConnection.ip : null;
        const isLocalWiFi = currentConnection ? currentConnection.isLocalWiFi : false;
        const vpnConnection = currentConnection ? currentConnection.vpnConnection : false;
        const connectionType = currentConnection ? currentConnection.connectionType : 'desconectado';
        // Si está conectado por OCPP, actualizar estado
        if (ocppConnected && charger.network_status !== 'online') {
            await db_config_1.connectionPool.query('UPDATE chargers SET network_status = ?, last_updated = NOW() WHERE serial_number = ?', ['online', serial]);
            charger.network_status = 'online';
        }
        res.json({
            success: true,
            estado: {
                serial: charger.serial_number,
                bluetooth: {
                    conectado: bluetoothActivo,
                    ultima_conexion: charger.last_bluetooth_connection,
                    segundos_desde_conexion: charger.tiempo_desde_bluetooth
                },
                wifi: {
                    conectado: isLocalWiFi,
                    red: charger.wifi_ssid || 'No conectado',
                    ip_actual: currentIP || 'No disponible',
                    tipo_conexion: connectionType,
                    es_vpn: vpnConnection
                },
                ocpp: {
                    conectado: ocppConnected,
                    estado_red: charger.network_status
                },
                estado_general: charger.status,
                ultima_actualizacion: charger.last_updated
            },
            recomendaciones: {
                bluetooth: bluetoothActivo ? 'Conexión Bluetooth estable' : 'Reconectar Bluetooth',
                wifi: isLocalWiFi ?
                    'Conectado a red local WiFi' :
                    (currentIP ? 'Conectado vía ' + (vpnConnection ? 'VPN' : 'Internet') + (connectionType ? ` (${connectionType})` : '') : 'Configurar WiFi'),
                ocpp: ocppConnected ?
                    'Conectado al servidor' + (isLocalWiFi ? ' por red local' : (vpnConnection ? ' por VPN' : ' vía Internet')) :
                    'Verificar conexión al servidor'
            }
        });
    }
    catch (error) {
        console.error('Error obteniendo estado completo:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});
// Endpoint para actualizar estado Bluetooth automáticamente
router.post('/actualizar-bluetooth/:serial', async (req, res) => {
    try {
        const { serial } = req.params;
        const { conectado } = req.body;
        if (conectado === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Estado de conexión requerido'
            });
        }
        await db_config_1.connectionPool.query(`UPDATE chargers 
             SET bluetooth_connected = ?,
      last_bluetooth_connection = IF(? = true, NOW(), last_bluetooth_connection)
             WHERE serial_number = ? `, [conectado, conectado, serial]);
        // Enviar notificación si se desconecta
        if (!conectado) {
            // Aquí se podría integrar con el sistema de notificaciones
            console.log(`[Bluetooth] Cargador ${serial} desconectado`);
        }
        res.json({
            success: true,
            mensaje: conectado ? 'Bluetooth conectado' : 'Bluetooth desconectado',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error actualizando estado Bluetooth:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno al actualizar estado Bluetooth'
        });
    }
});
// Endpoint para monitoreo continuo de conexión
router.post('/monitor-conexion/:serial', async (req, res) => {
    try {
        const { serial } = req.params;
        const { tipo } = req.body; // 'bluetooth', 'wifi', 'ocpp'
        const [charger] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [serial]);
        if (!charger.length) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const estado = {
            bluetooth: charger[0].bluetooth_connected,
            wifi: !!charger[0].wifi_ssid,
            ocpp: ocpp_service_1.ocppService.isChargerConnected(serial)
        };
        // Actualizar último estado conocido
        await db_config_1.connectionPool.query(`UPDATE chargers 
             SET last_connection_check = NOW(),
      connection_status = ?
        WHERE serial_number = ? `, [JSON.stringify(estado), serial]);
        res.json({
            success: true,
            estado: estado,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error en monitoreo de conexión:', error);
        res.status(500).json({
            success: false,
            error: 'Error monitoreando conexión'
        });
    }
});
// Endpoint para verificar si un cargador existe
router.get('/check/:serial', async (req, res) => {
    try {
        const serial = req.params.serial;
        if (!serial) {
            return res.status(400).json({
                success: false,
                error: 'serial requerido'
            });
        }
        const [rows] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [serial]);
        res.json({
            success: true,
            exists: rows.length > 0,
            charger: rows.length > 0 ? rows[0] : null
        });
    }
    catch (error) {
        console.error('Error verificando cargador:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});
// Endpoint para reconexión automática
router.post('/reconectar/:serial', async (req, res) => {
    try {
        const { serial } = req.params;
        const { tipo } = req.body; // 'bluetooth', 'wifi', 'ocpp'
        const [rows] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [serial]);
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const charger = rows[0];
        const resultado = {
            mensaje: '',
            accion_requerida: false,
            pasos_siguientes: []
        };
        switch (tipo) {
            case 'bluetooth':
                resultado.mensaje = 'Iniciando reconexión Bluetooth';
                resultado.accion_requerida = true;
                resultado.pasos_siguientes = [
                    'Verifique que el Bluetooth está activado',
                    'Acérquese al cargador',
                    'Espere la reconexión automática'
                ];
                break;
            case 'wifi':
                if (charger.wifi_ssid) {
                    try {
                        await configureChargerWifi(serial, charger.wifi_ssid, charger.wifi_password || '', charger.charger_type);
                        resultado.mensaje = 'Reconexión WiFi iniciada';
                        resultado.pasos_siguientes = ['Esperando reconexión WiFi...'];
                    }
                    catch (error) {
                        resultado.mensaje = 'Error en reconexión WiFi';
                        resultado.accion_requerida = true;
                        resultado.pasos_siguientes = ['Reconfigurar WiFi manualmente'];
                    }
                }
                else {
                    resultado.mensaje = 'Se requiere configuración WiFi';
                    resultado.accion_requerida = true;
                    resultado.pasos_siguientes = ['Configure la red WiFi'];
                }
                break;
            case 'ocpp':
                const ocppConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
                if (!ocppConnected) {
                    // Intentar reinicio suave para reconectar
                    try {
                        await ocpp_service_1.ocppService.sendCommand(serial, 'Reset', { type: 'Soft' });
                        resultado.mensaje = 'Reinicio OCPP iniciado';
                        resultado.pasos_siguientes = ['Esperando reconexión al servidor...'];
                    }
                    catch (error) {
                        resultado.mensaje = 'Error en reconexión OCPP';
                        resultado.accion_requerida = true;
                        resultado.pasos_siguientes = ['Verifique la conexión WiFi'];
                    }
                }
                else {
                    resultado.mensaje = 'Conectado al servidor OCPP';
                    resultado.pasos_siguientes = ['Conexión activa'];
                }
                break;
        }
        res.json({
            success: true,
            resultado: resultado
        });
    }
    catch (error) {
        console.error('Error en reconexión:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno durante la reconexión'
        });
    }
});
router.post('/configure-wifi', async (req, res) => {
    try {
        const { serial, ssid, password } = req.body;
        if (!serial || !ssid) {
            return res.status(400).json({
                success: false,
                error: 'serial y ssid requeridos'
            });
        }
        const trimmedSerial = serial.trim();
        if (!trimmedSerial) {
            return res.status(400).json({
                success: false,
                error: 'Serial no válido'
            });
        }
        // Verificar si el cargador existe
        const [dbRows] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [trimmedSerial]);
        if (dbRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const charger = dbRows[0];
        // Solo para cargadores OCPP
        if (charger.charger_type !== 'ocpp') {
            return res.status(400).json({
                success: false,
                error: 'Este cargador no soporta configuración OCPP'
            });
        }
        console.log(`[configure-wifi] Configurando WiFi para ${trimmedSerial}: ${ssid}`);
        // Enviar comando de configuración WiFi al cargador OCPP
        const success = await ocpp_service_1.ocppService.sendCommand(trimmedSerial, 'ChangeConfiguration', {
            key: 'NetworkProfile',
            value: JSON.stringify({
                ssid: ssid,
                password: password || '',
                security: password ? 'WPA2' : 'None'
            })
        });
        if (success) {
            console.log(`[configure-wifi] Configuración WiFi enviada exitosamente a ${trimmedSerial}`);
            // Programar reinicio para aplicar configuración
            setTimeout(() => {
                try {
                    ocpp_service_1.ocppService.sendCommand(trimmedSerial, 'Reset', { type: 'Soft' });
                    console.log(`[configure-wifi] Reinicio programado para ${trimmedSerial}`);
                }
                catch (resetError) {
                    console.warn(`[configure-wifi] Error en reinicio programado: ${resetError}`);
                }
            }, 3000);
            return res.json({
                success: true,
                message: 'Configuración WiFi enviada al cargador OCPP',
                details: {
                    serial: trimmedSerial,
                    ssid: ssid,
                    restartScheduled: true
                }
            });
        }
        else {
            console.warn(`[configure-wifi] Cargador ${trimmedSerial} no conectado para configuración WiFi`);
            return res.status(400).json({
                success: false,
                error: 'Cargador OCPP no conectado - no se pudo enviar configuración'
            });
        }
    }
    catch (error) {
        console.error('Error configurando WiFi OCPP:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});
// Configurar cargador DKG (similar a tu lógica actual)
async function setupDkgCharger(charger, ownerId, deviceData) {
    try {
        // 1. Crear dispositivo secundario
        await db_config_1.connectionPool.query('INSERT INTO secondary_devices (charger_id, device_status) VALUES (?, ?)', [charger.id, false]);
        // 2. Asignar permisos al usuario
        let basePricePerKwh = 0.30;
        // Intentar obtener precio base y servidor OCPP
        try {
            const [priceRows] = await db_config_1.deviceDbPool.query('SELECT base_price_per_kwh FROM administracion.pricing_devices WHERE serial_number = ?', [charger.serial_number]);
            // Obtener servidor OCPP asignado o el primero disponible
            const [ocppRows] = await db_config_1.connectionPool.query('SELECT id FROM ocpp_servers ORDER BY is_default DESC, id ASC LIMIT 1');
            if (ocppRows.length > 0) {
                await db_config_1.connectionPool.query('UPDATE chargers SET ocpp_server_id = ? WHERE id = ?', [ocppRows[0].id, charger.id]);
            }
            if (priceRows.length > 0) {
                basePricePerKwh = Number(priceRows[0].base_price_per_kwh);
            }
        }
        catch (priceError) {
            console.warn('Error al consultar precio base o servidor OCPP:', priceError);
        }
        if (ownerId) {
            await db_config_1.connectionPool.query('INSERT INTO charger_users (charger_id, user_id, access_level, rate_per_kwh) VALUES (?, ?, ?, ?)', [charger.id, ownerId, 'owner', basePricePerKwh]);
        }
        // 3. Crear tablas dinámicas si no existen
        const logTable = `charging_log_${charger.serial_number}`;
        const actionTable = `action_${charger.serial_number}`;
        await db_config_1.deviceDbPool.query(`
      CREATE TABLE IF NOT EXISTS \`${logTable}\` (
        id INT PRIMARY KEY AUTO_INCREMENT,
        start_time DATETIME,
        end_time DATETIME,
        energy_kwh DECIMAL(10,2),
        power_peak INT,
        rate_per_kwh DECIMAL(10,4) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await db_config_1.deviceDbPool.query(`
      CREATE TABLE IF NOT EXISTS \`${actionTable}\` (
        id INT PRIMARY KEY AUTO_INCREMENT,
        action_type VARCHAR(100),
        id_user INT,
        id_device INT,
        description TEXT,
        status ENUM('0', '1', '2', '3') DEFAULT '0',
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log(`[setupDkgCharger] Configuración DKG completada para ${charger.serial_number}`);
    }
    catch (error) {
        console.error('[setupDkgCharger] Error:', error);
        throw error;
    }
}
// Configurar cargador OCPP (configuración mínima)
async function setupOcppCharger(charger, ownerId) {
    try {
        // 1. Crear dispositivo secundario
        await db_config_1.connectionPool.query('INSERT INTO secondary_devices (charger_id, device_status) VALUES (?, ?)', [charger.id, false]);
        // 2. Asignar permisos al usuario
        if (ownerId) {
            await db_config_1.connectionPool.query('INSERT INTO charger_users (charger_id, user_id, access_level, rate_per_kwh) VALUES (?, ?, ?, ?)', [charger.id, ownerId, 'owner', 0.30]);
        }
        console.log(`[setupOcppCharger] Configuración OCPP completada para ${charger.serial_number}`);
    }
    catch (error) {
        console.error('[setupOcppCharger] Error:', error);
        throw error;
    }
}
// Configurar WiFi del cargador
async function configureChargerWifi(serial, ssid, password, chargerType) {
    try {
        if (chargerType === 'ocpp') {
            // Para OCPP: enviar comando ChangeConfiguration
            const success = await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', {
                key: 'NetworkProfile',
                value: JSON.stringify({
                    ssid: ssid,
                    password: password || '',
                    security: password ? 'WPA2' : 'None'
                })
            });
            if (success) {
                console.log(`[configureChargerWifi] Configuración WiFi OCPP enviada a ${serial}`);
                // Programar reinicio para aplicar configuración
                setTimeout(async () => {
                    try {
                        await ocpp_service_1.ocppService.sendCommand(serial, 'Reset', { type: 'Soft' });
                        console.log(`[configureChargerWifi] Reinicio programado para ${serial}`);
                    }
                    catch (resetError) {
                        console.warn(`[configureChargerWifi] Error en reinicio programado: ${resetError}`);
                    }
                }, 3000);
            }
            else {
                throw new Error('No se pudo enviar configuración al cargador OCPP');
            }
        }
        else {
            // Para DKG: usar Bluetooth o el método que prefieras
            console.log(`[configureChargerWifi] Configuración WiFi DKG para ${serial}`);
            // Aquí iría la lógica específica para DKG
        }
    }
    catch (error) {
        console.error(`[configureChargerWifi] Error:`, error);
        throw error;
    }
}
;
// Configurar WiFi vía Bluetooth
router.post('/bluetooth-configure-wifi', async (req, res) => {
    try {
        const { serial, ssid, password } = req.body;
        if (!serial || !ssid) {
            return res.status(400).json({
                success: false,
                error: 'serial y ssid requeridos'
            });
        }
        console.log(`[bluetooth-wifi] Configurando WiFi para ${serial}: ${ssid}`);
        const [dbRows] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [serial]);
        if (dbRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        // 1. GUARDAR configuración WiFi
        const wifiConfig = { ssid, password: password || '' };
        await db_config_1.connectionPool.query('UPDATE chargers SET pending_wifi_config = ?, last_updated = NOW() WHERE serial_number = ?', [JSON.stringify(wifiConfig), serial]);
        // 2. PREPARAR configuración OCPP para después del WiFi
        const ocppConfig = {
            server_url: env_config_1.CONFIG.OCPP_URL,
            charge_point_id: serial,
            heartbeat_interval: '300'
        };
        await db_config_1.connectionPool.query('UPDATE chargers SET pending_ocpp_config = ? WHERE serial_number = ?', [JSON.stringify(ocppConfig), serial]);
        const isConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        if (isConnected) {
            console.log(`[bluetooth-wifi] Cargador conectado, aplicando WiFi inmediatamente`);
            try {
                // Aplicar WiFi
                const success = await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', {
                    key: 'NetworkProfile',
                    value: JSON.stringify({
                        ssid: ssid,
                        password: password || '',
                        security: password ? 'WPA2' : 'None'
                    })
                });
                if (success) {
                    console.log(`[bluetooth-wifi] WiFi configurado, reiniciando en 8 segundos...`);
                    // Reinicio CORTO para aplicar WiFi
                    setTimeout(async () => {
                        try {
                            await ocpp_service_1.ocppService.sendCommand(serial, 'Reset', { type: 'Hard' });
                            console.log(`[bluetooth-wifi] Reinicio Hard enviado a ${serial}`);
                        }
                        catch (resetError) {
                            console.warn(`[bluetooth-wifi] Error en reinicio: ${resetError}`);
                        }
                    }, 8000); // Solo 8 segundos
                }
            }
            catch (wifiError) {
                console.warn(`[bluetooth-wifi] Error enviando WiFi: ${wifiError}`);
            }
        }
        return res.json({
            success: true,
            message: isConnected ?
                'WiFi configurado. El cargador se reiniciará en 8 segundos para conectarse.' :
                'Configuración WiFi almacenada. Se aplicará al conectar por Bluetooth.',
            details: {
                serial: serial,
                ssid: ssid,
                connected: isConnected,
                next_step: isConnected ?
                    'Cargador se reiniciará y debería conectarse a WiFi → Luego a OCPP automáticamente' :
                    'Conectar cargador por Bluetooth para aplicar configuración'
            }
        });
    }
    catch (error) {
        console.error('Error configurando WiFi:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});
router.get('/pending-wifi-config/:serial', async (req, res) => {
    try {
        const serial = req.params.serial;
        const [dbRows] = await db_config_1.connectionPool.query('SELECT pending_wifi_config FROM chargers WHERE serial_number = ?', [serial]);
        if (dbRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const pendingConfig = dbRows[0].pending_wifi_config;
        if (pendingConfig) {
            // Limpiar la configuración pendiente después de enviarla
            await db_config_1.connectionPool.query('UPDATE chargers SET pending_wifi_config = NULL WHERE serial_number = ?', [serial]);
        }
        res.json({
            success: true,
            pending_config: pendingConfig ? JSON.parse(pendingConfig) : null
        });
    }
    catch (error) {
        console.error('Error obteniendo configuración WiFi pendiente:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});
// Endpoints para gestión de UUIDs Bluetooth
router.get('/chargers/:serial/bluetooth-uuids', async (req, res) => {
    try {
        const { serial } = req.params;
        const [rows] = await db_config_1.connectionPool.query(`SELECT service_uuid, characteristic_uuid, properties, model, vendor 
       FROM charger_bluetooth_uuids 
       WHERE charger_serial = ? 
       ORDER BY updated_at DESC`, [serial]);
        res.json({
            success: true,
            uuids: rows
        });
    }
    catch (error) {
        console.error('Error obteniendo UUIDs:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});
router.post('/chargers/:serial/bluetooth-uuids', async (req, res) => {
    try {
        const { serial } = req.params;
        const { service_uuid, characteristic_uuid, properties, model, vendor } = req.body;
        await db_config_1.connectionPool.query(`INSERT INTO charger_bluetooth_uuids 
       (charger_serial, service_uuid, characteristic_uuid, properties, model, vendor) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       properties = VALUES(properties), model = VALUES(model), vendor = VALUES(vendor), updated_at = NOW()`, [serial, service_uuid, characteristic_uuid, properties, model, vendor]);
        res.json({ success: true, message: 'UUID guardado' });
    }
    catch (error) {
        console.error('Error guardando UUID:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});
router.delete('/chargers/:serial/bluetooth-uuids', async (req, res) => {
    try {
        const { serial } = req.params;
        await db_config_1.connectionPool.query('DELETE FROM charger_bluetooth_uuids WHERE charger_serial = ?', [serial]);
        res.json({ success: true, message: 'UUIDs eliminados' });
    }
    catch (error) {
        console.error('Error eliminando UUIDs:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});
router.post('/chargers/:serial/preferred-uuids', async (req, res) => {
    try {
        const { serial } = req.params;
        const { service_uuid, characteristic_uuid } = req.body;
        await db_config_1.connectionPool.query('UPDATE chargers SET preferred_bluetooth_service = ?, preferred_bluetooth_characteristic = ? WHERE serial_number = ?', [service_uuid, characteristic_uuid, serial]);
        res.json({ success: true, message: 'UUIDs preferidos guardados' });
    }
    catch (error) {
        console.error('Error guardando UUIDs preferidos:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});
// Endpoint corregido para obtener servidores OCPP
router.get('/ocpp-servers', async (req, res) => {
    try {
        console.log('📡 [OCPP] Solicitando lista de servidores OCPP desde base de datos charger');
        // Destructuramos directamente para obtener las filas
        const [rows] = await db_config_1.connectionPool.query('SELECT * FROM ocpp_servers ORDER BY name');
        // Aseguramos el tipo
        const servers = rows; // o puedes definir una interfaz
        console.log(` [OCPP] Servidores obtenidos: ${servers.length} encontrados`);
        res.json(servers);
    }
    catch (error) {
        console.error(' [OCPP] Error fetching OCPP servers:', error);
        res.status(500).json({ error: 'Error al cargar servidores OCPP' });
    }
});
// Endpoint para crear nuevo servidor OCPP - CORREGIDO
router.post('/ocpp-servers', async (req, res) => {
    try {
        const { name, url, charge_point_identity, password } = req.body;
        console.log(' Creando nuevo servidor OCPP:', name);
        // El insert devuelve un ResultSetHeader
        const [result] = await db_config_1.connectionPool.query('INSERT INTO ocpp_servers (name, url, charge_point_identity, password) VALUES (?, ?, ?, ?)', [name, url, charge_point_identity, password]);
        const insertResult = result; // o ResultSetHeader si tienes los tipos importados
        res.json({
            id: insertResult.insertId,
            message: 'Servidor OCPP creado exitosamente'
        });
    }
    catch (error) {
        console.error(' Error creating OCPP server:', error);
        res.status(500).json({ error: 'Error al crear servidor OCPP' });
    }
});
// Endpoints para gestión de UUIDs Bluetooth 
router.get('/chargers/:serial/bluetooth-uuids', async (req, res) => {
    try {
        const { serial } = req.params;
        const result = await db_config_1.connectionPool.query(`SELECT service_uuid, characteristic_uuid, properties, model, vendor 
       FROM charger_bluetooth_uuids 
       WHERE charger_serial = ? 
       ORDER BY updated_at DESC`, [serial]);
        const rows = result[0];
        res.json({
            success: true,
            uuids: rows
        });
    }
    catch (error) {
        console.error('Error obteniendo UUIDs:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});
router.post('/chargers/:serial/bluetooth-uuids', async (req, res) => {
    try {
        const { serial } = req.params;
        const { service_uuid, characteristic_uuid, properties, model, vendor } = req.body;
        const result = await db_config_1.connectionPool.query(`INSERT INTO charger_bluetooth_uuids 
       (charger_serial, service_uuid, characteristic_uuid, properties, model, vendor) 
       VALUES (?, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       properties = VALUES(properties), model = VALUES(model), vendor = VALUES(vendor), updated_at = NOW()`, [serial, service_uuid, characteristic_uuid, properties, model, vendor]);
        res.json({ success: true, message: 'UUID guardado' });
    }
    catch (error) {
        console.error('Error guardando UUID:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});
// Los otros endpoints de UUIDs también deben usar connectionPool
router.delete('/chargers/:serial/bluetooth-uuids', async (req, res) => {
    try {
        const { serial } = req.params;
        await db_config_1.deviceDbPool.query('DELETE FROM charger_bluetooth_uuids WHERE charger_serial = ?', [serial]);
        res.json({ success: true, message: 'UUIDs eliminados' });
    }
    catch (error) {
        console.error('Error eliminando UUIDs:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});
router.post('/chargers/:serial/preferred-uuids', async (req, res) => {
    try {
        const { serial } = req.params;
        const { service_uuid, characteristic_uuid } = req.body;
        await db_config_1.deviceDbPool.query('UPDATE chargers SET preferred_bluetooth_service = ?, preferred_bluetooth_characteristic = ? WHERE serial_number = ?', [service_uuid, characteristic_uuid, serial]);
        res.json({ success: true, message: 'UUIDs preferidos guardados' });
    }
    catch (error) {
        console.error('Error guardando UUIDs preferidos:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});
// Forzar configuración OCPP para cargador específico
router.post('/force-configure-ocpp/:serial', async (req, res) => {
    try {
        const { serial } = req.params;
        console.log(`[force-configure-ocpp] Configurando OCPP para: ${serial}`);
        // Verificar si el cargador existe - CORREGIDO
        const result = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [serial]);
        const dbRows = result[0];
        if (dbRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const charger = dbRows[0];
        // Si el cargador está conectado, configurar OCPP directamente
        const isConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        if (isConnected) {
            console.log(`[force-configure-ocpp] Cargador ${serial} conectado, configurando...`);
            // Configurar URL del servidor OCPP
            await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', {
                key: 'CentralSystemUrl',
                value: env_config_1.CONFIG.OCPP_URL
            });
            // Configurar ChargePointId
            await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', {
                key: 'ChargePointId',
                value: serial
            });
            // Programar reinicio
            setTimeout(async () => {
                try {
                    await ocpp_service_1.ocppService.sendCommand(serial, 'Reset', { type: 'Soft' });
                    console.log(`[force-configure-ocpp] Reinicio programado para ${serial}`);
                }
                catch (resetError) {
                    console.warn(`[force-configure-ocpp] Error en reinicio: ${resetError}`);
                }
            }, 5000);
            return res.json({
                success: true,
                message: 'Configuración OCPP aplicada. El cargador se reiniciará.',
                connected: true
            });
        }
        else {
            // Si no está conectado, almacenar configuración OCPP pendiente - CORREGIDO
            await db_config_1.connectionPool.query('UPDATE chargers SET pending_ocpp_config = ? WHERE serial_number = ?', [JSON.stringify({
                    server_url: env_config_1.CONFIG.OCPP_URL,
                    charge_point_id: serial
                }), serial]);
            return res.json({
                success: true,
                message: 'Configuración OCPP almacenada. Se aplicará cuando el cargador se conecte.',
                connected: false
            });
        }
    }
    catch (error) {
        console.error('Error forzando configuración OCPP:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});
// Aplicar configuración pendiente y reiniciar cargador
router.post('/chargers/:serial/apply-pending-config', async (req, res) => {
    try {
        const { serial } = req.params;
        console.log(`[apply-pending-config] SOLO solicitando reinicio para: ${serial}`);
        // Verificar si el cargador existe
        const result = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [serial]);
        const dbRows = result[0];
        if (dbRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const charger = dbRows[0];
        // NO LIMPIAR LAS CONFIGURACIONES - solo enviar reinicio
        let restartSent = false;
        try {
            // Intentar reinicio via OCPP si está conectado
            if (ocpp_service_1.ocppService.isChargerConnected(serial)) {
                await ocpp_service_1.ocppService.sendCommand(serial, 'Reset', { type: 'Hard' });
                restartSent = true;
                console.log(`[apply-pending-config] Reinicio OCPP enviado a ${serial}`);
            }
        }
        catch (ocppError) {
            console.warn(`[apply-pending-config] No se pudo reiniciar via OCPP: ${ocppError}`);
        }
        res.json({
            success: true,
            message: 'Reinicio solicitado. Las configuraciones SE MANTIENEN PENDIENTES.',
            details: {
                has_pending_wifi: !!charger.pending_wifi_config,
                has_pending_ocpp: !!charger.pending_ocpp_config,
                restart_sent: restartSent,
                instructions: 'El cargador aplicará las configuraciones durante el reinicio'
            }
        });
    }
    catch (error) {
        console.error('Error en apply-pending-config:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});
// Endpoint llamado cuando un cargador se conecta al servidor OCPP
router.post('/chargers/:serial/on-connect', async (req, res) => {
    try {
        const { serial } = req.params;
        console.log(`[on-connect] Cargador conectado: ${serial}, aplicando configuraciones pendientes...`);
        // 1. Verificar configuraciones pendientes
        const result = await db_config_1.connectionPool.query('SELECT pending_wifi_config, pending_ocpp_config FROM chargers WHERE serial_number = ?', [serial]);
        const dbRows = result[0];
        // Aplicar automáticamente la configuración WiFi si tiene credenciales completas
        const pendingWifiConfig = dbRows[0]?.pending_wifi_config ?
            JSON.parse(dbRows[0].pending_wifi_config) : null;
        if (pendingWifiConfig?.ssid && pendingWifiConfig?.password) {
            console.log(`[on-connect] Aplicando configuración WiFi automáticamente para ${serial}`);
            try {
                await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', {
                    key: 'NetworkProfile',
                    value: JSON.stringify({
                        ssid: pendingWifiConfig.ssid,
                        password: pendingWifiConfig.password,
                        security: 'WPA2'
                    })
                });
                // Limpiar configuración WiFi pendiente inmediatamente
                await db_config_1.connectionPool.query('UPDATE chargers SET pending_wifi_config = NULL WHERE serial_number = ?', [serial]);
                // Programar reinicio automático
                setTimeout(async () => {
                    try {
                        await ocpp_service_1.ocppService.sendCommand(serial, 'Reset', { type: 'Soft' });
                        console.log(`[on-connect] Reinicio automático programado para aplicar WiFi en ${serial}`);
                    }
                    catch (resetError) {
                        console.warn(`[on-connect] Error en reinicio automático: ${resetError}`);
                    }
                }, 3000);
            }
            catch (wifiError) {
                console.error(`[on-connect] Error aplicando configuración WiFi: ${wifiError}`);
            }
        }
        if (dbRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const charger = dbRows[0];
        let configApplied = { wifi: false, ocpp: false };
        // 2. Aplicar configuración OCPP si existe
        if (charger.pending_ocpp_config) {
            try {
                const ocppConfig = typeof charger.pending_ocpp_config === 'string'
                    ? JSON.parse(charger.pending_ocpp_config)
                    : charger.pending_ocpp_config;
                console.log(`[on-connect] Aplicando configuración OCPP a ${serial}:`, ocppConfig);
                // El cargador ya está conectado, podemos enviar comandos
                await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', {
                    key: 'CentralSystemUrl',
                    value: ocppConfig.server_url || env_config_1.CONFIG.OCPP_URL
                });
                await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', {
                    key: 'ChargePointId',
                    value: ocppConfig.charge_point_id || serial
                });
                console.log(`[on-connect] Configuración OCPP aplicada a ${serial}`);
                configApplied.ocpp = true;
                // Limpiar configuración OCPP pendiente
                await db_config_1.connectionPool.query('UPDATE chargers SET pending_ocpp_config = NULL WHERE serial_number = ?', [serial]);
            }
            catch (ocppError) {
                console.error(`[on-connect] Error aplicando OCPP a ${serial}:`, ocppError);
            }
        }
        // 3. Actualizar estado del cargador a "online"
        await db_config_1.connectionPool.query('UPDATE chargers SET network_status = "online", last_updated = NOW() WHERE serial_number = ?', [serial]);
        res.json({
            success: true,
            message: 'Cargador conectado y configuración procesada',
            config_applied: configApplied,
            current_status: 'online'
        });
    }
    catch (error) {
        console.error('Error en on-connect:', error);
        res.status(500).json({
            success: false,
            error: 'Error procesando conexión'
        });
    }
});
// Endpoint de debug para ver estado completo y forzar configuración
router.get('/debug-config/:serial', async (req, res) => {
    try {
        const { serial } = req.params;
        const result = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [serial]);
        const dbRows = result[0];
        if (dbRows.length === 0) {
            return res.status(404).json({ error: 'Cargador no encontrado' });
        }
        const charger = dbRows[0];
        const isConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        // Intentar forzar la configuración WiFi si está pendiente
        if (charger.pending_wifi_config) {
            const wifiConfig = JSON.parse(charger.pending_wifi_config);
            if (wifiConfig.ssid && wifiConfig.password) {
                console.log(`[debug-config] Intentando forzar configuración WiFi para ${serial}`);
                try {
                    await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', {
                        key: 'NetworkProfile',
                        value: JSON.stringify({
                            ssid: wifiConfig.ssid,
                            password: wifiConfig.password,
                            security: 'WPA2'
                        })
                    });
                    // Limpiar configuración pendiente
                    await db_config_1.connectionPool.query('UPDATE chargers SET pending_wifi_config = NULL WHERE serial_number = ?', [serial]);
                    // Programar reinicio
                    setTimeout(async () => {
                        try {
                            await ocpp_service_1.ocppService.sendCommand(serial, 'Reset', { type: 'Soft' });
                            console.log(`[debug-config] Reinicio programado para ${serial}`);
                        }
                        catch (resetError) {
                            console.warn(`[debug-config] Error en reinicio: ${resetError}`);
                        }
                    }, 3000);
                }
                catch (wifiError) {
                    console.warn(`[debug-config] Error aplicando WiFi: ${wifiError}`);
                }
            }
        }
        // Verificar discrepancia entre estado DB y WebSocket
        if (charger.network_status === 'online' && !isConnected) {
            console.log(`[debug-config] Detectada discrepancia de estado para ${serial}. Actualizando estado en DB.`);
            await db_config_1.connectionPool.query('UPDATE chargers SET network_status = ? WHERE serial_number = ?', ['offline', serial]);
            charger.network_status = 'offline';
        }
        res.json({
            charger: charger,
            ocpp_connected: isConnected,
            pending_wifi: charger.pending_wifi_config ? JSON.parse(charger.pending_wifi_config) : null,
            pending_ocpp: charger.pending_ocpp_config ? JSON.parse(charger.pending_ocpp_config) : null,
            server_status: 'ocpp_server_running',
            connection_status: {
                db_status: charger.network_status,
                websocket_connected: isConnected,
                last_updated: charger.last_updated
            },
            recommended_action: isConnected ?
                'El cargador está conectado - enviar comandos OCPP directamente' :
                'El cargador está offline - esperar conexión o reiniciar manualmente. Verificar conexión física del cargador.'
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/debug-service', async (req, res) => {
    try {
        const connectedChargers = ocpp_service_1.ocppService.getConnectedChargers();
        res.json({
            success: true,
            service: 'OCPP Service',
            connected_chargers: connectedChargers,
            total_connected: connectedChargers.length,
            details: {
                has_944067: ocpp_service_1.ocppService.isChargerConnected('944067'),
                all_chargers: Array.from(ocpp_service_1.ocppService.connectedChargers.keys())
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Error en debug service' });
    }
});
// Endpoint para forzar actualización de estado
router.post('/refresh-status/:serial', async (req, res) => {
    try {
        const { serial } = req.params;
        const isConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        res.json({
            success: true,
            serial,
            ocpp_connected: isConnected,
            message: `Estado refrescado: ${isConnected ? 'CONECTADO' : 'DESCONECTADO'}`
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Error refrescando estado' });
    }
});
// Endpoint para debug del servicio OCPP
router.get('/debug-service', async (req, res) => {
    try {
        const connectedChargers = ocpp_service_1.ocppService.getConnectedChargers();
        // Get detailed connection info for 944067 if connected
        let charger944067Info = null;
        if (ocpp_service_1.ocppService.isChargerConnected('944067')) {
            charger944067Info = ocpp_service_1.ocppService.getChargerConnection('944067');
        }
        res.json({
            success: true,
            service: 'OCPP Service',
            connected_chargers: connectedChargers,
            total_connected: connectedChargers.length,
            details: {
                has_944067: ocpp_service_1.ocppService.isChargerConnected('944067'),
                charger_944067: charger944067Info,
                all_chargers: Array.from(ocpp_service_1.ocppService.connectedChargers.keys())
            },
            connection_summary: connectedChargers.reduce((acc, charger) => {
                acc[charger.connectionType] = (acc[charger.connectionType] || 0) + 1;
                return acc;
            }, {})
        });
    }
    catch (error) {
        console.error('Error en debug service:', error);
        res.status(500).json({ error: 'Error en debug service', details: error instanceof Error ? error.message : String(error) });
    }
});
// Endpoint para forzar actualización de estado
router.post('/refresh-status/:serial', async (req, res) => {
    try {
        const { serial } = req.params;
        const isConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        // Forzar actualización en base de datos
        await db_config_1.connectionPool.query('UPDATE chargers SET network_status = ?, last_updated = NOW() WHERE serial_number = ?', [isConnected ? 'online' : 'offline', serial]);
        res.json({
            success: true,
            serial: serial,
            ocpp_connected: isConnected,
            message: `Estado refrescado: ${isConnected ? 'CONECTADO' : 'DESCONECTADO'}`
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Error refrescando estado'
        });
    }
});
//  Ruta para refrescar el estado de un cargador
router.post('/chargers/:serial/quick-setup', async (req, res) => {
    try {
        const { serial } = req.params;
        const { ssid, password } = req.body;
        if (!ssid) {
            return res.status(400).json({ error: 'ssid requerido' });
        }
        console.log(`[QUICK-SETUP] Configuración rápida para ${serial}`);
        // 1. Configurar WiFi inmediatamente
        const isConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        if (!isConnected) {
            return res.status(400).json({
                success: false,
                error: 'Cargador no conectado por OCPP. Conecta primero por Bluetooth.'
            });
        }
        // Aplicar WiFi
        const wifiSuccess = await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', {
            key: 'NetworkProfile',
            value: JSON.stringify({
                ssid: ssid,
                password: password || '',
                security: password ? 'WPA2' : 'None'
            })
        });
        if (!wifiSuccess) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo configurar WiFi'
            });
        }
        console.log(`[QUICK-SETUP] WiFi aplicado a ${serial}, esperando 5 segundos...`);
        // Esperar 5 segundos y aplicar OCPP
        setTimeout(async () => {
            try {
                // Configurar OCPP
                await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', { key: 'CentralSystemUrl', value: env_config_1.CONFIG.OCPP_URL });
                await ocpp_service_1.ocppService.sendCommand(serial, 'ChangeConfiguration', { key: 'ChargePointId', value: serial });
                console.log(`[QUICK-SETUP] OCPP configurado para ${serial}`);
                // Reinicio final en 3 segundos
                setTimeout(async () => {
                    try {
                        await ocpp_service_1.ocppService.sendCommand(serial, 'Reset', { type: 'Hard' });
                        console.log(`[QUICK-SETUP] Reinicio final enviado a ${serial}`);
                    }
                    catch (resetError) {
                        console.warn(`[QUICK-SETUP] Error en reinicio final: ${resetError}`);
                    }
                }, 3000);
            }
            catch (ocppError) {
                console.error(`[QUICK-SETUP] Error OCPP: ${ocppError}`);
            }
        }, 5000);
        res.json({
            success: true,
            message: 'Configuración rápida iniciada. El cargador se reiniciará automáticamente.',
            timeline: {
                '0s': 'WiFi configurado',
                '5s': 'OCPP configurado',
                '8s': 'Reinicio automático',
                '60-120s': 'Cargador debería estar online'
            }
        });
    }
    catch (error) {
        console.error('Error en quick-setup:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});
// Endpoint para obtener estado de configuración del cargador
router.get('/chargers/:serial/setup-status', async (req, res) => {
    try {
        const { serial } = req.params;
        const [dbRows] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE serial_number = ?', [serial]);
        if (dbRows.length === 0) {
            return res.status(404).json({ error: 'Cargador no encontrado' });
        }
        const charger = dbRows[0];
        const isConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        const hasPendingWifi = !!charger.pending_wifi_config;
        const hasPendingOcpp = !!charger.pending_ocpp_config;
        let status = 'unknown';
        let nextStep = '';
        if (!isConnected && hasPendingWifi) {
            status = 'waiting_bluetooth';
            nextStep = 'Conectar por Bluetooth para aplicar WiFi';
        }
        else if (isConnected && hasPendingWifi) {
            status = 'configuring_wifi';
            nextStep = 'WiFi se aplicará automáticamente';
        }
        else if (isConnected && hasPendingOcpp) {
            status = 'configuring_ocpp';
            nextStep = 'OCPP se aplicará automáticamente';
        }
        else if (isConnected && !hasPendingWifi && !hasPendingOcpp) {
            status = 'configured_online';
            nextStep = 'Cargador configurado y online';
        }
        else if (!isConnected && !hasPendingWifi && !hasPendingOcpp) {
            status = 'configured_offline';
            nextStep = 'Cargador configurado pero offline - verificar conexión física';
        }
        res.json({
            serial,
            status,
            next_step: nextStep,
            connected: isConnected,
            pending_wifi: hasPendingWifi,
            pending_ocpp: hasPendingOcpp,
            network_status: charger.network_status,
            last_updated: charger.last_updated
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Endpoint para gestión automática de conexión
router.post('/auto-reconexion/:serial', async (req, res) => {
    try {
        const { serial } = req.params;
        const { modo } = req.body; // 'agresivo', 'normal', 'pasivo'
        // Obtener estado actual
        const [rows] = await db_config_1.connectionPool.query(`SELECT c.*, 
                    TIMESTAMPDIFF(SECOND, c.last_bluetooth_connection, NOW()) as tiempo_sin_bluetooth
             FROM chargers c 
             WHERE c.serial_number = ?`, [serial]);
        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const charger = rows[0];
        const ocppConnected = ocpp_service_1.ocppService.isChargerConnected(serial);
        const acciones = [];
        // Verificar estado Bluetooth
        if (!charger.bluetooth_connected || charger.tiempo_sin_bluetooth > 30) {
            acciones.push('bluetooth_reconexion');
        }
        // Verificar WiFi si hay configuración
        if (charger.wifi_ssid && !ocppConnected) {
            if (modo === 'agresivo') {
                // En modo agresivo, intentar reconexión WiFi inmediata
                await configureChargerWifi(serial, charger.wifi_ssid, charger.wifi_password || '', charger.charger_type);
                acciones.push('wifi_reconfiguracion');
            }
        }
        // Intentar reconexión OCPP si hay WiFi
        if (charger.wifi_ssid && !ocppConnected) {
            // Programar reinicio suave
            setTimeout(async () => {
                try {
                    await ocpp_service_1.ocppService.sendCommand(serial, 'Reset', { type: 'Soft' });
                    console.log(`[Auto-Reconexion] Reinicio programado para ${serial}`);
                }
                catch (error) {
                    console.warn(`[Auto-Reconexion] Error en reinicio: ${error}`);
                }
            }, 5000);
            acciones.push('ocpp_reinicio_programado');
        }
        // Actualizar timestamp de último intento
        await db_config_1.connectionPool.query(`UPDATE chargers 
             SET last_reconnection_attempt = NOW(),
                 reconnection_mode = ?
             WHERE serial_number = ?`, [modo, serial]);
        res.json({
            success: true,
            acciones_tomadas: acciones,
            modo: modo,
            estado_actual: {
                bluetooth: charger.bluetooth_connected,
                wifi: !!charger.wifi_ssid,
                ocpp: ocppConnected
            }
        });
    }
    catch (error) {
        console.error('Error en auto-reconexión:', error);
        res.status(500).json({
            success: false,
            error: 'Error en proceso de reconexión automática'
        });
    }
});
//pm2 start ts-node --name "ocpp-server" -- -T features/ocpp/index.ts
// pm2 start npm --name "api-server" -- run dev
// node -r ts-node/register/transpile-only features/ocpp/index.ts
