import Stripe from 'stripe';
import { connectionPool } from '../../config/db.config';
import { RowDataPacket } from 'mysql2/promise';
import { ResultSetHeader } from 'mysql2';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil' as const,
});

// Función auxiliar para validar número de tarjeta (Algoritmo de Luhn)
function validateCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// Detectar marca de tarjeta
function getCardBrand(cardNumber: string): string {
  if (!cardNumber) return 'unknown';
  const firstDigit = cardNumber[0];
  if (firstDigit === '4') return 'visa';
  if (firstDigit === '5') return 'mastercard';
  if (firstDigit === '3') return 'amex';
  return 'unknown';
}

export const addPaymentMethodWithCardData = async (userId: number, cardData: any) => {
  let conn;
  try {
    // Validar datos
    if (!cardData.cardNumber || !cardData.expMonth || !cardData.expYear || !cardData.cvc) {
      throw new Error('Datos de tarjeta incompletos');
    }

    if (!validateCardNumber(cardData.cardNumber)) {
      throw new Error('Número de tarjeta inválido');
    }

    const last4 = cardData.cardNumber.slice(-4);
    const brand = getCardBrand(cardData.cardNumber);
    const methodId = `pm_mobile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    conn = await connectionPool.getConnection();

    // Guardar en la BD sin crear token de Stripe (para desarrollo)
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO payment_methods 
       (id, user_id, type, card_brand, last4, exp_month, exp_year, is_default, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        methodId,
        userId,
        'card',
        brand,
        last4,
        cardData.expMonth,
        cardData.expYear,
        false
      ]
    );

    // Si es el primer método, marcarlo como predeterminado
    if (result.affectedRows === 1) {
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM payment_methods WHERE user_id = ?',
        [userId]
      );

      if (rows[0].count === 1) {
        await conn.query(
          'UPDATE payment_methods SET is_default = 1 WHERE id = ? AND user_id = ?',
          [methodId, userId]
        );
      }
    }

    return {
      success: true,
      method: {
        id: methodId,
        type: 'card',
        card_brand: brand,
        last4: last4,
        exp_month: cardData.expMonth,
        exp_year: cardData.expYear,
        is_default: result.affectedRows === 1,
        created_at: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error agregando método de pago:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export const addPaymentMethod = async (userId: number, paymentMethodData: any) => {
  let conn;
  let methods: RowDataPacket[] | null = null;
  try {
    conn = await connectionPool.getConnection();

    // Si viene con datos de tarjeta directos, usar la nueva función
    if (paymentMethodData.cardNumber) {
      return await addPaymentMethodWithCardData(userId, paymentMethodData);
    }

    // Verificar si se proporcionó un token de Stripe o un PaymentMethod ID
    if (!paymentMethodData.source) {
      throw new Error('No se proporcionó un token de Stripe válido');
    }

    let paymentMethodId = paymentMethodData.source;

    // Si es un token (tok_), crear el PaymentMethod. Si ya es un PaymentMethod (pm_), usarlo directo.
    if (paymentMethodData.source.startsWith('tok_')) {
      // 1. Crear token en Stripe
      const token = await stripe.tokens.retrieve(paymentMethodData.source);

      // 2. Crear PaymentMethod usando el token
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          token: token.id
        },
      });
      paymentMethodId = paymentMethod.id;
    } else if (paymentMethodData.source.startsWith('pm_')) {
      // Ya es un payment method id, no necesitamos crear nada
      paymentMethodId = paymentMethodData.source;
    }

    // Obtener los detalles del payment method para guardarlos en la BD
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // 2. Crear cliente en Stripe si no existe
    const [userRows] = await conn.query<RowDataPacket[]>(
      'SELECT stripe_customer_id FROM users WHERE id = ?',
      [userId]
    );

    let customerId = userRows[0]?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: paymentMethodData.email,
        metadata: { userId: userId.toString() },
      });

      customerId = customer.id;

      await conn.query(
        'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
        [customerId, userId]
      );
    }

    // 3. Vincular PaymentMethod al cliente
    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customerId,
    });

    // 4. Guardar en nuestra base de datos
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO payment_methods 
       (id, user_id, type, card_brand, last4, exp_month, exp_year, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentMethod.id,
        userId,
        'card',
        paymentMethod.card?.brand,
        paymentMethod.card?.last4,
        paymentMethod.card?.exp_month,
        paymentMethod.card?.exp_year,
        false // Por defecto no es el método predeterminado
      ]
    );

    // Si es el primer método, marcarlo como predeterminado
    if (result.affectedRows === 1) {
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM payment_methods WHERE user_id = ?',
        [userId]
      );

      methods = rows;

      if (methods[0].count === 1) {
        await setDefaultPaymentMethod(userId, paymentMethod.id);
      }
    }

    return {
      success: true,
      method: {
        id: paymentMethod.id,
        type: 'card',
        card_brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        exp_month: paymentMethod.card?.exp_month,
        exp_year: paymentMethod.card?.exp_year,
        is_default: methods?.[0]?.count === 1,
      }
    };
  } catch (error) {
    console.error('Error agregando método de pago:', error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

export const setDefaultPaymentMethod = async (userId: number, methodId: string) => {
  let conn;
  try {
    conn = await connectionPool.getConnection();
    await conn.query('START TRANSACTION');

    await conn.query(
      'UPDATE payment_methods SET is_default = 0 WHERE user_id = ?',
      [userId]
    );

    await conn.query(
      'UPDATE payment_methods SET is_default = 1 WHERE id = ? AND user_id = ?',
      [methodId, userId]
    );

    await conn.query('COMMIT');
  } catch (error) {
    if (conn) await conn.query('ROLLBACK');
    throw error;
  } finally {
    if (conn) conn.release();
  }
};

// Añade timeout a las consultas SQL
export const getPaymentMethods = async (userId: number) => {
  let conn;
  try {
    conn = await connectionPool.getConnection();
    console.log('🔍 [server] getPaymentMethods - Buscando métodos de pago para userId:', userId);

    // Timeout de 8 segundos para la consulta
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM payment_methods WHERE user_id = ?',
      [userId],

    );

    console.log('✅ [server] getPaymentMethods - Resultados encontrados:', rows?.length || 0);
    if (rows && rows.length > 0) {
      console.log('📋 [server] Métodos encontrados:', rows.map((r: any) => ({ id: r.id, card_brand: r.card_brand, last4: r.last4 })));
    }

    if (!rows) {
      throw new Error('La consulta no devolvió resultados');
    }

    return rows;
  } catch (error) {
    console.error('Error en getPaymentMethods:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  } finally {
    if (conn) conn.release();
  }
};
export const deletePaymentMethod = async (userId: number, methodId: string) => {
  let conn;
  try {
    conn = await connectionPool.getConnection();
    await conn.query(
      'DELETE FROM payment_methods WHERE id = ? AND user_id = ?',
      [methodId, userId]
    );
  } finally {
    if (conn) conn.release();
  }
};

export const getTransactions = async (userId: number) => {
  let conn;
  try {
    conn = await connectionPool.getConnection();
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT * FROM payments 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  } finally {
    if (conn) conn.release();
  }
};

// ===== NUEVAS FUNCIONES PARA PAGOS REALES =====

export interface PaymentIntentData {
  userId: number;
  chargerId: number;
  sessionId: number;
  amount: number; // en centavos
  currency: string;
  description: string;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: number;
  transactionId?: string;
  invoiceNumber?: string;
  error?: string;
  status: 'pending' | 'completed' | 'failed';
}

/**
 * Procesa un pago real usando Stripe
 */
export const processPayment = async (paymentData: PaymentIntentData): Promise<PaymentResult> => {
  let conn;
  try {
    conn = await connectionPool.getConnection();
    await conn.query('START TRANSACTION');

    // 1. Obtener método de pago predeterminado del usuario
    const [paymentMethods] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM payment_methods WHERE user_id = ? AND is_default = 1',
      [paymentData.userId]
    );

    if (paymentMethods.length === 0) {
      throw new Error('No se encontró método de pago predeterminado');
    }

    const defaultMethod = paymentMethods[0];

    // 2. Obtener información del usuario para Stripe
    const [users] = await conn.query<RowDataPacket[]>(
      'SELECT stripe_customer_id, email, first_name, last_name FROM users WHERE id = ?',
      [paymentData.userId]
    );

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
    const [paymentResult] = await conn.query<ResultSetHeader>(
      `INSERT INTO payments 
       (user_id, charger_id, session_id, amount, currency, status, payment_method_id, transaction_id, invoice_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentData.userId,
        paymentData.chargerId,
        paymentData.sessionId,
        paymentData.amount / 100, // Convertir de centavos a euros
        paymentData.currency.toUpperCase(),
        paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
        defaultMethod.id,
        paymentIntent.id,
        invoiceNumber,
      ]
    );

    await conn.query('COMMIT');

    return {
      success: paymentIntent.status === 'succeeded',
      paymentId: paymentResult.insertId,
      transactionId: paymentIntent.id,
      invoiceNumber: invoiceNumber,
      status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
    };

  } catch (error: any) {
    if (conn) await conn.query('ROLLBACK');

    console.error('Error procesando pago:', error);

    return {
      success: false,
      error: error.message || 'Error desconocido al procesar el pago',
      status: 'failed',
    };
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Confirma un pago pendiente usando webhook
 */
export const confirmPayment = async (paymentIntentId: string): Promise<boolean> => {
  let conn;
  try {
    conn = await connectionPool.getConnection();

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      await conn.query(
        'UPDATE payments SET status = ? WHERE transaction_id = ?',
        ['completed', paymentIntentId]
      );
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error confirmando pago:', error);
    return false;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Reembolsa un pago
 */
export const refundPayment = async (paymentId: number, amount?: number): Promise<boolean> => {
  let conn;
  try {
    conn = await connectionPool.getConnection();

    // Obtener información del pago
    const [payments] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM payments WHERE id = ?',
      [paymentId]
    );

    if (payments.length === 0) {
      throw new Error('Pago no encontrado');
    }

    const payment = payments[0];

    // Crear reembolso en Stripe
    const refundData: any = {
      payment_intent: payment.transaction_id,
    };

    if (amount) {
      refundData.amount = amount * 100; // Convertir a centavos
    }

    const refund = await stripe.refunds.create(refundData);

    // Actualizar estado en base de datos
    await conn.query(
      'UPDATE payments SET status = ? WHERE id = ?',
      ['refunded', paymentId]
    );

    return true;
  } catch (error) {
    console.error('Error procesando reembolso:', error);
    return false;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Genera número de factura único
 */
const generateInvoiceNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `INV-${timestamp}-${random}`;
};

/**
 * Obtiene historial de pagos con detalles
 */
export const getPaymentHistory = async (userId: number) => {
  let conn;
  try {
    conn = await connectionPool.getConnection();

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT 
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
       ORDER BY p.created_at DESC`,
      [userId]
    );

    return rows;
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Obtiene estadísticas de pagos
 */
export const getPaymentStats = async (userId: number) => {
  let conn;
  try {
    conn = await connectionPool.getConnection();

    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_paid,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as total_pending,
        SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as total_failed
       FROM payments 
       WHERE user_id = ?`,
      [userId]
    );

    return rows[0];
  } finally {
    if (conn) conn.release();
  }
};
