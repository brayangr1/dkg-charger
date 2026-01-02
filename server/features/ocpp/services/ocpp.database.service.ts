import { connectionPool } from '../../../config/db.config';
import { BootNotificationRequest } from '../types/ocpp.types';

export class OCPPDatabaseService {
    async registerBootNotification(chargePointId: string, bootNotification: BootNotificationRequest, chargerIP?: string) {
        console.log(`[OCPP] Registrando BootNotification en BD - Cargador: ${chargePointId}`);
        console.log(`[OCPP] Datos de BootNotification:`, bootNotification);

        try {
            // Primero intentamos actualizar en la tabla chargers
            try {
                console.log(`[OCPP] Actualizando tabla chargers para ${chargePointId}`);
                await connectionPool.query(
                    `UPDATE chargers SET 
                        network_status = ?, 
                        last_updated = NOW(),
                        firmware_version = ?,
                        charger_vendor = ?,
                        model = ?,
                        charger_box_serial_number = ?,
                        iccid = ?,
                        imsi = ?,
                        meter_type = ?,
                        meter_serial_number = ?,
                        charger_ip = ?
                    WHERE serial_number = ?`,
                    [
                        'online',
                        bootNotification.firmwareVersion || null,
                        bootNotification.chargePointVendor || null,
                        bootNotification.chargePointModel || null,
                        bootNotification.chargeBoxSerialNumber || bootNotification.chargePointSerialNumber || null,
                        bootNotification.iccid || null,
                        bootNotification.imsi || null,
                        bootNotification.meterType || null,
                        bootNotification.meterSerialNumber || null,
                        chargerIP || null,
                        chargePointId
                    ]
                );
                console.log(`[OCPP] Actualizado estado del cargador ${chargePointId} en la base de datos`);
            } catch (dbError) {
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
        } catch (error) {
            console.error(`[OCPP] Error registrando boot notification para ${chargePointId}:`, error);
            // Retornamos un objeto valido en lugar de lanzar error
            return {
                chargePointId,
                status: 'Error',
                timestamp: new Date()
            };
        }
    }

    async updateHeartbeat(chargePointId: string) {
        try {
            // console.log(`[OCPP] Actualizando heartbeat para ${chargePointId}`);
            await connectionPool.query(
                'UPDATE chargers SET last_updated = NOW() WHERE serial_number = ?',
                [chargePointId]
            );
            // console.log(`[OCPP] Heartbeat actualizado para ${chargePointId}`);
        } catch (error) {
            console.warn(`[OCPP] Error actualizando heartbeat para ${chargePointId}: ${error}`);
            // No lanzamos el error para evitar desconexiones
        }
    }
}