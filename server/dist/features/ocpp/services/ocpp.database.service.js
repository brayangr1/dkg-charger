"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCPPDatabaseService = void 0;
const db_config_1 = require("../../../config/db.config");
class OCPPDatabaseService {
    async registerBootNotification(chargePointId, bootNotification) {
        console.log(`[OCPP] Registrando BootNotification en BD - Cargador: ${chargePointId}`);
        console.log(`[OCPP] Datos de BootNotification:`, bootNotification);
        try {
            // Primero intentamos actualizar en la tabla chargers
            try {
                console.log(`[OCPP] Actualizando tabla chargers para ${chargePointId}`);
                await db_config_1.connectionPool.query(`UPDATE chargers SET 
                        network_status = ?, 
                        last_updated = NOW(),
                        firmware_version = ?
                    WHERE serial_number = ?`, ['online', bootNotification.firmwareVersion, chargePointId]);
                console.log(`[OCPP] Actualizado estado del cargador ${chargePointId} en la base de datos`);
            }
            catch (dbError) {
                console.warn(`[OCPP] Error actualizando chargers: ${dbError}. Continuando...`);
            }
            // NOTA: La notificacion de conexion al API se maneja en ocpp.service.ts -> registerCharger
            // No es necesario hacer fetch aqui.
            console.log(`[OCPP] Registro de BootNotification completado para ${chargePointId}`);
            return {
                chargePointId,
                status: 'Connected',
                timestamp: new Date()
            };
        }
        catch (error) {
            console.error(`[OCPP] Error registrando boot notification para ${chargePointId}:`, error);
            // Retornamos un objeto valido en lugar de lanzar error
            return {
                chargePointId,
                status: 'Error',
                timestamp: new Date()
            };
        }
    }
    async updateHeartbeat(chargePointId) {
        try {
            // console.log(`[OCPP] Actualizando heartbeat para ${chargePointId}`);
            await db_config_1.connectionPool.query('UPDATE chargers SET last_updated = NOW() WHERE serial_number = ?', [chargePointId]);
            // console.log(`[OCPP] Heartbeat actualizado para ${chargePointId}`);
        }
        catch (error) {
            console.warn(`[OCPP] Error actualizando heartbeat para ${chargePointId}: ${error}`);
            // No lanzamos el error para evitar desconexiones
        }
    }
}
exports.OCPPDatabaseService = OCPPDatabaseService;
