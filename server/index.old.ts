import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/db.config';
import { testDeviceConnection } from './config/deviceDb.config';
import chargerRoutes from './features/chargers/chargers.routes';
import userRoutes from './features/auth/auth.routes';
import syncRoutes from './features/sync/sync.routes';
import { syncService } from './services/syncService';
import CONFIG from './config/env.config';

import http from 'http';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = CONFIG.PORT;

// Middleware
app.use(cors({
  origin: CONFIG.CORS_ORIGINS,
  credentials: true
}));
app.use(express.json());

// Rutas
app.use('/api/chargers', chargerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sync', syncRoutes);

// Pruebas de conexión a ambas bases de datos
testConnection();
testDeviceConnection();

// Iniciar servicio de sincronización
//syncService.startPolling();

// Crear servidor WebSocket
createWebSocketServer(server);

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

function createWebSocketServer(server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>) {
  throw new Error('Function not implemented.');
}