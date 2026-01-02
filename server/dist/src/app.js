"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.webSocketServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const auth_routes_1 = __importDefault(require("../features/auth/auth.routes"));
const chargers_routes_1 = __importDefault(require("../features/chargers/chargers.routes"));
const invitations_routes_1 = __importDefault(require("../features/invitations/invitations.routes"));
const sync_routes_1 = __importDefault(require("../features/sync/sync.routes"));
const lockingDevices_routes_1 = __importDefault(require("../features/lockingDevices/lockingDevices.routes"));
const support_routes_1 = __importDefault(require("../features/support/support.routes"));
const payments_routes_1 = __importDefault(require("../features/payments/payments.routes"));
const billing_routes_1 = __importDefault(require("../features/billing/billing.routes"));
const server_1 = __importDefault(require("../websocket/server"));
const syncService_1 = require("../services/syncService");
const notificationService_1 = require("../services/notificationService");
Object.defineProperty(exports, "notificationService", { enumerable: true, get: function () { return notificationService_1.notificationService; } });
const scheduleExecutor_1 = require("../features/chargers/scheduleExecutor");
const cronService_1 = require("../services/cronService");
const secondaryDevice_routes_1 = __importDefault(require("../features/secondaryDevice/secondaryDevice.routes"));
const env_config_1 = require("../config/env.config");
const db_config_1 = require("../config/db.config");
const ocpp_controller_1 = __importDefault(require("../features/ocpp/controllers/ocpp.controller"));
require("../features/ocpp"); // Importar para iniciar el servidor WebSocket OCPP en el mismo proceso
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const PORT = env_config_1.CONFIG.PORT || 5010;
// ✅ CONFIGURACIÓN CORS CORRECTA - DEBE IR PRIMERO
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Permitir solicitudes sin origen (como aplicaciones móviles o Postman)
        if (!origin)
            return callback(null, true);
        // Verificar si el origen está en la lista blanca
        const allowed = env_config_1.CONFIG.CORS_ORIGINS.some(allowedOrigin => {
            // Comprobación exacta
            if (allowedOrigin === origin)
                return true;
            // Comprobación de comodín para subdominios
            if (allowedOrigin.includes('*')) {
                const regex = new RegExp('^' + allowedOrigin.replace(/\*/g, '.*') + '$');
                return regex.test(origin);
            }
            // Comprobación para IPs locales
            if (allowedOrigin.includes('192.168.1.*') && origin.match(/^https?:\/\/192\.168\.1\.\d+(:\d+)?$/))
                return true;
            return false;
        });
        if (allowed) {
            callback(null, true);
        }
        else {
            console.log('Origen bloqueado por CORS:', origin);
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
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Iniciar servicios
const webSocketServer = new server_1.default(server);
exports.webSocketServer = webSocketServer;
syncService_1.syncService.start();
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/chargers', chargers_routes_1.default);
app.use('/api/invitations', invitations_routes_1.default);
app.use('/api/sync', sync_routes_1.default);
app.use('/api/support', support_routes_1.default);
app.use('/api/locking-devices', lockingDevices_routes_1.default);
app.use('/api/payments', payments_routes_1.default);
//app.use('/api/ocpp', ocppRoutes);
app.use('/api/billing', billing_routes_1.default);
app.use('/api/chargers', secondaryDevice_routes_1.default);
app.use('/api/ocpp', ocpp_controller_1.default);
// Rutas de salud y verificación
app.head('/api/health', (req, res) => {
    res.status(200).end();
});
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env_config_1.CONFIG.NODE_ENV,
        version: '1.0.0'
    });
});
// Ruta de prueba de base de datos
app.get('/api/test-db', async (req, res) => {
    try {
        const connectionOk = await (0, db_config_1.testConnection)();
        if (connectionOk) {
            res.json({
                success: true,
                message: 'Todas las conexiones a BD funcionando correctamente',
                databases: ['charger', 'devices_db', 'administracion']
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: 'Error en una o más conexiones a BD'
            });
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error probando conexiones a BD',
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
});
// Ruta de información del sistema
app.get('/api/info', (req, res) => {
    res.json({
        server: {
            name: 'DKG Solutions Backend',
            version: '1.0.0',
            environment: env_config_1.CONFIG.NODE_ENV,
            port: env_config_1.CONFIG.PORT,
            baseUrl: env_config_1.CONFIG.BASE_URL
        },
        database: {
            host: env_config_1.CONFIG.DB_HOST,
            databases: [env_config_1.CONFIG.DB_NAME, env_config_1.CONFIG.DEVICE_DB_NAME, env_config_1.CONFIG.ADMIN_DB_NAME]
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
        documentation: `${env_config_1.CONFIG.BASE_URL}/api/info`,
        healthCheck: `${env_config_1.CONFIG.BASE_URL}/api/health`,
        databaseTest: `${env_config_1.CONFIG.BASE_URL}/api/test-db`,
        ocppHealth: `${env_config_1.CONFIG.BASE_URL}/api/ocpp/health`,
        ocppChargers: `${env_config_1.CONFIG.BASE_URL}/api/ocpp/connected-chargers`
    });
});
(0, scheduleExecutor_1.startScheduleExecutor)();
(0, cronService_1.startCronJobs)();
// Manejo de errores
app.use((err, req, res, next) => {
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
        const dbConnected = await (0, db_config_1.testConnection)();
        if (!dbConnected) {
            console.error('❌ No se pudieron establecer todas las conexiones a BD');
            process.exit(1);
        }
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
            console.log(`🌐 URL base: ${env_config_1.CONFIG.BASE_URL}`);
            console.log(`🔧 Entorno: ${env_config_1.CONFIG.NODE_ENV}`);
        });
    }
    catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
}
// Manejo graceful de cierre
process.on('SIGINT', () => {
    console.log('\n🛑 Cerrando servidor...');
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
exports.default = app;
