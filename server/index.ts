import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/db.config';
import { testDeviceConnection } from './config/deviceDb.config';
import chargerRoutes from './features/chargers/chargers.routes';
import userRoutes from './features/auth/auth.routes';
import syncRoutes from './features/sync/sync.routes';
import adminRoutes from './features/admin/admin.routes';
import paymentRoutes from './features/payments/payments.routes';
import { syncService } from './services/syncService';
import CONFIG from './config/env.config';
import bluetoothRoutes from './features/ocpp/routes/bluetooth.routes';

import http from 'http';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = CONFIG.PORT;

// Middleware
app.use(cors({
  origin: function (origin, callback) { 
    // Permitir solicitudes sin origen (como móvil)
    if (!origin) return callback(null, true);
    
    // Verificar si el origen está exactamente en la lista
    if (CONFIG.CORS_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Rutas
app.use('/api/chargers', chargerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/ocpp', bluetoothRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

// Pruebas de conexión a ambas bases de datos
testConnection();
testDeviceConnection();

// Iniciar servicio de sincronización
//syncService.startPolling();

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

export default app;