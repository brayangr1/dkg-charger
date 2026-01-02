// server/features/ocpp/index.ts - REEMPLAZA TODO CON:
import { OCPPServer } from './services/ocpp.server';

// Solo iniciar servidor OCPP si no estamos en producción (donde ya corre via PM2)
// Iniciar servidor OCPP siempre (Unificación de procesos para compartir estado Singleton)
try {
    const ocppServer = new OCPPServer(8887);
    console.log('✅ Servidor OCPP iniciado en puerto 8887 (Integrado en API)');
} catch (error) {
    console.error('❌ Error iniciando servidor OCPP:', error);
}
