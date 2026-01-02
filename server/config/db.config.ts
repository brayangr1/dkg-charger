import mysql from 'mysql2/promise';
import { CONFIG } from './env.config';

// Configuración principal corregida
const dbConfig = {
    host: CONFIG.DB_HOST,
    user: CONFIG.DB_USER,
    password: CONFIG.DB_PASSWORD,
    database: CONFIG.DB_NAME,
    port: CONFIG.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};

// Configuración para la base de datos del fabricante corregida
const deviceDbConfig = {
    host: CONFIG.DEVICE_DB_HOST,
    user: CONFIG.DEVICE_DB_USER,
    password: CONFIG.DEVICE_DB_PASSWORD,
    database: CONFIG.DEVICE_DB_NAME,
    port: CONFIG.DEVICE_DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};

// Configuración para la base de datos de administración
const adminDbConfig = {
    host: CONFIG.ADMIN_DB_HOST,
    user: CONFIG.ADMIN_DB_USER,
    password: CONFIG.ADMIN_DB_PASSWORD,
    database: CONFIG.ADMIN_DB_NAME,
    port: CONFIG.ADMIN_DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};

export const connectionPool = mysql.createPool(dbConfig);
export const deviceDbPool = mysql.createPool(deviceDbConfig);
export const adminDbPool = mysql.createPool(adminDbConfig);

export async function testConnection() {
    let mainConnection, deviceConnection, adminConnection;
    
    try {
        // Test conexión principal
        mainConnection = await connectionPool.getConnection();
        console.log('✅ Conexión exitosa a la base de datos principal (charger)');
        
        // Test conexión deviceDb
        deviceConnection = await deviceDbPool.getConnection();
        console.log('✅ Conexión exitosa a la base de datos del fabricante (devices_db)');
        
        // Test conexión administración
        adminConnection = await adminDbPool.getConnection();
        console.log('✅ Conexión exitosa a la base de datos de administración (administracion)');
        
        return true;
    } catch (err) {
        console.error('❌ Error al conectar a la base de datos:', err);
        return false;
    } finally {
        if (mainConnection) mainConnection.release();
        if (deviceConnection) deviceConnection.release();
        if (adminConnection) adminConnection.release();
    }
}

// Función para obtener estadísticas de conexiones
export async function getConnectionStats() {
    try {
        const [mainStats] = await connectionPool.execute('SELECT COUNT(*) as connections FROM information_schema.processlist WHERE db = ?', [CONFIG.DB_NAME]);
        const [deviceStats] = await deviceDbPool.execute('SELECT COUNT(*) as connections FROM information_schema.processlist WHERE db = ?', [CONFIG.DEVICE_DB_NAME]);
        const [adminStats] = await adminDbPool.execute('SELECT COUNT(*) as connections FROM information_schema.processlist WHERE db = ?', [CONFIG.ADMIN_DB_NAME]);
        
        return {
            charger: mainStats,
            devices_db: deviceStats,
            administracion: adminStats
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return null;
    }
}