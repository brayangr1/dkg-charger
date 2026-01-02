"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncService = void 0;
const db_config_1 = require("../config/db.config");
const node_cron_1 = __importDefault(require("node-cron"));
const app_1 = require("../src/app"); // Importar WebSocketServer
class SyncService {
    constructor() {
        this.syncInterval = '*/5 * * * *'; // Cada 5 minutos
        this.priceSyncInterval = '*/1 * * * *'; // Cada día a las 3 AM
        this.lastStatuses = new Map(); // Guardar último estado por chargerId
    }
    static getInstance() {
        if (!SyncService.instance) {
            SyncService.instance = new SyncService();
        }
        return SyncService.instance;
    }
    start() {
        // Sincronización de estado de dispositivos
        node_cron_1.default.schedule(this.syncInterval, async () => {
            console.log('Iniciando sincronización automática de estados...');
            await this.syncAllDevices();
        });
        /*
            // Sincronización de precios
            cron.schedule(this.priceSyncInterval, async () => {
              console.log('Iniciando sincronización automática de precios...');
              await this.syncAllPrices();
            });*/
        // Iniciar monitoreo en tiempo real cada 3 segundos
        setInterval(() => {
            console.log('Iniciando monitoreo en tiempo real de cargas activas...');
            this.monitorActiveCharges();
        }, 3000); // 3000 ms = 3 segundos para monitoreo en tiempo real
        // Monitoreo de cambios en primary_devices
        setInterval(() => {
            console.log('Verificando cambios en primary_devices...');
            this.checkPrimaryDevicesStatusChanges();
        }, 5000); // Cada 5 segundos
        // Monitoreo más frecuente de cambios en devices_db
        setInterval(() => {
            console.log('Verificando cambios en devices_db...');
            this.syncActionTablesToPrimaryDevices();
        }, 1000); // Cada 1 segundo para actualizaciones más rápidas
        console.log('Servicio de sincronización iniciado');
    }
    // Nueva función para sincronizar tablas action_${serial} con primary_devices
    async syncActionTablesToPrimaryDevices() {
        try {
            // Obtener todos los cargadores registrados
            const [chargers] = await db_config_1.connectionPool.query('SELECT id, serial_number FROM chargers');
            // Para cada cargador, sincronizar su tabla action_${serial} con primary_devices
            for (const charger of chargers) {
                const actionTable = `action_${charger.serial_number}`;
                await this.syncActionTable(charger.id, actionTable);
            }
        }
        catch (error) {
            console.error('Error en syncActionTablesToPrimaryDevices:', error);
        }
    }
    // Sincronizar una tabla action_${serial} específica con primary_devices
    async syncActionTable(chargerId, actionTable) {
        try {
            // Verificar si la tabla existe
            const [tableExists] = await db_config_1.deviceDbPool.query(`SHOW TABLES LIKE ?`, [actionTable]);
            if (tableExists.length === 0) {
                console.log(`Tabla ${actionTable} no existe, omitiendo sincronización`);
                return;
            }
            // Verificar la estructura de la tabla
            const [columns] = await db_config_1.deviceDbPool.query(`SHOW COLUMNS FROM \`${actionTable}\``);
            const columnNames = columns.map((col) => col.Field);
            //console.log(`Estructura de ${actionTable}:`, columnNames);
            // Verificar si tiene la columna executed_at que es necesaria
            if (!columnNames.includes('executed_at')) {
                console.log(`Tabla ${actionTable} no tiene la columna executed_at, omitiendo sincronización`);
                return;
            }
            // Obtener el último registro de la tabla action_${serial}
            const [lastAction] = await db_config_1.deviceDbPool.query(`SELECT * FROM \`${actionTable}\` ORDER BY executed_at DESC LIMIT 1`);
            if (lastAction.length === 0) {
                console.log(`Tabla ${actionTable} está vacía, omitiendo sincronización`);
                return;
            }
            const action = lastAction[0];
            // Verificar el último registro en primary_devices
            const [lastPrimary] = await db_config_1.connectionPool.query(`SELECT action_type, id_user, id_device, description, status, executed_at 
         FROM primary_devices 
         WHERE id_device = ? 
         ORDER BY executed_at DESC 
         LIMIT 1`, [chargerId]);
            // Comparar los timestamps para ver si hay nuevos datos
            let shouldNotify = false;
            if (lastPrimary.length === 0) {
                console.log(`No hay registros previos en primary_devices para cargador ${chargerId}`);
                shouldNotify = true;
            }
            else {
                const lastActionTime = new Date(action.executed_at).getTime();
                const lastPrimaryTime = new Date(lastPrimary[0].executed_at).getTime();
                if (lastActionTime > lastPrimaryTime) {
                    console.log(`Hay datos más recientes en ${actionTable} que en primary_devices para cargador ${chargerId}`);
                    shouldNotify = true;
                }
                else if (lastActionTime === lastPrimaryTime && lastPrimary[0].status !== action.status) {
                    console.log(`Mismo timestamp pero diferente estado para cargador ${chargerId}`);
                    shouldNotify = true;
                }
            }
            // Solo notificar si hay cambios reales
            if (shouldNotify) {
                // Convertir el estado numérico a texto
                let statusText = 'standby';
                switch (action.status) {
                    case '0':
                        statusText = 'standby';
                        break;
                    case '1':
                        statusText = 'locked';
                        break;
                    case '2':
                        statusText = 'charging';
                        break;
                    case '3':
                        statusText = 'error';
                        break;
                    case '4':
                        statusText = 'offline';
                        break;
                    default: statusText = 'standby';
                }
                // Notificar a través de WebSocket
                app_1.webSocketServer.notifyStatusChange(chargerId, statusText, 'online');
                console.log(`Notificando cambio de estado para cargador ${chargerId}: ${lastPrimary.length > 0 ? lastPrimary[0].status : 'none'} -> ${action.status}`);
            }
            else {
                console.log(`No hay cambios para notificar para cargador ${chargerId}`);
            }
        }
        catch (error) {
            console.error(`Error sincronizando tabla ${actionTable}:`, error);
        }
    }
    async monitorActiveCharges() {
        try {
            const [chargingChargers] = await db_config_1.connectionPool.query(`SELECT 
          c.id, c.serial_number, cs.user_id, cs.start_time, cu.rate_per_kwh
         FROM chargers c
         JOIN charging_sessions cs ON c.id = cs.charger_id AND cs.end_time IS NULL
         JOIN charger_users cu ON c.id = cu.charger_id AND cs.user_id = cu.user_id
         WHERE c.status = 'charging'`);
            for (const charger of chargingChargers) {
                const [deviceDetails] = await db_config_1.deviceDbPool.query('SELECT power, temperature FROM details WHERE device_id = (SELECT id FROM devices WHERE serial = ?)', [charger.serial_number]);
                if (deviceDetails.length > 0) {
                    const currentPower = deviceDetails[0].power || 0; // en Watts
                    const temperature = deviceDetails[0].temperature || 0;
                    const startTime = new Date(charger.start_time);
                    const now = new Date();
                    const durationSeconds = (now.getTime() - startTime.getTime()) / 1000; //
                    const energyKwh = (currentPower * durationSeconds) / 3600000;
                    const cost = energyKwh * (charger.rate_per_kwh || 0);
                    // Enviar actualización a través de WebSocket
                    app_1.webSocketServer.notifyChargingUpdate(charger.id, {
                        energy: energyKwh,
                        power: currentPower,
                        duration: durationSeconds,
                        cost: cost,
                        ratePerKwh: charger.rate_per_kwh
                    });
                }
            }
        }
        catch (error) {
            console.error('Error en monitorActiveCharges:', error);
        }
    }
    // Nueva función para verificar cambios en primary_devices
    async checkPrimaryDevicesStatusChanges() {
        try {
            // Obtener todos los registros más recientes de primary_devices
            const [latestStatuses] = await db_config_1.connectionPool.query(`SELECT pd.id_device, pd.status, pd.executed_at, c.id as charger_id
         FROM primary_devices pd
         JOIN chargers c ON pd.id_device = c.id
         INNER JOIN (
           SELECT id_device, MAX(executed_at) as max_executed_at
           FROM primary_devices
           GROUP BY id_device
         ) latest ON pd.id_device = latest.id_device AND pd.executed_at = latest.max_executed_at`);
            for (const statusRecord of latestStatuses) {
                const chargerId = statusRecord.charger_id;
                const currentStatus = statusRecord.status;
                const lastStatus = this.lastStatuses.get(chargerId);
                // Si el estado ha cambiado, notificar a través de WebSocket
                if (lastStatus !== currentStatus) {
                    console.log(`Estado cambiado para cargador ${chargerId}: ${lastStatus} -> ${currentStatus}`);
                    // Guardar el nuevo estado
                    this.lastStatuses.set(chargerId, currentStatus);
                    // Convertir el estado numérico a texto
                    let statusText = 'standby';
                    switch (currentStatus) {
                        case '0':
                            statusText = 'standby';
                            break;
                        case '1':
                            statusText = 'locked';
                            break;
                        case '2':
                            statusText = 'charging';
                            break;
                        case '3':
                            statusText = 'error';
                            break;
                        case '4':
                            statusText = 'offline';
                            break;
                        default: statusText = 'standby';
                    }
                    // Notificar a través de WebSocket
                    app_1.webSocketServer.notifyStatusChange(chargerId, statusText, 'online');
                }
                else {
                    console.log(`Sin cambios para cargador ${chargerId}, estado: ${currentStatus}`);
                }
            }
        }
        catch (error) {
            console.error('Error verificando cambios en primary_devices:', error);
        }
    }
    /*
      // Método para sincronizar todos los precios
      public async syncAllPrices() {
        let adminConn;
        try {
          adminConn = await getAdminConnection();
          
          // 1. Obtener todos los precios actualizados
          const [updatedPrices] = await adminConn.query<RowDataPacket[]>(
            'SELECT serial_number, base_price_per_kwh FROM pricing_devices'
          );
    
          // 2. Actualizar en la base charger
          for (const price of updatedPrices) {
            await this.updateChargerPrice(price.serial_number, price.base_price_per_kwh);
          }
    
          console.log(`Sincronizados ${updatedPrices.length} precios`);
        } catch (error) {
          console.error('Error en sincronización de precios:', error);
        } finally {
          if (adminConn) adminConn.release();
        }
      }
    
      // Método para actualizar precio de un cargador específico
      private async updateChargerPrice(serial: string, newPrice: number) {
        try {
            const [result] = await connectionPool.query(
                `UPDATE charger_users cu
                 JOIN chargers c ON cu.charger_id = c.id
                 SET cu.rate_per_kwh = ?
                 WHERE c.serial_number = ?
                 AND cu.access_level = 'owner'`,  // Solo actualiza owners
                [newPrice, serial]
            );
    
            if ((result as any).affectedRows > 0) {
                console.log(`Precio actualizado para owner de ${serial}: ${newPrice}`);
            }
        } catch (error) {
            console.error(`Error actualizando precio para ${serial}:`, error);
            throw error;
        }
    }*/
    // Tus métodos existentes (syncAllDevices, syncDevice, determineStatus) permanecen igual
    async syncAllDevices() {
        try {
            // Obtener todos los dispositivos
            const [devices] = await db_config_1.deviceDbPool.query('SELECT serial FROM devices');
            // Sincronizar cada dispositivo
            for (const device of devices) {
                await this.syncDevice(device.serial);
            }
        }
        catch (error) {
            console.error('Error en syncAllDevices:', error);
        }
    }
    async syncDevice(serial) {
        try {
            const [deviceData] = await db_config_1.deviceDbPool.query(`SELECT * FROM details WHERE device_id = (SELECT id FROM devices WHERE serial = ?)`, [serial]);
            if (deviceData.length === 0)
                return;
            const data = deviceData[0];
            // Detectar alerta de sobrecalentamiento
            if (data.temperature > 60) {
                const [chargerRow] = await db_config_1.connectionPool.query('SELECT id FROM chargers WHERE serial_number = ?', [serial]);
                if (chargerRow.length > 0) {
                    const chargerId = chargerRow[0].id;
                    app_1.webSocketServer.notifyAlert(chargerId, {
                        alertType: 'overheat',
                        message: '¡Sobrecalentamiento detectado!',
                        value: data.temperature
                    });
                    await db_config_1.connectionPool.query('INSERT INTO logs (charger_id, action, description, executed_at) VALUES (?, ?, ?, NOW())', [chargerId, 'alert', `Sobrecalentamiento detectado: ${data.temperature}°C (syncDevice)`]);
                }
            }
            // Determinar estado basado en datos del dispositivo
            const newStatus = this.determineStatus(data);
            // Actualizar estado en la base de datos principal
            await db_config_1.connectionPool.query(`UPDATE chargers 
         SET status = ?, 
             network_status = 'online',
             last_updated = NOW()
         WHERE serial_number = ?`, [newStatus, serial]);
            // También actualizar en primary_devices para mantener consistencia
            const [chargerRows] = await db_config_1.connectionPool.query('SELECT id FROM chargers WHERE serial_number = ?', [serial]);
            if (chargerRows.length > 0) {
                const chargerId = chargerRows[0].id;
                // Convertir estado a número para primary_devices (0, 1, 2, 3)
                let statusNumber;
                switch (newStatus) {
                    case 'standby':
                        statusNumber = '0';
                        break;
                    case 'locked':
                        statusNumber = '1';
                        break;
                    case 'charging':
                        statusNumber = '2';
                        break;
                    case 'error':
                        statusNumber = '3';
                        break;
                    case 'offline':
                        statusNumber = '4';
                        break;
                    default: statusNumber = '0';
                }
                // Verificar si ya existe un registro reciente con el mismo estado
                const [existingRow] = await db_config_1.connectionPool.query(`SELECT id FROM primary_devices 
           WHERE id_device = ? AND status = ? 
           AND executed_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
           ORDER BY executed_at DESC LIMIT 1`, [chargerId, statusNumber]);
                // Solo insertar si no existe un registro reciente con el mismo estado
                if (existingRow.length === 0) {
                    await db_config_1.connectionPool.query(`INSERT INTO primary_devices (action_type, id_user, id_device, description, status, executed_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`, ['status_update', 0, chargerId, `Estado actualizado a ${newStatus}`, statusNumber]);
                }
            }
            console.log(`Dispositivo ${serial} sincronizado`);
        }
        catch (error) {
            console.error(`Error sincronizando dispositivo ${serial}:`, error);
            await db_config_1.connectionPool.query(`UPDATE chargers SET network_status = 'offline' WHERE serial_number = ?`, [serial]);
        }
    }
    determineStatus(data) {
        if (data.power > 100)
            return 'charging';
        if (data.temperature > 60)
            return 'error';
        return 'standby';
    }
}
// Exportar instancia única
exports.syncService = SyncService.getInstance();
