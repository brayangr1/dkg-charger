"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminDbPool = exports.deviceDbPool = exports.connectionPool = void 0;
exports.testConnection = testConnection;
exports.getConnectionStats = getConnectionStats;
const promise_1 = __importDefault(require("mysql2/promise"));
const env_config_1 = require("./env.config");
// Configuración principal corregida
const dbConfig = {
    host: env_config_1.CONFIG.DB_HOST,
    user: env_config_1.CONFIG.DB_USER,
    password: env_config_1.CONFIG.DB_PASSWORD,
    database: env_config_1.CONFIG.DB_NAME,
    port: env_config_1.CONFIG.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};
// Configuración para la base de datos del fabricante corregida
const deviceDbConfig = {
    host: env_config_1.CONFIG.DEVICE_DB_HOST,
    user: env_config_1.CONFIG.DEVICE_DB_USER,
    password: env_config_1.CONFIG.DEVICE_DB_PASSWORD,
    database: env_config_1.CONFIG.DEVICE_DB_NAME,
    port: env_config_1.CONFIG.DEVICE_DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};
// Configuración para la base de datos de administración
const adminDbConfig = {
    host: env_config_1.CONFIG.ADMIN_DB_HOST,
    user: env_config_1.CONFIG.ADMIN_DB_USER,
    password: env_config_1.CONFIG.ADMIN_DB_PASSWORD,
    database: env_config_1.CONFIG.ADMIN_DB_NAME,
    port: env_config_1.CONFIG.ADMIN_DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};
exports.connectionPool = promise_1.default.createPool(dbConfig);
exports.deviceDbPool = promise_1.default.createPool(deviceDbConfig);
exports.adminDbPool = promise_1.default.createPool(adminDbConfig);
async function testConnection() {
    let mainConnection, deviceConnection, adminConnection;
    try {
        // Test conexión principal
        mainConnection = await exports.connectionPool.getConnection();
        console.log('✅ Conexión exitosa a la base de datos principal (charger)');
        // Test conexión deviceDb
        deviceConnection = await exports.deviceDbPool.getConnection();
        console.log('✅ Conexión exitosa a la base de datos del fabricante (devices_db)');
        // Test conexión administración
        adminConnection = await exports.adminDbPool.getConnection();
        console.log('✅ Conexión exitosa a la base de datos de administración (administracion)');
        return true;
    }
    catch (err) {
        console.error('❌ Error al conectar a la base de datos:', err);
        return false;
    }
    finally {
        if (mainConnection)
            mainConnection.release();
        if (deviceConnection)
            deviceConnection.release();
        if (adminConnection)
            adminConnection.release();
    }
}
// Función para obtener estadísticas de conexiones
async function getConnectionStats() {
    try {
        const [mainStats] = await exports.connectionPool.execute('SELECT COUNT(*) as connections FROM information_schema.processlist WHERE db = ?', [env_config_1.CONFIG.DB_NAME]);
        const [deviceStats] = await exports.deviceDbPool.execute('SELECT COUNT(*) as connections FROM information_schema.processlist WHERE db = ?', [env_config_1.CONFIG.DEVICE_DB_NAME]);
        const [adminStats] = await exports.adminDbPool.execute('SELECT COUNT(*) as connections FROM information_schema.processlist WHERE db = ?', [env_config_1.CONFIG.ADMIN_DB_NAME]);
        return {
            charger: mainStats,
            devices_db: deviceStats,
            administracion: adminStats
        };
    }
    catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return null;
    }
}
