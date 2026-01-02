"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentStats = exports.getPaymentHistory = exports.refundPayment = exports.confirmPayment = exports.processPayment = exports.getTransactions = exports.deletePaymentMethod = exports.getPaymentMethods = exports.setDefaultPaymentMethod = exports.addPaymentMethod = void 0;
const stripe_1 = __importDefault(require("stripe"));
const db_config_1 = require("../../config/db.config");
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-05-28.basil',
});
const addPaymentMethod = async (userId, paymentMethodData) => {
    let conn;
    let methods = null;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        // 1. Crear token en Stripe
        const token = await stripe.tokens.retrieve(paymentMethodData.source);
        // 2. Crear PaymentMethod usando el token
        const paymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                token: token.id
            },
        });
        // 2. Crear cliente en Stripe si no existe
        const [userRows] = await conn.query('SELECT stripe_customer_id FROM users WHERE id = ?', [userId]);
        let customerId = userRows[0]?.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: paymentMethodData.email,
                metadata: { userId: userId.toString() },
            });
            customerId = customer.id;
            await conn.query('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, userId]);
        }
        // 3. Vincular PaymentMethod al cliente
        await stripe.paymentMethods.attach(paymentMethod.id, {
            customer: customerId,
        });
        // 4. Guardar en nuestra base de datos
        const [result] = await conn.query(`INSERT INTO payment_methods 
       (id, user_id, type, card_brand, last4, exp_month, exp_year, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            paymentMethod.id,
            userId,
            'card',
            paymentMethod.card?.brand,
            paymentMethod.card?.last4,
            paymentMethod.card?.exp_month,
            paymentMethod.card?.exp_year,
            false // Por defecto no es el método predeterminado
        ]);
        // Si es el primer método, marcarlo como predeterminado
        if (result.affectedRows === 1) {
            const [rows] = await conn.query('SELECT COUNT(*) as count FROM payment_methods WHERE user_id = ?', [userId]);
            methods = rows;
            if (methods[0].count === 1) {
                await (0, exports.setDefaultPaymentMethod)(userId, paymentMethod.id);
            }
        }
        return {
            id: paymentMethod.id,
            type: 'card',
            card_brand: paymentMethod.card?.brand,
            last4: paymentMethod.card?.last4,
            exp_month: paymentMethod.card?.exp_month,
            exp_year: paymentMethod.card?.exp_year,
            is_default: methods?.[0]?.count === 1,
        };
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.addPaymentMethod = addPaymentMethod;
const setDefaultPaymentMethod = async (userId, methodId) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        await conn.query('START TRANSACTION');
        await conn.query('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?', [userId]);
        await conn.query('UPDATE payment_methods SET is_default = 1 WHERE id = ? AND user_id = ?', [methodId, userId]);
        await conn.query('COMMIT');
    }
    catch (error) {
        if (conn)
            await conn.query('ROLLBACK');
        throw error;
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.setDefaultPaymentMethod = setDefaultPaymentMethod;
// Añade timeout a las consultas SQL
const getPaymentMethods = async (userId) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        // Timeout de 8 segundos para la consulta
        const [rows] = await conn.query('SELECT * FROM payment_methods WHERE user_id = ?', [userId]);
        if (!rows) {
            throw new Error('La consulta no devolvió resultados');
        }
        return rows;
    }
    catch (error) {
        console.error('Error en getPaymentMethods:', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.getPaymentMethods = getPaymentMethods;
const deletePaymentMethod = async (userId, methodId) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        await conn.query('DELETE FROM payment_methods WHERE id = ? AND user_id = ?', [methodId, userId]);
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.deletePaymentMethod = deletePaymentMethod;
const getTransactions = async (userId) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        const [rows] = await conn.query(`SELECT * FROM payments 
       WHERE user_id = ? 
       ORDER BY created_at DESC`, [userId]);
        return rows;
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.getTransactions = getTransactions;
/**
 * Procesa un pago real usando Stripe
 */
const processPayment = async (paymentData) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        await conn.query('START TRANSACTION');
        // 1. Obtener método de pago predeterminado del usuario
        const [paymentMethods] = await conn.query('SELECT * FROM payment_methods WHERE user_id = ? AND is_default = 1', [paymentData.userId]);
        if (paymentMethods.length === 0) {
            throw new Error('No se encontró método de pago predeterminado');
        }
        const defaultMethod = paymentMethods[0];
        // 2. Obtener información del usuario para Stripe
        const [users] = await conn.query('SELECT stripe_customer_id, email, first_name, last_name FROM users WHERE id = ?', [paymentData.userId]);
        if (users.length === 0) {
            throw new Error('Usuario no encontrado');
        }
        const user = users[0];
        // 3. Crear PaymentIntent en Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: paymentData.amount,
            currency: paymentData.currency.toLowerCase(),
            customer: user.stripe_customer_id,
            payment_method: defaultMethod.id,
            confirm: true, // Confirmar inmediatamente
            description: paymentData.description,
            metadata: {
                userId: paymentData.userId.toString(),
                chargerId: paymentData.chargerId.toString(),
                sessionId: paymentData.sessionId.toString(),
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });
        // 4. Generar número de factura
        const invoiceNumber = generateInvoiceNumber();
        // 5. Guardar pago en base de datos
        const [paymentResult] = await conn.query(`INSERT INTO payments 
       (user_id, charger_id, session_id, amount, currency, status, payment_method_id, transaction_id, invoice_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            paymentData.userId,
            paymentData.chargerId,
            paymentData.sessionId,
            paymentData.amount / 100, // Convertir de centavos a euros
            paymentData.currency.toUpperCase(),
            paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
            defaultMethod.id,
            paymentIntent.id,
            invoiceNumber,
        ]);
        await conn.query('COMMIT');
        return {
            success: paymentIntent.status === 'succeeded',
            paymentId: paymentResult.insertId,
            transactionId: paymentIntent.id,
            invoiceNumber: invoiceNumber,
            status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
        };
    }
    catch (error) {
        if (conn)
            await conn.query('ROLLBACK');
        console.error('Error procesando pago:', error);
        return {
            success: false,
            error: error.message || 'Error desconocido al procesar el pago',
            status: 'failed',
        };
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.processPayment = processPayment;
/**
 * Confirma un pago pendiente usando webhook
 */
const confirmPayment = async (paymentIntentId) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status === 'succeeded') {
            await conn.query('UPDATE payments SET status = ? WHERE transaction_id = ?', ['completed', paymentIntentId]);
            return true;
        }
        return false;
    }
    catch (error) {
        console.error('Error confirmando pago:', error);
        return false;
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.confirmPayment = confirmPayment;
/**
 * Reembolsa un pago
 */
const refundPayment = async (paymentId, amount) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        // Obtener información del pago
        const [payments] = await conn.query('SELECT * FROM payments WHERE id = ?', [paymentId]);
        if (payments.length === 0) {
            throw new Error('Pago no encontrado');
        }
        const payment = payments[0];
        // Crear reembolso en Stripe
        const refundData = {
            payment_intent: payment.transaction_id,
        };
        if (amount) {
            refundData.amount = amount * 100; // Convertir a centavos
        }
        const refund = await stripe.refunds.create(refundData);
        // Actualizar estado en base de datos
        await conn.query('UPDATE payments SET status = ? WHERE id = ?', ['refunded', paymentId]);
        return true;
    }
    catch (error) {
        console.error('Error procesando reembolso:', error);
        return false;
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.refundPayment = refundPayment;
/**
 * Genera número de factura único
 */
const generateInvoiceNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `INV-${timestamp}-${random}`;
};
/**
 * Obtiene historial de pagos con detalles
 */
const getPaymentHistory = async (userId) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        const [rows] = await conn.query(`SELECT 
        p.*,
        c.name as charger_name,
        c.serial_number,
        cs.start_time,
        cs.end_time,
        cs.total_energy,
        pm.card_brand,
        pm.last4,
        bd.company_name as billing_company_name,
        bd.first_name as billing_first_name,
        bd.last_name as billing_last_name
       FROM payments p
       LEFT JOIN chargers c ON p.charger_id = c.id
       LEFT JOIN charging_sessions cs ON p.session_id = cs.id
       LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id
       LEFT JOIN billing_details bd ON p.user_id = bd.user_id AND bd.is_default = 1
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`, [userId]);
        return rows;
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.getPaymentHistory = getPaymentHistory;
/**
 * Obtiene estadísticas de pagos
 */
const getPaymentStats = async (userId) => {
    let conn;
    try {
        conn = await db_config_1.connectionPool.getConnection();
        const [rows] = await conn.query(`SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_paid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as total_failed
       FROM payments 
       WHERE user_id = ?`, [userId]);
        return rows[0];
    }
    finally {
        if (conn)
            conn.release();
    }
};
exports.getPaymentStats = getPaymentStats;
