"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const pool = promise_1.default.createPool({
    host: 'localhost',
    user: 'appdkg', // Ajusta según tu configuración
    password: 'Dkg010203', // Ajusta según tu configuración
    database: 'charger_app',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
exports.db = {
    async query(sql, params) {
        try {
            const [results, fields] = await pool.execute(sql, params);
            return [results, fields];
        }
        catch (error) {
            console.error('Error en la consulta SQL:', error);
            throw error;
        }
    }
};
