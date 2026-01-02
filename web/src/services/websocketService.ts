
import { getToken } from './authService';
import toast from 'react-hot-toast';

// Event Emitter for web
class EventEmitter {
    private events: { [key: string]: Function[] } = {};

    on(event: string, listener: Function) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }

    off(event: string, listener: Function) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(l => l !== listener);
    }

    emit(event: string, ...args: any[]) {
        if (!this.events[event]) return;
        this.events[event].forEach(listener => listener(...args));
    }
}

// Custom events
export const CHARGING_UPDATE_EVENT = 'charging-update';
export const STATUS_UPDATE_EVENT = 'status-update';

const eventEmitter = new EventEmitter();

interface WebSocketMessage {
    type: string;
    chargerId?: number;
    status?: string;
    networkStatus?: string;
    energy?: number;
    power?: number;
    duration?: number;
    cost?: number;
    ratePerKwh?: number;
    alertType?: string;
    message?: string;
    value?: number;
    timestamp?: string;
    session?: any;
    // Optimized fields from backend
    c?: number; // chargerId
    t?: string; // timestamp
    e?: number; // energy
    p?: number; // power
    d?: number; // duration
    cst?: number; // cost
    r?: number; // rate
}

class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectInterval = 5000;
    private isConnected = false;
    private subscribedChargers: Set<number> = new Set();
    private reconnectTimeoutId: number | null = null;

    public async connect() {
        try {
            const token = await getToken();
            if (!token) {
               // console.error('No authentication token available');
                toast.error('No se pudo obtener el token de autenticación');
                return;
            }

            // WebSocket connection to server
            // Note: WebSocket proxy doesn't work in Vite, so we use full URL
            const wsUrl = `wss://server.dkgsolutions.es/ws?token=${token}`;
           // console.log('[WebSocketService] Connecting to:', wsUrl);

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                //console.log('[WebSocketService] Connection successfully opened');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                toast.success('Conexión WebSocket establecida');

                // Resubscribe to chargers after reconnect
                this.subscribedChargers.forEach(chargerId => {
                    this.subscribeToCharger(chargerId);
                });
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
              //  console.log('[WebSocketService] Disconnected');
                this.isConnected = false;
                this.handleReconnect();
            };

           // this.ws.onerror = (error) => {
               // console.error('[WebSocketService] Error:', error);
                // No mostrar toast aquí porque el error también se dispara en onclose
         //   };

        } catch (error) {
           // console.error('Error connecting to WebSocket:', error);
            toast.error('Error al intentar conectar con el servidor WebSocket');
            this.handleReconnect();
        }
    }

    private handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isConnected) {
            this.reconnectAttempts++;
            //console.log(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            toast(`Reintentando conexión (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, { icon: '🔄' });

            if (this.reconnectTimeoutId) {
                clearTimeout(this.reconnectTimeoutId);
            }

            this.reconnectTimeoutId = window.setTimeout(() => {
                this.connect();
            }, this.reconnectInterval * Math.min(this.reconnectAttempts, 3)); // Limitar intervalo máximo a 3x
        } else if (!this.isConnected) {
            //console.error('Max reconnection attempts reached');
            toast.error('No se pudo conectar al servidor en tiempo real. Intente recargar la página.');
        }
    }

    private handleMessage(message: WebSocketMessage) {
        switch (message.type) {
            case 'status_update':
                this.handleStatusUpdate(message);
                break;

            case 'charging_update':
                this.handleChargingUpdate(message);
                break;

            case 'alert':
                this.handleAlert(message);
                break;

            case 'new_session':
                this.handleNewSession(message);
                break;

            case 'error':
                this.handleError(message);
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    }

    private handleStatusUpdate(message: WebSocketMessage) {
        if (!message.chargerId) return;

        // Show notification for important state changes
        if (message.status === 'error' || message.status === 'offline' || message.status === 'powered_off') {
            let text = '';

            switch (message.status) {
                case 'offline':
                    text = 'El cargador ha perdido la conexión';
                    toast.error(text);
                    break;
                case 'powered_off':
                    text = 'El cargador está apagado';
                    toast.error(text);
                    break;
                case 'error':
                    text = 'El cargador ha reportado un error';
                    toast.error(text);
                    break;
            }
        }

       /* console.log('[WebSocketService] Status update:', {
            chargerId: message.chargerId,
            status: message.status,
            networkStatus: message.networkStatus
        });*/

        // Emit event for components
        eventEmitter.emit(STATUS_UPDATE_EVENT, {
            chargerId: message.chargerId,
            status: message.status,
            networkStatus: message.networkStatus
        });
    }

    private handleChargingUpdate(message: WebSocketMessage) {
        const chargerId = message.c || message.chargerId;
        if (!chargerId) return;

        const chargingData = {
            chargerId: chargerId,
            energy: message.e || message.energy || 0,
            power: message.p || message.power || 0,
            duration: message.d || message.duration || 0,
            cost: message.cst || message.cost || 0,
            ratePerKwh: message.r || message.ratePerKwh,
            timestamp: message.t || message.timestamp || new Date().toISOString()
        };

        //console.log('⚡ Charging update:', chargingData);

        // Emit event for components
        eventEmitter.emit(CHARGING_UPDATE_EVENT, chargingData);
    }

    private handleAlert(message: WebSocketMessage) {
        if (!message.chargerId || !message.alertType) return;

        switch (message.alertType) {
            case 'high_consumption':
                toast.error(message.message || 'Alto consumo detectado');
                break;

            case 'cost_limit':
                toast.error(message.message || 'Límite de costo alcanzado');
                break;

            case 'connection_lost':
                toast.error(message.message || 'Cargador desconectado');
                break;

            case 'error':
                toast.error(message.message || 'Error en el cargador');
                break;

            default:
                toast.success(message.message || 'Nueva alerta del sistema');
        }

        /*console.log('[WebSocketService] Alert:', {
            chargerId: message.chargerId,
            alertType: message.alertType,
            message: message.message
        });*/
    }

    private handleNewSession(message: WebSocketMessage) {
        if (!message.chargerId) return;
        toast.success('Nueva sesión de carga iniciada');
    }

    private handleError(message: WebSocketMessage) {
        console.error('[WebSocketService] Error message:', message);
        toast.error(message.message || 'Error en la conexión');
    }

    public subscribeToCharger(chargerId: number) {
        if (!this.isConnected || !this.ws) {
            console.warn('WebSocket not connected, cannot subscribe');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'subscribe',
            chargerId
        }));

        this.subscribedChargers.add(chargerId);
    }

    public unsubscribeFromCharger(chargerId: number) {
        this.subscribedChargers.delete(chargerId);
    }

    public disconnect() {
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.subscribedChargers.clear();
    }

    public isWebSocketConnected(): boolean {
        return this.isConnected;
    }

    public getSubscribedChargers(): number[] {
        return Array.from(this.subscribedChargers);
    }

    // Subscribe to events
    public onChargingUpdate(listener: (data: any) => void) {
        eventEmitter.on(CHARGING_UPDATE_EVENT, listener);
    }

    public offChargingUpdate(listener: (data: any) => void) {
        eventEmitter.off(CHARGING_UPDATE_EVENT, listener);
    }

    public onStatusUpdate(listener: (data: any) => void) {
        eventEmitter.on(STATUS_UPDATE_EVENT, listener);
    }

    public offStatusUpdate(listener: (data: any) => void) {
        eventEmitter.off(STATUS_UPDATE_EVENT, listener);
    }
}

export default new WebSocketService();