// Conexión a la segunda base de datos (la del fabricante)
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const deviceDbConfig = {
  host: process.env.DEVICE_DB_HOST || 'localhost',
  user: process.env.DEVICE_DB_USER || 'appdkg',
  password: process.env.DEVICE_DB_PASSWORD || 'Dkg010203s',
  database: process.env.DEVICE_DB_NAME || 'devices_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

export const deviceDbPool = mysql.createPool(deviceDbConfig);

// Probar conexión
export async function testDeviceConnection() {
  let connection;
  try {
    connection = await deviceDbPool.getConnection();
    console.log('✔ Conectado a la base de datos de dispositivos');
    return true;
  } catch (err) {
    console.error('❌ Error al conectar a la base de datos de dispositivos:', err);
    return false;
  } finally {
    if (connection) connection.release();
  }
}
