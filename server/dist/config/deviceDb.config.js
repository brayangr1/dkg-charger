"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceDbPool = void 0;
exports.testDeviceConnection = testDeviceConnection;
// Conexión a la segunda base de datos (la del fabricante)
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const deviceDbConfig = {
    host: process.env.DEVICE_DB_HOST || 'localhost',
    user: process.env.DEVICE_DB_USER || 'appdkg',
    password: process.env.DEVICE_DB_PASSWORD || 'Dkg010203s',
    database: process.env.DEVICE_DB_NAME || 'devices_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
exports.deviceDbPool = promise_1.default.createPool(deviceDbConfig);
// Probar conexión
async function testDeviceConnection() {
    let connection;
    try {
        connection = await exports.deviceDbPool.getConnection();
        console.log('✔ Conectado a la base de datos de dispositivos');
        return true;
    }
    catch (err) {
        console.error('❌ Error al conectar a la base de datos de dispositivos:', err);
        return false;
    }
    finally {
        if (connection)
            connection.release();
    }
}
