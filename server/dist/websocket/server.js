"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const db_config_1 = require("../config/db.config");
const auth_1 = require("../middlewares/auth");
class WebSocketServer {
    constructor(server) {
        this.clients = new Map(); // chargerId -> clients[]
        this.wss = new ws_1.default.Server({ server });
        this.wss.on('connection', (ws, req) => {
            const token = req.url?.split('token=')[1];
            if (!token) {
                ws.close(1008, 'Unauthorized');
                return;
            }
            try {
                const decoded = (0, auth_1.verifyToken)(token);
                const userId = decoded.id;
                ws.on('message', (message) => {
                    const data = JSON.parse(message.toString());
                    this.handleMessage(userId, ws, data);
                });
                ws.on('close', () => this.handleDisconnect(userId, ws));
            }
            catch (error) {
                ws.close(1008, 'Invalid token');
            }
        });
    }
    handleMessage(userId, ws, data) {
        if (data.type === 'subscribe') {
            this.subscribeToCharger(userId, ws, data.chargerId);
        }
    }
    async subscribeToCharger(userId, ws, chargerId) {
        try {
            const [results] = await db_config_1.connectionPool.query('SELECT 1 FROM charger_users WHERE user_id = ? AND charger_id = ?', [userId, chargerId]);
            if (results.length === 0) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'No access to charger'
                }));
                return;
            }
            if (!this.clients.has(chargerId)) {
                this.clients.set(chargerId, []);
            }
            this.clients.get(chargerId)?.push(ws);
        }
        catch (err) {
            console.error('Error verifying charger access:', err);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Error verifying access'
            }));
        }
    }
    handleDisconnect(userId, ws) {
        this.clients.forEach((clients, chargerId) => {
            this.clients.set(chargerId, clients.filter(client => client !== ws));
        });
    }
    notifyStatusChange(chargerId, status, networkStatus, additionalData) {
        const clients = this.clients.get(chargerId) || [];
        const message = {
            chargerId,
            status,
            networkStatus,
            timestamp: new Date().toISOString(),
            ...additionalData
        };
        clients.forEach(client => {
            client.send(JSON.stringify({
                type: 'status_update',
                ...message
            }));
        });
    }
    notifyNewSession(chargerId, session) {
        const clients = this.clients.get(chargerId) || [];
        clients.forEach(client => {
            client.send(JSON.stringify({
                type: 'new_session',
                chargerId,
                session
            }));
        });
    }
    // Método específico para actualizaciones de carga con optimización
    notifyChargingUpdate(chargerId, data) {
        const clients = this.clients.get(chargerId) || [];
        // Optimizar payload: redondear valores y eliminar campos innecesarios
        const optimizedPayload = {
            type: 'charging_update',
            c: chargerId, // Abreviar chargerId
            t: new Date().toISOString(), // Abreviar timestamp
            e: Math.round(data.energy * 10000) / 10000, // Energía con 4 decimales
            p: Math.round(data.power * 100) / 100, // Potencia con 2 decimales
            d: Math.round(data.duration), // Duración en segundos
            cst: Math.round(data.cost * 100) / 100, // Costo con 2 decimales
            r: data.ratePerKwh ? Math.round(data.ratePerKwh * 100) / 100 : undefined
        };
        // Enviar a todos los clientes suscritos
        clients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify(optimizedPayload));
            }
        });
        // Log para debugging
        console.log(`📡 WebSocket: Enviando actualización de carga para cargador ${chargerId}:`, {
            energy: optimizedPayload.e,
            power: optimizedPayload.p,
            duration: optimizedPayload.d,
            cost: optimizedPayload.cst,
            clients: clients.length
        });
    }
    notifyAlert(chargerId, alert) {
        const clients = this.clients.get(chargerId) || [];
        const payload = {
            type: 'alert',
            chargerId,
            alertType: alert.alertType,
            message: alert.message,
            value: alert.value,
            timestamp: alert.timestamp || new Date().toISOString(),
        };
        clients.forEach(client => {
            client.send(JSON.stringify(payload));
        });
    }
}
exports.default = WebSocketServer;
