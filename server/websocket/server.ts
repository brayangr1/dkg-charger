import WebSocket from 'ws';
import http from 'http';
import { connectionPool } from '../config/db.config';
import { verifyToken } from '../middlewares/auth';
import { ChargerNetworkStatus, ChargerStatus, StatusUpdatePayload } from '../features/chargers/charger.model';
import { RowDataPacket } from 'mysql2/promise';

interface ClientMetadata {
  userId: number;
  connectedAt: Date;
  chargerIds: Set<number>;
}

// Extender tipo WebSocket para incluir isAlive
declare global {
  namespace WebSocket {
    interface WebSocket {
      isAlive?: boolean;
    }
  }
}

class WebSocketServer {
  private wss: WebSocket.Server;
  private clients: Map<number, WebSocket[]> = new Map(); // chargerId -> clients[]
  private clientMetadata: Map<WebSocket, ClientMetadata> = new Map(); // WebSocket -> metadata
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: http.Server) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });

    console.log('✅ WebSocket Server inicializado en ruta /ws');

    this.wss.on('connection', (ws, req) => {
      const token = req.url?.split('token=')[1];
      if (!token) {
        console.warn('⚠️ Conexión rechazada: sin token');
        ws.close(1008, 'Unauthorized');
        return;
      }

      try {
        const decoded = verifyToken(token);
        const userId = decoded.id;

        // Almacenar metadata del cliente
        this.clientMetadata.set(ws, {
          userId,
          connectedAt: new Date(),
          chargerIds: new Set()
        });

        console.log(`✅ Usuario ${userId} conectado a WebSocket`);

        // Configurar heartbeat para detectar desconexiones
        (ws as any).isAlive = true;
        ws.on('pong', () => {
          (ws as any).isAlive = true;
        });

        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message.toString());
            this.handleMessage(userId, ws, data);
          } catch (error) {
            console.error('❌ Error al procesar mensaje:', error);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Formato de mensaje inválido'
            }));
          }
        });

        ws.on('error', (error) => {
          console.error(`❌ Error en WebSocket para usuario ${userId}:`, error);
        });

        ws.on('close', () => {
          this.handleDisconnect(userId, ws);
          console.log(`❌ Usuario ${userId} desconectado`);
        });
      } catch (error) {
        console.error('❌ Error de autenticación:', error);
        ws.close(1008, 'Invalid token');
      }
    });

    // Iniciar heartbeat
    this.startHeartbeat();
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: any) => {
        const wsWithAlive = ws as any;
        if (wsWithAlive.isAlive === false) {
          return ws.terminate();
        }
        wsWithAlive.isAlive = false;
        ws.ping();
      });
    }, 30000) as unknown as NodeJS.Timeout; // Cada 30 segundos
  }

  private handleMessage(userId: number, ws: WebSocket, data: any) {
    if (data.type === 'subscribe') {
      this.subscribeToCharger(userId, ws, data.chargerId);
    } else if (data.type === 'unsubscribe') {
      this.unsubscribeFromCharger(ws, data.chargerId);
    } else if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  }

  private async subscribeToCharger(userId: number, ws: WebSocket, chargerId: number) {
    try {
      const [results] = await connectionPool.query<RowDataPacket[]>(
        'SELECT 1 FROM charger_users WHERE user_id = ? AND charger_id = ?',
        [userId, chargerId]
      );

      if (results.length === 0) {
        console.warn(`⚠️ Usuario ${userId} sin acceso al cargador ${chargerId}`);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'No access to charger'
        }));
        return;
      }

      if (!this.clients.has(chargerId)) {
        this.clients.set(chargerId, []);
      }

      const clients = this.clients.get(chargerId);
      if (clients && !clients.includes(ws)) {
        clients.push(ws);
      }

      // Actualizar metadata
      const metadata = this.clientMetadata.get(ws);
      if (metadata) {
        metadata.chargerIds.add(chargerId);
      }

      console.log(`✅ Usuario ${userId} suscrito al cargador ${chargerId}`);

      ws.send(JSON.stringify({
        type: 'subscribed',
        chargerId,
        message: `Suscrito al cargador ${chargerId}`
      }));
    } catch (err) {
      console.error(`❌ Error verificando acceso al cargador ${chargerId}:`, err);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error verifying access'
      }));
    }
  }

  private unsubscribeFromCharger(ws: WebSocket, chargerId: number) {
    const clients = this.clients.get(chargerId);
    if (clients) {
      this.clients.set(chargerId, clients.filter(client => client !== ws));
    }

    const metadata = this.clientMetadata.get(ws);
    if (metadata) {
      metadata.chargerIds.delete(chargerId);
    }

    console.log(`👋 Cliente desuscrito del cargador ${chargerId}`);
  }

  private handleDisconnect(userId: number, ws: WebSocket) {
    const metadata = this.clientMetadata.get(ws);

    // Eliminar de todos los cargadores
    this.clients.forEach((clients, chargerId) => {
      const filtered = clients.filter(client => client !== ws);
      if (filtered.length === 0) {
        this.clients.delete(chargerId); // Limpiar entrada vacía
      } else {
        this.clients.set(chargerId, filtered);
      }
    });

    // Limpiar metadata
    this.clientMetadata.delete(ws);

    console.log(`🧹 Limpieza completada para usuario ${userId}`);
  }

  public notifyStatusChange(
    chargerId: number, 
    status: ChargerStatus, 
    networkStatus: ChargerNetworkStatus,
    additionalData?: Omit<StatusUpdatePayload, 'chargerId' | 'status' | 'networkStatus' | 'timestamp'>
  ) {
    const clients = this.clients.get(chargerId) || [];
    
    if (clients.length === 0) {
      console.log(`ℹ️ Sin clientes suscritos al cargador ${chargerId}`);
      return;
    }

    const message: StatusUpdatePayload = {
      chargerId,
      status,
      networkStatus,
      timestamp: new Date().toISOString(),
      ...additionalData
    };

    let sentCount = 0;
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({
            type: 'status_update',
            ...message
          }));
          sentCount++;
        } catch (error) {
          console.error(`❌ Error enviando actualización de estado:`, error);
        }
      }
    });

    console.log(`📡 Status Update - Cargador ${chargerId}: ${status} (Enviado a ${sentCount}/${clients.length} clientes)`);
  }

  public notifyNewSession(chargerId: number, session: any) {
    const clients = this.clients.get(chargerId) || [];
    
    if (clients.length === 0) {
      console.log(`ℹ️ Sin clientes suscritos al cargador ${chargerId} para nueva sesión`);
      return;
    }

    let sentCount = 0;
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({
            type: 'new_session',
            chargerId,
            session,
            timestamp: new Date().toISOString()
          }));
          sentCount++;
        } catch (error) {
          console.error(`❌ Error enviando nueva sesión:`, error);
        }
      }
    });

    console.log(`📡 New Session - Cargador ${chargerId}: Enviado a ${sentCount}/${clients.length} clientes`);
  }

  // Método específico para actualizaciones de carga con optimización
  public notifyChargingUpdate(chargerId: number, data: {
    energy: number;
    power: number;
    duration: number;
    cost: number;
    ratePerKwh?: number;
  }) {
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
      if (client.readyState === WebSocket.OPEN) {
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

  public notifyAlert(chargerId: number, alert: {
    alertType: string;
    message: string;
    value?: number;
    timestamp?: string;
  }) {
    const clients = this.clients.get(chargerId) || [];
    
    if (clients.length === 0) {
      console.log(`ℹ️ Sin clientes suscritos al cargador ${chargerId} para alerta`);
      return;
    }

    const payload = {
      type: 'alert',
      chargerId,
      alertType: alert.alertType,
      message: alert.message,
      value: alert.value,
      timestamp: alert.timestamp || new Date().toISOString(),
    };

    let sentCount = 0;
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(payload));
          sentCount++;
        } catch (error) {
          console.error(`❌ Error enviando alerta:`, error);
        }
      }
    });

    console.log(`🚨 Alert - Cargador ${chargerId} (${alert.alertType}): Enviado a ${sentCount}/${clients.length} clientes`);
  }

  public getConnectionStats() {
    const stats = {
      totalClients: this.clientMetadata.size,
      chargers: {} as Record<number, number>,
      clientDetails: [] as any[]
    };

    // Contar clientes por cargador
    this.clients.forEach((clients, chargerId) => {
      stats.chargers[chargerId] = clients.length;
    });

    // Detalles de cada cliente
    this.clientMetadata.forEach((metadata, ws) => {
      stats.clientDetails.push({
        userId: metadata.userId,
        chargerIds: Array.from(metadata.chargerIds),
        connectedAt: metadata.connectedAt,
        readyState: ws.readyState === WebSocket.OPEN ? 'OPEN' : 'CLOSED'
      });
    });

    return stats;
  }

  public closeAllConnections(code: number = 1000, reason: string = 'Server closing') {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(code, reason);
      }
    });

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    console.log('🛑 Todas las conexiones WebSocket cerradas');
  }
}

export default WebSocketServer;