"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chargingPaymentService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const db_config_1 = require("../config/db.config");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-05-28.basil',
});
exports.chargingPaymentService = {
    /**
     * Crear pre-autorización al iniciar la carga
     */
    async createPreAuth(userId, amount, paymentMethodId) {
        try {
            // 1. Crear PaymentIntent con capture_method = manual
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convertir a centavos
                currency: 'eur',
                payment_method: paymentMethodId,
                capture_method: 'manual', // Importante: esto permite pre-autorizar
                confirm: true,
                customer: userId.toString(), // Asumiendo que usas el userId como customer ID
                metadata: {
                    type: 'charging_preauth',
                    userId: userId.toString()
                }
            });
            // 2. Guardar referencia en la base de datos
            const [result] = await db_config_1.connectionPool.query(`INSERT INTO payment_preauths 
         (user_id, payment_intent_id, amount, status, created_at) 
         VALUES (?, ?, ?, ?, NOW())`, [userId, paymentIntent.id, amount, 'pending']);
            return {
                success: true,
                paymentIntentId: paymentIntent.id,
                clientSecret: paymentIntent.client_secret,
                preAuthId: result.insertId
            };
        }
        catch (error) {
            console.error('Error en createPreAuth:', error);
            throw error;
        }
    },
    /**
     * Capturar el pago real al finalizar la carga
     */
    async capturePayment(userId, sessionId, preAuthId, finalAmount) {
        try {
            // 1. Obtener el PaymentIntent ID de la pre-autorización
            const [preauths] = await db_config_1.connectionPool.query('SELECT payment_intent_id FROM payment_preauths WHERE id = ? AND user_id = ?', [preAuthId, userId]);
            if (preauths.length === 0) {
                throw new Error('Pre-autorización no encontrada');
            }
            const paymentIntentId = preauths[0].payment_intent_id;
            // 2. Capturar solo el monto real consumido
            const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, {
                amount_to_capture: Math.round(finalAmount * 100)
            });
            // 3. Crear el registro de pago en la base de datos
            const [result] = await db_config_1.connectionPool.query(`INSERT INTO payments 
         (user_id, session_id, amount, payment_intent_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`, [userId, sessionId, finalAmount, paymentIntentId, 'completed']);
            // 4. Actualizar estado de la pre-autorización
            await db_config_1.connectionPool.query('UPDATE payment_preauths SET status = ?, captured_amount = ? WHERE id = ?', ['completed', finalAmount, preAuthId]);
            return {
                success: true,
                paymentId: result.insertId,
                transactionId: paymentIntent.id,
                status: paymentIntent.status
            };
        }
        catch (error) {
            console.error('Error en capturePayment:', error);
            throw error;
        }
    },
    /**
     * Cancelar una pre-autorización si el usuario cancela la carga
     */
    async cancelPreAuth(userId, preAuthId) {
        try {
            const [preauths] = await db_config_1.connectionPool.query('SELECT payment_intent_id FROM payment_preauths WHERE id = ? AND user_id = ?', [preAuthId, userId]);
            if (preauths.length === 0) {
                throw new Error('Pre-autorización no encontrada');
            }
            // Cancelar el PaymentIntent en Stripe
            await stripe.paymentIntents.cancel(preauths[0].payment_intent_id);
            // Actualizar estado en la base de datos
            await db_config_1.connectionPool.query('UPDATE payment_preauths SET status = ? WHERE id = ?', ['cancelled', preAuthId]);
            return { success: true };
        }
        catch (error) {
            console.error('Error en cancelPreAuth:', error);
            throw error;
        }
    },
    async createPreAuthorizationIntent(amount, customerId, paymentMethodId) {
        return this.createPreAuth(parseInt(customerId), // Asumiendo que customerId es el userId
        amount, paymentMethodId);
    },
    /**
     * Alias para capturePayment (mantener compatibilidad)
     */
    async captureAuthorizedPayment(paymentIntentId, amountToCapture) {
        // Necesitarías obtener userId y sessionId de la base de datos
        // Esto es más complejo y requiere modificación
        const [preauths] = await db_config_1.connectionPool.query('SELECT user_id, id as preAuthId FROM payment_preauths WHERE payment_intent_id = ?', [paymentIntentId]);
        if (preauths.length === 0) {
            throw new Error('Pre-autorización no encontrada');
        }
        const preAuth = preauths[0];
        // Necesitas obtener sessionId de algún lado - esto es un problema
        // ya que no está disponible en este contexto
        const sessionId = ''; // Necesitas obtener esto de alguna manera
        return this.capturePayment(preAuth.user_id, sessionId, preAuth.preAuthId, amountToCapture);
    }
};
