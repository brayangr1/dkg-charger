#!/usr/bin/env ts-node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = require("mysql2/promise");
const dotenv = __importStar(require("dotenv"));
const commander_1 = require("commander");
// Carga las variables de entorno desde el archivo .env en la raíz del servidor
dotenv.config();
class ChargerEmulator {
    constructor() {
        // Asegúrate de que las variables de entorno para la DB de dispositivos existan
        if (!process.env.DEVICE_DB_HOST || !process.env.DEVICE_DB_USER || !process.env.DEVICE_DB_NAME) {
            throw new Error('La configuración para devices_db no está en el archivo .env (DEVICE_DB_HOST, DEVICE_DB_USER, DEVICE_DB_NAME)');
        }
        this.dbPool = (0, promise_1.createPool)({
            host: process.env.DEVICE_DB_HOST,
            user: process.env.DEVICE_DB_USER,
            password: process.env.DEVICE_DB_PASSWORD || '', // Permite contraseñas vacías
            database: process.env.DEVICE_DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }
    /**
     * Aprovisiona un nuevo cargador virtual en la base de datos de dispositivos.
     * @param serial Número de serie del cargador
     */
    provisionDevice(serial) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield this.dbPool.getConnection();
            try {
                console.log(`[INFO] Verificando existencia del dispositivo con serial: ${serial}`);
                const [devices] = yield connection.query('SELECT * FROM devices WHERE serial = ?', [serial]);
                let deviceId;
                if (devices.length > 0) {
                    deviceId = devices[0].id;
                    console.log(`[INFO] Dispositivo existente encontrado con ID: ${deviceId}`);
                }
                else {
                    const deviceData = {
                        serial,
                        name: `Virtual Wallbox ${serial}`,
                        model: 'EMT-V1',
                        version_sw: '1.0.0-emulator'
                    };
                    const [result] = yield connection.query('INSERT INTO devices SET ?', [deviceData]);
                    deviceId = result.insertId;
                    console.log(`[SUCCESS] Nuevo dispositivo creado con ID: ${deviceId}`);
                }
                const [details] = yield connection.query('SELECT * FROM details WHERE device_id = ?', [deviceId]);
                if (details.length === 0) {
                    yield connection.query('INSERT INTO details (device_id, power, temperature, last_updated) VALUES (?, ?, ?, ?)', [deviceId, 0, 25, new Date()]);
                    console.log('[SUCCESS] Detalles iniciales del dispositivo creados');
                }
                else {
                    console.log('[INFO] Detalles del dispositivo ya existían');
                }
                const createLogTableQuery = `
        CREATE TABLE IF NOT EXISTS \`charging_log_${serial}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          start_time DATETIME,
          end_time DATETIME NULL,
          energy_kwh DECIMAL(10,4) NULL,
          power_peak INT NULL,
          rate_per_kwh DECIMAL(10,4),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
      `;
                yield connection.query(createLogTableQuery);
                console.log(`[SUCCESS] Tabla charging_log_${serial} verificada/creada.`);
            }
            catch (error) {
                console.error('[ERROR] Error en provisionDevice:', error);
                throw error;
            }
            finally {
                connection.release();
            }
        });
    }
    /**
     * Simula el consumo de energía del cargador.
     * @param serial Número de serie del cargador
     * @param powerInWatts Potencia en vatios
     */
    setPower(serial, powerInWatts) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield this.dbPool.getConnection();
            try {
                const [devices] = yield connection.query('SELECT id FROM devices WHERE serial = ?', [serial]);
                if (devices.length === 0) {
                    throw new Error(`Dispositivo con serial ${serial} no encontrado`);
                }
                const deviceId = devices[0].id;
                yield connection.query('UPDATE details SET power = ?, last_updated = NOW() WHERE device_id = ?', [powerInWatts, deviceId]);
                console.log(`[SUCCESS] Potencia actualizada a ${powerInWatts}W para dispositivo ${serial}`);
                if (powerInWatts > 100) {
                    console.log('[INFO] El syncService ahora debería ver el cargador como "charging"');
                }
                else {
                    console.log('[INFO] El syncService ahora debería ver el cargador como "standby"');
                }
            }
            catch (error) {
                console.error('[ERROR] Error en setPower:', error);
                throw error;
            }
            finally {
                connection.release();
            }
        });
    }
    /**
     * Simula la temperatura del cargador.
     * @param serial Número de serie del cargador
     * @param tempInCelsius Temperatura en grados Celsius
     */
    setTemperature(serial, tempInCelsius) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield this.dbPool.getConnection();
            try {
                const [devices] = yield connection.query('SELECT id FROM devices WHERE serial = ?', [serial]);
                if (devices.length === 0) {
                    throw new Error(`Dispositivo con serial ${serial} no encontrado`);
                }
                const deviceId = devices[0].id;
                yield connection.query('UPDATE details SET temperature = ?, last_updated = NOW() WHERE device_id = ?', [tempInCelsius, deviceId]);
                console.log(`[SUCCESS] Temperatura actualizada a ${tempInCelsius}°C para dispositivo ${serial}`);
                if (tempInCelsius > 60) {
                    console.log('[WARNING] El syncService ahora debería ver el cargador en estado "error" por sobrecalentamiento');
                }
            }
            catch (error) {
                console.error('[ERROR] Error en setTemperature:', error);
                throw error;
            }
            finally {
                connection.release();
            }
        });
    }
    /**
     * Simula los datos finales de una sesión de carga.
     * @param serial Número de serie del cargador
     * @param kwh Energía consumida en kWh
     * @param peakPower Pico de potencia en vatios
     */
    setFinalEnergy(serial, kwh, peakPower) {
        return __awaiter(this, void 0, void 0, function* () {
            const connection = yield this.dbPool.getConnection();
            try {
                const [result] = yield connection.query(`UPDATE \`charging_log_${serial}\` 
         SET energy_kwh = ?, power_peak = ? 
         WHERE end_time IS NULL 
         ORDER BY id DESC LIMIT 1`, [kwh, peakPower]);
                if (result.affectedRows === 0) {
                    console.log('[WARNING] No se encontró una sesión activa para actualizar. ¿Se inició la carga desde la app?');
                }
                else {
                    console.log(`[SUCCESS] Datos finales de carga simulados: ${kwh}kWh, pico de ${peakPower}W`);
                    console.log('[INFO] El backend ahora puede leer estos valores al detener la carga');
                }
            }
            catch (error) {
                console.error('[ERROR] Error en setFinalEnergy:', error);
                throw error;
            }
            finally {
                connection.release();
            }
        });
    }
    /**
     * Cierra las conexiones a la base de datos.
     */
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.dbPool.end();
        });
    }
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const emulator = new ChargerEmulator();
        const program = new commander_1.Command();
        program
            .name('charger-emulator')
            .description('Emulador de cargador de vehículo eléctrico para pruebas de backend')
            .version('1.2.0');
        program.command('provision')
            .description('Aprovisiona un nuevo cargador virtual en devices_db')
            .argument('<serial>', 'Número de serie del cargador (ej. EMT-0001)')
            .action((serial) => __awaiter(this, void 0, void 0, function* () {
            yield emulator.provisionDevice(serial);
            console.log('[DONE] Aprovisionamiento completado.');
        }));
        program.command('set-power')
            .description('Establece la potencia de consumo del cargador')
            .argument('<serial>', 'Número de serie del cargador')
            .argument('<power>', 'Potencia en vatios', parseFloat)
            .action((serial, power) => __awaiter(this, void 0, void 0, function* () {
            yield emulator.setPower(serial, power);
            console.log('[DONE] Potencia actualizada.');
        }));
        program.command('set-temp')
            .description('Establece la temperatura del cargador')
            .argument('<serial>', 'Número de serie del cargador')
            .argument('<temp>', 'Temperatura en grados Celsius', parseFloat)
            .action((serial, temp) => __awaiter(this, void 0, void 0, function* () {
            yield emulator.setTemperature(serial, temp);
            console.log('[DONE] Temperatura actualizada.');
        }));
        program.command('set-final-energy')
            .description('Establece los datos finales de una sesión de carga activa')
            .argument('<serial>', 'Número de serie del cargador')
            .argument('<kwh>', 'Energía consumida en kWh', parseFloat)
            .argument('<peak>', 'Pico de potencia en vatios', parseFloat)
            .action((serial, kwh, peak) => __awaiter(this, void 0, void 0, function* () {
            yield emulator.setFinalEnergy(serial, kwh, peak);
            console.log('[DONE] Datos finales de sesión actualizados.');
        }));
        try {
            yield program.parseAsync(process.argv);
        }
        catch (err) {
            console.error('[FATAL]', err);
        }
        finally {
            yield emulator.close();
            process.exit(0);
        }
    });
}
main();
