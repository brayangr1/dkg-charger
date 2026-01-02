import { createPool, Pool, PoolConnection } from 'mysql2/promise';

export async function getAdminConnection(): Promise<PoolConnection> {
    const pool = createPool({
        host: process.env.ADMIN_DB_HOST || 'localhost',
        user: process.env.ADMIN_DB_USER || 'appdkg',
        password: process.env.ADMIN_DB_PASSWORD || 'Dkg010203',
        database: 'administracion',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    return pool.getConnection();
}