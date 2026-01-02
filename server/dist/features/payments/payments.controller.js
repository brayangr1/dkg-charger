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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentDetails = exports.captureCharge = exports.preAuthorizeCharge = exports.sendReceiptEmail = exports.generateInvoiceFromOffline = exports.stripeWebhook = exports.processRefund = exports.getPaymentStats = exports.getPaymentHistory = exports.processSessionPayment = exports.processPendingPayment = exports.processOfflineInvoice = exports.getTransactions = exports.deletePaymentMethod = exports.setDefaultMethod = exports.getPaymentMethods = exports.addPaymentMethod = void 0;
const paymentService = __importStar(require("./payments.service"));
const chargingPaymentService_1 = require("../../services/chargingPaymentService");
"";
const db_config_1 = require("../../config/db.config");
const emailService_1 = require("../../services/emailService");
const addPaymentMethod = async (req, res) => {
    try {
        const method = await paymentService.addPaymentMethod(req.user.id, req.body);
        res.json({ success: true, method });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.addPaymentMethod = addPaymentMethod;
const getPaymentMethods = async (req, res) => {
    try {
        const methods = await paymentService.getPaymentMethods(req.user.id);
        res.json({ success: true, methods });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.getPaymentMethods = getPaymentMethods;
const setDefaultMethod = async (req, res) => {
    try {
        await paymentService.setDefaultPaymentMethod(req.user.id, req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.setDefaultMethod = setDefaultMethod;
const deletePaymentMethod = async (req, res) => {
    try {
        await paymentService.deletePaymentMethod(req.user.id, req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.deletePaymentMethod = deletePaymentMethod;
const getTransactions = async (req, res) => {
    try {
        const transactions = await paymentService.getTransactions(req.user.id);
        res.json({ success: true, transactions });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.getTransactions = getTransactions;
// ===== NUEVOS CONTROLADORES PARA PAGOS REALES =====
/**
 * Procesa una factura offline sincronizada desde la app móvil
 */
const processOfflineInvoice = async (req, res) => {
    try {
        const { sessionId, chargerId, userId, amount, energy, duration, ratePerKwh, description, paymentMethodId, offlineInvoiceId } = req.body;
        if (!sessionId || !chargerId || !userId || !amount) {
            return res.status(400).json({
                success: false,
                error: 'sessionId, chargerId, userId y amount son requeridos'
            });
        }
        console.log(`📄 Procesando factura offline: ${offlineInvoiceId}`);
        console.log(`💰 Monto: ${amount}€, Energía: ${energy}kWh`);
        // Verificar si ya existe un pago para esta sesión offline
        const [existingPayments] = await db_config_1.connectionPool.query('SELECT * FROM payments WHERE session_id = ? AND user_id = ?', [sessionId, userId]);
        if (existingPayments && existingPayments.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Ya existe un pago para esta sesión'
            });
        }
        // Obtener información del cargador
        const [chargers] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE id = ?', [chargerId]);
        if (!chargers || chargers.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const charger = chargers[0];
        // Determinar sessionDbId (id numérico en charging_sessions). Si el sessionId entrante no es numérico,
        // creamos una sesión en la BD y usamos su insertId. Esto evita violaciones de FK cuando la app manda IDs 'offline_...'
        let sessionDbId = null;
        const incomingSessionStr = sessionId ? sessionId.toString() : '';
        const isNumericSession = /^[0-9]+$/.test(incomingSessionStr);
        if (isNumericSession) {
            sessionDbId = Number(incomingSessionStr);
            const [existingSessions] = await db_config_1.connectionPool.query('SELECT id FROM charging_sessions WHERE id = ?', [sessionDbId]);
            if (!existingSessions || existingSessions.length === 0) {
                const [res] = await db_config_1.connectionPool.query(`INSERT INTO charging_sessions 
           (charger_id, user_id, start_time, end_time, total_energy, duration_seconds, estimated_cost, charging_mode) 
           VALUES (?, ?, NOW() - INTERVAL ? MINUTE, NOW(), ?, ?, ?, 'offline')`, [chargerId, userId, duration || 1, energy || 0, duration * 60, amount]);
                sessionDbId = res.insertId || sessionDbId;
                console.log(`✅ Sesión de carga creada en DB con id: ${sessionDbId}`);
            }
            else {
                console.log(`ℹ️ Sesión existente encontrada en DB: ${sessionDbId}`);
            }
        }
        else {
            const [res] = await db_config_1.connectionPool.query(`INSERT INTO charging_sessions 
         (charger_id, user_id, start_time, end_time, total_energy, duration_seconds, estimated_cost, charging_mode) 
         VALUES (?, ?, NOW() - INTERVAL ? MINUTE, NOW(), ?, ?, ?, 'offline')`, [chargerId, userId, duration || 1, energy || 0, duration * 60, amount]);
            sessionDbId = res.insertId;
            console.log(`✅ Sesión de carga creada en DB: ${sessionDbId} (mapeada desde ${incomingSessionStr})`);
        }
        // Crear el registro de pago con ID único
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substr(2, 9);
        const sessionPart = incomingSessionStr.slice(-4);
        const transactionId = `txn_offline_${timestamp}_${sessionPart}_${randomPart}`;
        const invoiceNumber = `INV-${timestamp}-${sessionPart}-${randomPart}`;
        if (!sessionDbId) {
            console.error('[processOfflineInvoice] No sessionDbId available, aborting payment insert');
            return res.status(500).json({ success: false, error: 'No session id available after creating charging session' });
        }
        // Asegurar payment_method fallback
        const methodIdToUse = paymentMethodId || `offline_method_${userId}`;
        try {
            const [pmRows] = await db_config_1.connectionPool.query('SELECT id FROM payment_methods WHERE id = ?', [methodIdToUse]);
            if (!pmRows || pmRows.length === 0) {
                console.log(`[processOfflineInvoice] Creando payment_method fallback: ${methodIdToUse} para user ${userId}`);
                await db_config_1.connectionPool.query(`INSERT INTO payment_methods (id, user_id, type, card_brand, last4, is_default, created_at) VALUES (?, ?, 'card', 'offline', '0000', 0, NOW())`, [methodIdToUse, userId]);
            }
        }
        catch (pmErr) {
            console.warn('[processOfflineInvoice] Error asegurando payment_method fallback:', pmErr);
        }
        const [paymentResult] = await db_config_1.connectionPool.query(`INSERT INTO payments 
       (user_id, charger_id, session_id, amount, currency, status, payment_method_id, transaction_id, invoice_number, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 'EUR', 'completed', ?, ?, ?, NOW(), NOW())`, [userId, chargerId, sessionDbId, amount, methodIdToUse, transactionId, invoiceNumber]);
        console.log(`✅ Factura offline procesada exitosamente: ${offlineInvoiceId}`);
        console.log(`💳 Pago creado con ID: ${paymentResult.insertId}`);
        res.json({
            success: true,
            paymentId: paymentResult.insertId,
            transactionId,
            invoiceNumber,
            paymentMethodId: paymentMethodId || 'offline_method',
            message: 'Factura offline procesada exitosamente'
        });
    }
    catch (error) {
        console.error('❌ Error procesando factura offline:', error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.processOfflineInvoice = processOfflineInvoice;
/**
 * Procesa un pago pendiente enviado por la app (endpoint para facturas offline)
 * Este endpoint crea el registro en la tabla `payments` usando la lógica del proceso offline
 * Nota: temporalmente sin autenticación para pruebas desde cliente móvil. Validar antes de producción.
 */
const processPendingPayment = async (req, res) => {
    try {
        const { sessionId, chargerId, amount, energy, duration, ratePerKwh, description, paymentMethodId, offlineInvoiceId } = req.body;
        const userIdToUse = req.user.id; // Usar siempre el usuario autenticado
        console.log('[processPendingPayment] Incoming payload:', { sessionId, chargerId, userId: userIdToUse, amount, energy, duration, paymentMethodId, offlineInvoiceId });
        // Verificar si ya existe un pago para esta sesión y usuario (usando userIdToUse)
        const [existingPayments] = await db_config_1.connectionPool.query('SELECT id FROM payments WHERE session_id = ? AND user_id = ?', [sessionId, userIdToUse]);
        if (existingPayments && existingPayments.length > 0) {
            return res.status(409).json({ success: false, error: 'Ya existe un pago para esta sesión' });
        }
        // Determinar sessionDbId (id en la tabla charging_sessions) —
        // si el sessionId entrante es numérico lo usamos; si no, creamos una sesión y usamos el insertId
        let sessionDbId = null;
        const incomingSessionStr = sessionId ? sessionId.toString() : '';
        const isNumericSession = /^[0-9]+$/.test(incomingSessionStr);
        if (isNumericSession) {
            sessionDbId = Number(incomingSessionStr);
            // Verificar que exista
            const [existingSessions] = await db_config_1.connectionPool.query('SELECT id FROM charging_sessions WHERE id = ?', [sessionDbId]);
            if (!existingSessions || existingSessions.length === 0) {
                // Crear sesión con ese id numérico (rare case) — pero normalmente permitimos auto-increment
                await db_config_1.connectionPool.query(`INSERT INTO charging_sessions 
           (charger_id, user_id, start_time, end_time, total_energy, duration_seconds, estimated_cost, charging_mode) 
           VALUES (?, ?, NOW() - INTERVAL ? MINUTE, NOW(), ?, ?, ?, 'offline')`, [chargerId, userIdToUse, duration || 1, energy || 0, (duration || 1) * 60, amount]);
                const [rows] = await db_config_1.connectionPool.query('SELECT LAST_INSERT_ID() as id');
                sessionDbId = rows[0]?.id || sessionDbId;
                console.log(`✅ Sesión de carga creada (pending flow) con nuevo id: ${sessionDbId}`);
            }
            else {
                console.log(`ℹ️ Sesión existente encontrada en DB: ${sessionDbId}`);
            }
        }
        else {
            // sessionId no es numérico (ej: offline_session_...), crear una nueva sesión en DB y usar su id
            const [result] = await db_config_1.connectionPool.query(`INSERT INTO charging_sessions 
         (charger_id, user_id, start_time, end_time, total_energy, duration_seconds, estimated_cost, charging_mode) 
         VALUES (?, ?, NOW() - INTERVAL ? MINUTE, NOW(), ?, ?, ?, 'offline')`, [chargerId, userIdToUse, duration || 1, energy || 0, (duration || 1) * 60, amount]);
            sessionDbId = result.insertId;
            console.log(`✅ Sesión de carga creada (pending flow): ${sessionDbId} (mapped from ${incomingSessionStr})`);
        }
        // Crear el registro de pago con ID y número de factura únicos
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substr(2, 9);
        const sessionPart = sessionId.toString().slice(-4);
        const transactionId = `txn_pending_${timestamp}_${sessionPart}_${randomPart}`;
        const invoiceNumber = `INV-${randomPart}`; //`INV-PND-${timestamp}-${sessionPart}-${randomPart}`;
        // Normalizar amount a número y guardar con 2 decimales (euros) para cumplir decimal(10,2)
        const parsedAmountRaw = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
        const parsedAmount = isNaN(parsedAmountRaw) ? 0 : Math.round((parsedAmountRaw + Number.EPSILON) * 100) / 100;
        console.log(`[processPendingPayment] amount raw: ${amount} -> parsedAmountRaw: ${parsedAmountRaw} -> parsedAmount(2dec): ${parsedAmount}`);
        // Asegurar que exista un payment_method válido para evitar violación FK
        const methodIdToUse = paymentMethodId || `offline_method_${userIdToUse}`;
        try {
            const [pmRows] = await db_config_1.connectionPool.query('SELECT id FROM payment_methods WHERE id = ?', [methodIdToUse]);
            if (!pmRows || pmRows.length === 0) {
                console.log(`[processPendingPayment] Creando payment_method fallback: ${methodIdToUse} para user ${userIdToUse}`);
                await db_config_1.connectionPool.query(`INSERT INTO payment_methods (id, user_id, type, card_brand, last4, is_default, created_at) VALUES (?, ?, 'card', 'offline', '0000', 0, NOW())`, [methodIdToUse, userIdToUse]);
            }
        }
        catch (pmErr) {
            console.warn('[processPendingPayment] Error asegurando payment_method fallback:', pmErr);
        }
        const [paymentResult] = await db_config_1.connectionPool.query(`INSERT INTO payments 
       (user_id, charger_id, session_id, amount, currency, status, payment_method_id, transaction_id, invoice_number, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 'EUR', 'completed', ?, ?, ?, NOW(), NOW())`, [userIdToUse, chargerId, sessionDbId, parsedAmount, methodIdToUse, transactionId, invoiceNumber]);
        console.log(`✅ Pago pendiente procesado, resultado raw:`, paymentResult);
        // Obtener el registro insertado para verificar valores guardados
        const insertId = paymentResult.insertId;
        let savedPayment = null;
        try {
            const [rows] = await db_config_1.connectionPool.query('SELECT * FROM payments WHERE id = ?', [insertId]);
            if (rows && rows.length > 0)
                savedPayment = rows[0];
        }
        catch (selectErr) {
            console.error('[processPendingPayment] Error obteniendo pago insertado:', selectErr);
        }
        if (savedPayment) {
            console.log('[processPendingPayment] Saved payment from DB:', {
                id: savedPayment.id,
                amount: savedPayment.amount,
                currency: savedPayment.currency,
                session_id: savedPayment.session_id,
                payment_method_id: savedPayment.payment_method_id
            });
            // Intentar adjuntar datos de facturación (billing_details) al savedPayment
            try {
                const [billingRows] = await db_config_1.connectionPool.query(`SELECT * FROM billing_details WHERE user_id = ? AND is_default = 1 LIMIT 1`, [savedPayment.user_id]);
                if (billingRows && billingRows.length > 0) {
                    savedPayment.billing = billingRows[0];
                    console.log('[processPendingPayment] Attached billing to savedPayment:', { paymentId: savedPayment.id, billing: savedPayment.billing });
                }
                else {
                    const [anyBilling] = await db_config_1.connectionPool.query(`SELECT * FROM billing_details WHERE user_id = ? LIMIT 1`, [savedPayment.user_id]);
                    if (anyBilling && anyBilling.length > 0)
                        savedPayment.billing = anyBilling[0];
                    if (anyBilling && anyBilling.length > 0)
                        console.log('[processPendingPayment] Attached non-default billing to savedPayment:', { paymentId: savedPayment.id, billing: anyBilling[0] });
                }
            }
            catch (bdErr) {
                console.warn('[processPendingPayment] Error obteniendo billing_details para savedPayment:', bdErr);
            }
        }
        // Enviar el recibo por correo en segundo plano (no bloquea la respuesta)
        if (insertId) {
            sendReceiptForPayment(insertId).catch(emailError => {
                console.error(`[processPendingPayment] Falló el envío de correo en segundo plano para el pago ${insertId}:`, emailError);
            });
        }
        return res.json({
            success: true,
            paymentId: insertId,
            transactionId,
            invoiceNumber,
            savedPayment,
            message: 'Pago pendiente procesado y guardado en DB'
        });
    }
    catch (error) {
        console.error('[processPendingPayment] Error:', error instanceof Error ? error.stack || error.message : error);
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.processPendingPayment = processPendingPayment;
/**
 * Procesa un pago real al finalizar una sesión de carga
 */
const processSessionPayment = async (req, res) => {
    try {
        const { sessionId, amount, currency = 'EUR' } = req.body;
        if (!sessionId || !amount) {
            return res.status(400).json({
                success: false,
                error: 'sessionId y amount son requeridos'
            });
        }
        const userId = req.user.id;
        // Obtener información de la sesión usando la base de datos directamente
        const [sessions] = await db_config_1.connectionPool.query('SELECT * FROM charging_sessions WHERE id = ? AND user_id = ?', [sessionId, userId]);
        if (!sessions || sessions.length === 0) {
            console.log(`⚠️ Sesión no encontrada: ${sessionId} para usuario: ${userId}`);
            return res.status(404).json({
                success: false,
                error: 'Sesión no encontrada. Asegúrate de generar la factura primero.'
            });
        }
        const session = sessions[0];
        console.log(`✅ Sesión encontrada: ${sessionId}, Cargador: ${session.charger_id}, Costo estimado: ${session.estimated_cost}`);
        // Verificar que los datos de la sesión sean válidos
        if (!session.charger_id) {
            return res.status(400).json({
                success: false,
                error: 'Sesión inválida: falta información del cargador'
            });
        }
        const amountInCents = Math.round(amount * 100); // Convertir a centavos
        const paymentData = {
            userId: userId,
            chargerId: session.charger_id,
            sessionId: sessionId,
            amount: amountInCents,
            currency: currency,
            description: `Carga eléctrica - Sesión #${sessionId}`,
        };
        console.log(`💳 Procesando pago:`, paymentData);
        const result = await paymentService.processPayment(paymentData);
        console.log(`💳 Resultado del pago:`, result);
        if (result.success) {
            console.log(`✅ Pago exitoso - ID: ${result.paymentId}, Transaction: ${result.transactionId}`);
            res.json({
                success: true,
                paymentId: result.paymentId,
                transactionId: result.transactionId,
                invoiceNumber: result.invoiceNumber,
                status: result.status,
            });
        }
        else {
            console.error(`❌ Error en pago:`, result.error);
            res.status(400).json({
                success: false,
                error: result.error,
                status: result.status,
            });
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.processSessionPayment = processSessionPayment;
/**
 * Obtiene historial completo de pagos
 */
const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        // Obtener pagos filtrados por usuario usando el servicio
        const rows = await paymentService.getPaymentHistory(userId);
        // Adjuntar billing_details a cada payment (si existe)
        try {
            const payments = rows;
            await Promise.all(payments.map(async (p) => {
                try {
                    const [billingRows] = await db_config_1.connectionPool.query(`SELECT * FROM billing_details WHERE user_id = ? AND is_default = 1 LIMIT 1`, [p.user_id]);
                    if (billingRows && billingRows.length > 0) {
                        p.billing = billingRows[0];
                        console.log('[getPaymentHistory] Attached default billing for payment:', { paymentId: p.id, billing: p.billing });
                    }
                    else {
                        const [anyBilling] = await db_config_1.connectionPool.query(`SELECT * FROM billing_details WHERE user_id = ? LIMIT 1`, [p.user_id]);
                        if (anyBilling && anyBilling.length > 0)
                            p.billing = anyBilling[0];
                        if (anyBilling && anyBilling.length > 0)
                            console.log('[getPaymentHistory] Attached non-default billing for payment:', { paymentId: p.id, billing: p.billing });
                        if ((!billingRows || billingRows.length === 0) && (!anyBilling || anyBilling.length === 0))
                            console.log('[getPaymentHistory] No billing found for payment:', { paymentId: p.id, userId: p.user_id });
                    }
                }
                catch (innerErr) {
                    // no-op: si falla, no bloquear la lista completa
                    console.warn('[getPaymentHistory] Error obteniendo billing for payment', p.id, innerErr);
                }
            }));
            res.json({ success: true, history: payments });
        }
        catch (attachErr) {
            console.warn('[getPaymentHistory] Error adjuntando billing_details:', attachErr);
            res.json({ success: true, history: rows });
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.getPaymentHistory = getPaymentHistory;
/**
 * Obtiene estadísticas de pagos
 */
const getPaymentStats = async (req, res) => {
    try {
        const stats = await paymentService.getPaymentStats(req.user.id);
        res.json({ success: true, stats });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.getPaymentStats = getPaymentStats;
/**
 * Procesa reembolso
 */
const processRefund = async (req, res) => {
    try {
        const { paymentId, amount } = req.body;
        if (!paymentId) {
            return res.status(400).json({
                success: false,
                error: 'paymentId es requerido'
            });
        }
        const success = await paymentService.refundPayment(paymentId, amount);
        if (success) {
            res.json({ success: true, message: 'Reembolso procesado correctamente' });
        }
        else {
            res.status(400).json({ success: false, error: 'Error procesando reembolso' });
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ success: false, error: message });
    }
};
exports.processRefund = processRefund;
/**
 * Webhook para confirmar pagos de Stripe
 */
const stripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
        return res.status(500).json({ error: 'Webhook secret no configurado' });
    }
    let event;
    try {
        event = require('stripe').webhooks.constructEvent(req.body, sig, endpointSecret);
    }
    catch (err) {
        console.error('Error verificando webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    // Manejar eventos
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            await paymentService.confirmPayment(paymentIntent.id);
            break;
        case 'payment_intent.payment_failed':
            console.log('Pago falló:', event.data.object.id);
            break;
        default:
            console.log(`Evento no manejado: ${event.type}`);
    }
};
exports.stripeWebhook = stripeWebhook;
/**
 * Genera una factura real combinando datos offline con datos actuales de la base de datos
 */
const generateInvoiceFromOffline = async (req, res) => {
    try {
        const { sessionId, chargerId, startTime, endTime, duration, energy } = req.body;
        if (!sessionId || !chargerId || !startTime || !endTime || !duration) {
            return res.status(400).json({
                success: false,
                error: 'Faltan datos requeridos: sessionId, chargerId, startTime, endTime, duration'
            });
        }
        const userId = req.user.id;
        // Obtener información actual del cargador desde la base de datos
        const [chargers] = await db_config_1.connectionPool.query('SELECT * FROM chargers WHERE id = ?', [chargerId]);
        if (!chargers || chargers.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cargador no encontrado'
            });
        }
        const charger = chargers[0];
        // Obtener tarifa específica del usuario para este cargador desde charger_users
        const [chargerUsers] = await db_config_1.connectionPool.query('SELECT rate_per_kwh FROM charger_users WHERE user_id = ? AND charger_id = ?', [userId, chargerId]);
        let ratePerKwh = 1.00; // Tarifa por defecto como fallback
        if (chargerUsers && chargerUsers.length > 0 && chargerUsers[0].rate_per_kwh) {
            ratePerKwh = parseFloat(chargerUsers[0].rate_per_kwh);
            console.log(`✅ Tarifa obtenida de charger_users: ${ratePerKwh}€/kWh`);
        }
        else {
            console.log(`⚠️ No se encontró tarifa en charger_users para usuario ${userId} y cargador ${chargerId}, usando tarifa por defecto: ${ratePerKwh}€/kWh`);
        }
        const maxPower = charger.max_power || 7.4; // Potencia máxima en kW
        // Calcular el costo usando la energía offline y la tarifa actual
        const actualEnergy = energy || (duration / 60 * maxPower * 0.8); // Estimar energía más realista
        const totalCost = actualEnergy * ratePerKwh;
        console.log(`📊 Cálculos de factura:`);
        console.log(`   - Energía recibida: ${energy} kWh`);
        console.log(`   - Duración: ${duration} minutos`);
        console.log(`   - Potencia máxima: ${maxPower} kW`);
        console.log(`   - Energía calculada: ${actualEnergy} kWh`);
        console.log(`   - Tarifa por kWh: ${ratePerKwh}€`);
        console.log(`   - Costo total: ${totalCost}€`);
        // Crear la sesión de carga en la base de datos
        await db_config_1.connectionPool.query(`INSERT INTO charging_sessions 
       (id, charger_id, user_id, start_time, end_time, total_energy, duration_seconds, estimated_cost, charging_mode) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline-to-online')
       ON DUPLICATE KEY UPDATE
       end_time = VALUES(end_time),
       total_energy = VALUES(total_energy),
       duration_seconds = VALUES(duration_seconds),
       estimated_cost = VALUES(estimated_cost)`, [
            sessionId,
            chargerId,
            userId,
            new Date(startTime),
            new Date(endTime),
            actualEnergy,
            duration * 60,
            totalCost
        ]);
        // Generar número de factura
        const invoiceNumber = `INV-${sessionId}-${Date.now()}`;
        // Preparar datos de la factura con valores corregidos
        const invoiceData = {
            sessionId,
            chargerId,
            chargerName: charger.name || `Cargador ${chargerId}`,
            userId,
            startTime,
            endTime,
            duration,
            energy: Math.round(actualEnergy * 100) / 100, // Energía calculada correctamente
            ratePerKwh: Math.round(ratePerKwh * 100) / 100, // Tarifa por kWh
            maxPower: Math.round(maxPower * 10) / 10, // Potencia máxima en kW
            totalCost: Math.round(totalCost * 100) / 100, // Redondear a 2 decimales
            invoiceNumber,
            currency: 'EUR',
            status: 'pending'
        };
        // Intentar adjuntar datos de facturación (billing_details) al invoiceData
        try {
            const [billingRows] = await db_config_1.connectionPool.query(`SELECT * FROM billing_details WHERE user_id = ? AND is_default = 1 LIMIT 1`, [userId]);
            if (billingRows && billingRows.length > 0) {
                invoiceData.billing = billingRows[0];
            }
            else {
                const [anyBilling] = await db_config_1.connectionPool.query(`SELECT * FROM billing_details WHERE user_id = ? LIMIT 1`, [userId]);
                if (anyBilling && anyBilling.length > 0)
                    invoiceData.billing = anyBilling[0];
            }
        }
        catch (bdErr) {
            console.warn('[generateInvoiceFromOffline] Error obteniendo billing_details:', bdErr);
        }
        console.log(`✅ Factura generada desde datos offline: ${invoiceNumber}`);
        console.log(`💰 Costo total: ${invoiceData.totalCost}€`);
        res.json({
            success: true,
            invoice: invoiceData
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        console.error('❌ Error generando factura desde datos offline:', message);
        res.status(500).json({
            success: false,
            error: message
        });
    }
};
exports.generateInvoiceFromOffline = generateInvoiceFromOffline;
/**
 * Función auxiliar para enviar un recibo de pago por correo electrónico.
 * @param paymentId - El ID del pago.
 * @param userId - (Opcional) El ID del usuario para verificación de propiedad.
 */
async function sendReceiptForPayment(paymentId, userId) {
    try {
        console.log(`[sendReceiptForPayment] Preparando recibo para pago ID: ${paymentId}`);
        let query = `
      SELECT 
        p.*,
        c.name as charger_name,
        cs.start_time,
        cs.end_time,
        cs.total_energy,
        pm.card_brand,
        pm.last4,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM payments p
      LEFT JOIN chargers c ON p.charger_id = c.id
      LEFT JOIN charging_sessions cs ON p.session_id = cs.id
      LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `;
        const params = [paymentId];
        if (userId) {
            query += ` AND p.user_id = ?`;
            params.push(userId);
        }
        const [payments] = await db_config_1.connectionPool.query(query, params);
        if (payments.length === 0) {
            console.warn(`[sendReceiptForPayment] Pago ${paymentId} no encontrado o sin permisos.`);
            return false;
        }
        const payment = payments[0];
        // Adjuntar detalles de facturación
        const [billingRows] = await db_config_1.connectionPool.query(`SELECT * FROM billing_details WHERE user_id = ? AND is_default = 1 LIMIT 1`, [payment.user_id]);
        if (billingRows && billingRows.length > 0) {
            payment.billing = billingRows[0];
            console.log(`[sendReceiptForPayment] Attached default billing details for payment ${paymentId}`);
        }
        else {
            // Fallback: si no hay detalle por defecto, intentar obtener cualquier detalle
            const [anyBilling] = await db_config_1.connectionPool.query(`SELECT * FROM billing_details WHERE user_id = ? LIMIT 1`, [payment.user_id]);
            if (anyBilling && anyBilling.length > 0)
                payment.billing = anyBilling[0];
            if (anyBilling && anyBilling.length > 0)
                console.log(`[sendReceiptForPayment] Attached non-default billing details for payment ${paymentId}`);
        }
        const recipientName = payment.billing?.company_name || `${payment.user_first_name || ''} ${payment.user_last_name || ''}`.trim();
        const emailSent = await (0, emailService_1.sendPaymentReceiptEmail)(payment.user_email, payment, recipientName);
        console.log(`[sendReceiptForPayment] ${emailSent ? '✅ Correo enviado' : '⚠️ Falló el envío de correo'} para pago ID: ${paymentId}`);
        return emailSent;
    }
    catch (error) {
        console.error(`[sendReceiptForPayment] ❌ Error enviando recibo para pago ID: ${paymentId}`, error);
        return false;
    }
}
/**
 * Enviar email de boleta
 */
const sendReceiptEmail = async (req, res) => {
    try {
        const { paymentId } = req.body;
        const userId = req.user.id; // Usar siempre el usuario autenticado
        if (!paymentId) {
            return res.status(400).json({
                success: false,
                error: 'Payment ID is required'
            });
        }
        const emailSent = await sendReceiptForPayment(Number(paymentId), userId);
        if (emailSent) {
            res.json({
                success: true,
                message: 'El recibo ha sido enviado por correo electrónico.'
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Failed to send email'
            });
        }
    }
    catch (error) {
        console.error('Error sending receipt email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send receipt email'
        });
    }
};
exports.sendReceiptEmail = sendReceiptEmail;
// =================================================================
// ==               CONTROLADORES PARA PRE-AUTORIZACIÓN           ==
// =================================================================
/**
 * Crea un PaymentIntent para pre-autorizar un pago.
 */
const preAuthorizeCharge = async (req, res) => {
    try {
        const { amount, customerId, paymentMethodId } = req.body;
        const userId = req.user.id;
        if (!amount || !customerId || !paymentMethodId) {
            return res.status(400).json({
                success: false,
                error: 'amount, customerId y paymentMethodId son requeridos',
            });
        }
        // En una implementación real, deberías verificar que el customerId pertenece al usuario autenticado (userId)
        // para evitar que un usuario pague por otro.
        const paymentIntent = await chargingPaymentService_1.chargingPaymentService.createPreAuthorizationIntent(amount, customerId, paymentMethodId);
        res.json({
            success: true,
            clientSecret: paymentIntent.clientSecret,
            paymentIntentId: paymentIntent.paymentIntentId,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido al pre-autorizar';
        console.error('[preAuthorizeCharge] Error:', message);
        res.status(500).json({ success: false, error: message });
    }
};
exports.preAuthorizeCharge = preAuthorizeCharge;
/**
 * Captura un pago previamente autorizado.
 */
const captureCharge = async (req, res) => {
    try {
        const { paymentIntentId, amountToCapture } = req.body;
        if (!paymentIntentId || amountToCapture === undefined) {
            return res.status(400).json({
                success: false,
                error: 'paymentIntentId y amountToCapture son requeridos',
            });
        }
        const paymentIntent = await chargingPaymentService_1.chargingPaymentService.captureAuthorizedPayment(paymentIntentId, amountToCapture);
        // Aquí podrías añadir lógica adicional, como guardar el resultado en tu tabla de `payments`.
        res.json({
            success: true,
            status: paymentIntent.status,
            paymentIntentId: paymentIntentId,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido al capturar el pago';
        console.error('[captureCharge] Error:', message);
        res.status(500).json({ success: false, error: message });
    }
};
exports.captureCharge = captureCharge;
const getPaymentDetails = async (req, res) => {
    try {
        const { session_id } = req.query;
        if (!session_id) {
            return res.status(400).json({
                success: false,
                error: 'session_id is required',
            });
        }
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ['payment_intent'],
        });
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
            });
        }
        res.json({
            success: true,
            paymentIntentId: session.payment_intent.id,
            amount: session.amount_total / 100, // amount is in cents
            sessionId: session.id,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[getPaymentDetails] Error:', message);
        res.status(500).json({ success: false, error: message });
    }
};
exports.getPaymentDetails = getPaymentDetails;
