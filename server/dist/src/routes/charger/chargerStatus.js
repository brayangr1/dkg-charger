"use strict";
/**
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { ChargerService } from '../../services/charger';
import { WebSocketService } from '../../services/websocket';
import { logger } from '../../utils/logger';

const router = Router();
const chargerService = new ChargerService();
const wsService = WebSocketService.getInstance();


router.get('/:chargerId/ping', authenticate, async (req, res) => {
    try {
        const { chargerId } = req.params;

        // Verificar si el cargador está conectado al WebSocket
        const isConnected = wsService.isChargerConnected(chargerId);
        
        // Obtener el último estado conocido del cargador
        const chargerState = await chargerService.getChargerState(chargerId);
        
        // Intentar hacer ping al cargador a través de WebSocket
        let pingResult;
        try {
            pingResult = await wsService.pingCharger(chargerId);
        } catch (error) {
            logger.warn(`Ping failed for charger ${chargerId}:`, error);
            pingResult = { success: false };
        }

        const response = {
            isAlive: isConnected && pingResult.success,
            powerState: chargerState?.powerState || 'off',
            networkStatus: isConnected ? 'online' : 'offline',
            lastSeen: chargerState?.lastSeen || null
        };

        // Actualizar el estado del cargador en la base de datos
        await chargerService.updateChargerStatus(chargerId, {
            isConnected,
            powerState: response.powerState,
            lastPing: new Date(),
            lastStatus: response
        });

        res.json(response);
    } catch (error) {
        logger.error('Error en ping de cargador:', error);
        res.status(500).json({
            error: 'Error al verificar el estado del cargador',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});*/
/**
 * @api {get} /api/chargers/:chargerId/ping Get charger status
 * @apiName PingCharger
 * @apiGroup Charger
 * @apiDescription Verifica el estado del cargador y su conexión
 *
 * @apiParam {String} chargerId ID del cargador
 *
 * @apiSuccess {Boolean} isAlive Si el cargador está respondiendo
 * @apiSuccess {String} powerState Estado de energía del cargador ('on'|'off')
 * @apiSuccess {String} networkStatus Estado de la conexión ('online'|'offline')
 * @apiSuccess {Date} lastSeen Última vez que se vio el cargador activo
 */ 
