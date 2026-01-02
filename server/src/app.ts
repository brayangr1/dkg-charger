import express from 'express';
import cors from 'cors';
import http from 'http';
import authRoutes from '../features/auth/auth.routes';
import chargerRoutes from '../features/chargers/chargers.routes';
import invitationRoutes from '../features/invitations/invitations.routes';
import syncRoutes from '../features/sync/sync.routes';
import adminRoutes from '../features/admin/admin.routes';
import lockingDevicesRoutes from '../features/lockingDevices/lockingDevices.routes';
import supportRoutes from '../features/support/support.routes';
import paymentRoutes from '../features/payments/payments.routes';
import billingRoutes from '../features/billing/billing.routes';
//import walletRoutes from '../features/wallet/routes/wallet.routes';
import WebSocketServer from '../websocket/server';
import { syncService } from '../services/syncService';
import { notificationService } from '../services/notificationService';
import { scheduleExecutor } from '../services/scheduleExecutor';
import { startCronJobs } from '../services/cronService';
import secondaryDeviceRoutes from '../features/secondaryDevice/secondaryDevice.routes';
import { CONFIG } from '../config/env.config';
import { testConnection } from '../config/db.config';
import ocppController from '../features/ocpp/controllers/ocpp.controller';
import '../features/ocpp'; // Importar para iniciar el servidor WebSocket OCPP en el mismo proceso

const app = express();
const server = http.createServer(app);
const PORT = CONFIG.PORT || 5010;

// ✅ CONFIGURACIÓN CORS CORRECTA - DEBE IR PRIMERO
app.use(cors({
    origin: function (origin: string | undefined, callback: (error: Error | null, success?: boolean) => void) {
        // Permitir solicitudes sin origen (como aplicaciones móviles o Postman)
        if (!origin) return callback(null, true);

        // Verificar si el origen está en la lista blanca
        const allowed = CONFIG.CORS_ORIGINS.some(allowedOrigin => {
            // Comprobación exacta
            if (allowedOrigin === origin) return true;
            // Comprobación de comodín para subdominios
            if (allowedOrigin.includes('*')) {
                // Escapar puntos para que el regex sea correcto
                const pattern = allowedOrigin.replace(/\./g, '\\.').replace(/\*/g, '.*');
                const regex = new RegExp('^' + pattern + '$');
                return regex.test(origin);
            }
            // Comprobación para IPs locales
            if (allowedOrigin.includes('192.168.1.*') && origin.match(/^https?:\/\/192\.168\.1\.\d+(:\d+)?$/)) return true;
            return false;
        });

        if (allowed) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Origen bloqueado: ${origin}. No coincide con ninguna regla en CONFIG.CORS_ORIGINS.`);
            callback(new Error('No permitido por CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 86400
}));

// ✅ Middlewares básicos DESPUÉS de CORS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Iniciar servicios
const webSocketServer = new WebSocketServer(server);
syncService.start();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chargers', chargerRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/sync', syncRoutes);

// aqui?
app.use(`/api/admin`, adminRoutes);

app.use('/api/support', supportRoutes);
app.use('/api/locking-devices', lockingDevicesRoutes);
app.use('/api/payments', paymentRoutes);
//app.use('/api/wallet', walletRoutes);
//app.use('/api/ocpp', ocppRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/chargers', secondaryDeviceRoutes);
app.use('/api/ocpp', ocppController);

// Rutas de salud y verificación
app.head('/api/health', (req, res) => {
    res.status(200).end();
});

app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: CONFIG.NODE_ENV,
        version: '1.0.0'
    });
});

// Ruta de prueba de base de datos
app.get('/api/test-db', async (req, res) => {
    try {
        const connectionOk = await testConnection();
        if (connectionOk) {
            res.json({
                success: true,
                message: 'Todas las conexiones a BD funcionando correctamente',
                databases: ['charger', 'devices_db', 'administracion']
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error en una o más conexiones a BD'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error probando conexiones a BD',
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});

//ruta para probar payments
app.get('/api/test-payments', (req, res) => {
    res.json({
        success: true,
        message: 'Ruta de pagos funcionando correctamente'
    });
});

// Ruta de información del sistema
app.get('/api/info', (req, res) => {
    res.json({
        server: {
            name: 'DKG Solutions Backend',
            version: '1.0.0',
            environment: CONFIG.NODE_ENV,
            port: CONFIG.PORT,
            baseUrl: CONFIG.BASE_URL
        },
        database: {
            host: CONFIG.DB_HOST,
            databases: [CONFIG.DB_NAME, CONFIG.DEVICE_DB_NAME, CONFIG.ADMIN_DB_NAME]
        },
        features: {
            email: !!process.env.EMAIL_USER,
            stripe: !!process.env.STRIPE_SECRET_KEY,
            googleAuth: !!process.env.GOOGLE_CLIENT_ID
        }
    });
});

// Ruta de bienvenida
// En tu app.ts, cambia las URLs:
app.get('/', (req, res) => {
    res.json({
        message: ' Backend DKG Solutions funcionando correctamente api y ocpp....!',
        documentation: `${CONFIG.BASE_URL}/api/info`,
        healthCheck: `${CONFIG.BASE_URL}/api/health`,
        databaseTest: `${CONFIG.BASE_URL}/api/test-db`,
        ocppHealth: `${CONFIG.BASE_URL}/api/ocpp/health`,
        ocppChargers: `${CONFIG.BASE_URL}/api/ocpp/connected-chargers`
    });
});

// Exportar instancias
export { webSocketServer, notificationService };

startCronJobs();

// Manejo de errores
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error del servidor:', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: err.message
    });
});

// Ruta no encontrada
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        availableRoutes: [
            'GET /',
            'GET /api/health',
            'GET /api/test-db',
            'GET /api/info'
        ]
    });
});

// Iniciar servidor
async function startServer() {
    try {
        // Probar conexión a BD antes de iniciar
        console.log('🔌 Probando conexiones a base de datos...');
        const dbConnected = await testConnection();

        if (!dbConnected) {
            console.error('❌ No se pudieron establecer todas las conexiones a BD');
            process.exit(1);
        }

        // ⚡ Iniciar monitor de programaciones de carga
        scheduleExecutor.start();

        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
            console.log(`🌐 URL base: ${CONFIG.BASE_URL}`);
            console.log(`🔧 Entorno: ${CONFIG.NODE_ENV}`);
        });

    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

// Manejo graceful de cierre
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servidor...');
    scheduleExecutor.stop(); // Detener monitor de programaciones
    server.close(() => {
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Iniciar el servidor
startServer();

export default app;