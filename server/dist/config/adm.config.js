"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminConnection = getAdminConnection;
const promise_1 = require("mysql2/promise");
async function getAdminConnection() {
    const pool = (0, promise_1.createPool)({
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
