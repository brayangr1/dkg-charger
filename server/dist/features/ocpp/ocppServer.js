"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocppServer = void 0;
const ocpp_js_1 = require("ocpp-js");
const http_1 = __importDefault(require("http"));
const db_config_1 = require("../../config/db.config");
const ocppClient_1 = require("./ocppClient");
// Configuración del servidor HTTP para OCPP (puede ser el mismo que Express o uno dedicado)
const OCPP_PORT = process.env.OCPP_PORT ? parseInt(process.env.OCPP_PORT) : 8887;
const server = http_1.default.createServer();
// Crear instancia del servidor OCPP (OCPP 1.6 JSON)
const ocppServer = new ocpp_js_1.OCPPServer({
    server,
    protocols: [ocpp_js_1.OCPPProtocol.OCPP16],
});
exports.ocppServer = ocppServer;
// Manejar eventos de conexión de un cargador
ocppServer.on('connection', (client) => {
    (0, ocppClient_1.registerOcppClient)(client);
    console.log(`[OCPP] Nueva conexión de cargador: ${client.id}`);
    client.on('request', (command, payload, cb) => __awaiter(void 0, void 0, void 0, function* () {
        console.log(`[OCPP] Mensaje recibido: ${command} de ${client.id}`);
        switch (command) {
            case ocpp_js_1.OCPPCommands.BootNotification:
                yield handleBootNotification(client, payload);
                cb({
                    currentTime: new Date().toISOString(),
                    interval: 300,
                    status: 'Accepted',
                });
                break;
            case ocpp_js_1.OCPPCommands.StatusNotification:
                yield handleStatusNotification(client, payload);
                cb({});
                break;
            case ocpp_js_1.OCPPCommands.StartTransaction:
                const startRes = yield handleStartTransaction(client, payload);
                cb(startRes);
                break;
            case ocpp_js_1.OCPPCommands.StopTransaction:
                const stopRes = yield handleStopTransaction(client, payload);
                cb(stopRes);
                break;
            case ocpp_js_1.OCPPCommands.MeterValues:
                yield handleMeterValues(client, payload);
                cb({});
                break;
            default:
                cb({});
        }
    }));
    client.on('close', () => {
        (0, ocppClient_1.unregisterOcppClient)(client);
        console.log(`[OCPP] Cargador desconectado: ${client.id}`);
        setChargerNetworkStatus(client.id, 'offline');
    });
});
// Iniciar el servidor OCPP
server.listen(OCPP_PORT, () => {
    console.log(`[OCPP] Servidor OCPP escuchando en el puerto ${OCPP_PORT}`);
});
// --- Handlers ---
function handleBootNotification(client, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        // payload: {chargePointModel, chargePointVendor, ...}
        // Actualiza o inserta el cargador en la base de datos
        const serial = client.id;
        const model = payload.chargePointModel || 'Unknown';
        const firmware = payload.firmwareVersion || 'Unknown';
        try {
            yield db_config_1.connectionPool.query(`INSERT INTO chargers (serial_number, name, model, firmware_version, network_status, status, last_updated)
       VALUES (?, ?, ?, ?, 'online', 'standby', NOW())
       ON DUPLICATE KEY UPDATE model = VALUES(model), firmware_version = VALUES(firmware_version), network_status = 'online', last_updated = NOW()`, [serial, serial, model, firmware]);
            console.log(`[OCPP] BootNotification procesado para ${serial}`);
        }
        catch (err) {
            console.error('[OCPP] Error en BootNotification:', err);
        }
    });
}
function handleStatusNotification(client, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        // payload: {connectorId, status, errorCode, ...}
        const serial = client.id;
        const status = ((_a = payload.status) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || 'standby';
        try {
            yield db_config_1.connectionPool.query(`UPDATE chargers SET status = ?, last_updated = NOW(), network_status = 'online' WHERE serial_number = ?`, [status, serial]);
            console.log(`[OCPP] StatusNotification: ${serial} => ${status}`);
        }
        catch (err) {
            console.error('[OCPP] Error en StatusNotification:', err);
        }
    });
}
function setChargerNetworkStatus(serial, status) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield db_config_1.connectionPool.query(`UPDATE chargers SET network_status = ?, last_updated = NOW() WHERE serial_number = ?`, [status, serial]);
        }
        catch (err) {
            console.error('[OCPP] Error actualizando network_status:', err);
        }
    });
}
// --- Handlers extendidos ---
function handleStartTransaction(client, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        // payload: {connectorId, idTag, meterStart, timestamp}
        // Crear sesión de carga
        try {
            // Buscar user_id por idTag (puede ser el id del usuario)
            const [userRows] = yield db_config_1.connectionPool.query('SELECT id FROM users WHERE id = ?', [payload.idTag]);
            if (!userRows || userRows.length === 0) {
                return { idTagInfo: { status: 'Invalid' }, transactionId: null };
            }
            const userId = userRows[0].id;
            // Crear sesión
            const [result] = yield db_config_1.connectionPool.query(`INSERT INTO charging_sessions (charger_id, user_id, start_time, charging_mode)
       SELECT id, ?, NOW(), 'grid' FROM chargers WHERE serial_number = ?`, [userId, client.id]);
            const transactionId = result.insertId;
            // Log
            yield db_config_1.connectionPool.query(`INSERT INTO charger_logs (charger_id, action_type, raw_data) SELECT id, 'start_transaction', ? FROM chargers WHERE serial_number = ?`, [JSON.stringify(payload), client.id]);
            return { idTagInfo: { status: 'Accepted' }, transactionId };
        }
        catch (err) {
            console.error('[OCPP] Error en StartTransaction:', err);
            return { idTagInfo: { status: 'Invalid' }, transactionId: null };
        }
    });
}
function handleStopTransaction(client, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        // payload: {transactionId, meterStop, timestamp, reason}
        try {
            // Actualizar sesión
            yield db_config_1.connectionPool.query(`UPDATE charging_sessions SET end_time = NOW(), duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()) WHERE id = ?`, [payload.transactionId]);
            // Log
            yield db_config_1.connectionPool.query(`INSERT INTO charger_logs (charger_id, action_type, raw_data) SELECT id, 'stop_transaction', ? FROM chargers WHERE serial_number = ?`, [JSON.stringify(payload), client.id]);
            return { idTagInfo: { status: 'Accepted' } };
        }
        catch (err) {
            console.error('[OCPP] Error en StopTransaction:', err);
            return { idTagInfo: { status: 'Invalid' } };
        }
    });
}

function handleMeterValues(client, payload) {
    return __awaiter(this, void 0, void 0, function* () {
        // payload: {connectorId, transactionId, meterValue: [{timestamp, sampledValue: [{value, measurand, unit}]}]}
        try {
            // Guardar valores de consumo en logs o tabla específica
            yield db_config_1.connectionPool.query(`INSERT INTO charger_logs (charger_id, action_type, raw_data) SELECT id, 'meter_values', ? FROM chargers WHERE serial_number = ?`, [JSON.stringify(payload), client.id]);
            // Puedes extender para guardar valores en charging_sessions si lo deseas
        }
        catch (err) {
            console.error('[OCPP] Error en MeterValues:', err);
        }
    });
}
