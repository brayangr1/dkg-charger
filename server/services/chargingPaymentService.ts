import Stripe from 'stripe';
import { connectionPool } from '../config/db.config';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil' as const,
});

interface PaymentPreauth extends RowDataPacket {
  id: number;
  user_id: number;
  payment_intent_id: string;
  amount: number;
  status: string;
  captured_amount: number | null;
  refunded_amount: number | null;
  refunded_at: Date | null;
  created_at: Date;
}

export const chargingPaymentService = {
  /**
   * Crear pre-autorización al iniciar la carga
   */
  async createPreAuth(userId: number, amount: number, paymentMethodId: string) {
    try {
      // 0. Obtener stripe_customer_id del usuario
      const [users] = await connectionPool.query<RowDataPacket[]>(
        'SELECT stripe_customer_id FROM users WHERE id = ?',
        [userId]
      );

      if (!users.length || !users[0].stripe_customer_id) {
        throw new Error('Usuario no tiene un ID de cliente de Stripe asociado');
      }

      const stripeCustomerId = users[0].stripe_customer_id;

      // 1. Crear PaymentIntent con capture_method = manual
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convertir a centavos
        currency: 'eur',
        payment_method: paymentMethodId,
        capture_method: 'manual', // Importante: esto permite pre-autorizar
        confirm: true,
        customer: stripeCustomerId,
        metadata: {
          type: 'charging_preauth',
          userId: userId.toString()
        },
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never' // Evitar redirecciones en flujo manual si es posible
        }
      });

      // 2. Guardar referencia en la base de datos
      const [result] = await connectionPool.query<ResultSetHeader>(
        `INSERT INTO payment_preauths 
         (user_id, payment_intent_id, amount, status, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [userId, paymentIntent.id, amount, 'pending']
      );

      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        preAuthId: result.insertId
      };
    } catch (error) {
      console.error('Error en createPreAuth:', error);
      throw error;
    }
  },

  /**
   * Capturar el pago real al finalizar la carga
   */
  async capturePayment(
    userId: number,
    sessionId: string,
    preAuthId: number,
    finalAmount: number
  ) {
    try {
      // 1. Obtener el PaymentIntent ID de la pre-autorización
      const [preauths] = await connectionPool.query<PaymentPreauth[]>(
        'SELECT payment_intent_id FROM payment_preauths WHERE id = ? AND user_id = ?',
        [preAuthId, userId]
      );

      if (preauths.length === 0) {
        throw new Error('Pre-autorización no encontrada');
      }

      const paymentIntentId = preauths[0].payment_intent_id;

      // 2. Capturar solo el monto real consumido
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, {
        amount_to_capture: Math.round(finalAmount * 100)
      });

      // 3. Crear el registro de pago en la base de datos
      const [result] = await connectionPool.query<ResultSetHeader>(
        `INSERT INTO payments 
         (user_id, session_id, amount, payment_intent_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, sessionId, finalAmount, paymentIntentId, 'completed']
      );

      // 4. Actualizar estado de la pre-autorización
      await connectionPool.query(
        'UPDATE payment_preauths SET status = ?, captured_amount = ? WHERE id = ?',
        ['completed', finalAmount, preAuthId]
      );

      return {
        success: true,
        paymentId: result.insertId,
        transactionId: paymentIntent.id,
        status: paymentIntent.status
      };
    } catch (error) {
      console.error('Error en capturePayment:', error);
      throw error;
    }
  },

  /**
   * Cancelar una pre-autorización si el usuario cancela la carga
   */
  async cancelPreAuth(userId: number, preAuthId: number) {
    try {
      const [preauths] = await connectionPool.query<PaymentPreauth[]>(
        'SELECT payment_intent_id FROM payment_preauths WHERE id = ? AND user_id = ?',
        [preAuthId, userId]
      );

      if (preauths.length === 0) {
        throw new Error('Pre-autorización no encontrada');
      }

      // Cancelar el PaymentIntent en Stripe
      await stripe.paymentIntents.cancel(preauths[0].payment_intent_id);

      // Actualizar estado en la base de datos
      await connectionPool.query(
        'UPDATE payment_preauths SET status = ? WHERE id = ?',
        ['cancelled', preAuthId]
      );

      return { success: true };
    } catch (error) {
      console.error('Error en cancelPreAuth:', error);
      throw error;
    }
  },


  async createPreAuthorizationIntent(
    amount: number,
    userId: number,
    paymentMethodId: string
  ) {
    return this.createPreAuth(
      userId,
      amount,
      paymentMethodId
    );
  },


  /**
   * Alias para capturePayment (mantener compatibilidad)
   */
  async captureAuthorizedPayment(
    paymentIntentId: string,
    amountToCapture: number
  ) {
    // Necesitarías obtener userId y sessionId de la base de datos
    // Esto es más complejo y requiere modificación
    const [preauths] = await connectionPool.query<PaymentPreauth[]>(
      'SELECT user_id, id as preAuthId FROM payment_preauths WHERE payment_intent_id = ?',
      [paymentIntentId]
    );

    if (preauths.length === 0) {
      throw new Error('Pre-autorización no encontrada');
    }

    const preAuth = preauths[0];

    // Necesitas obtener sessionId de algún lado - esto es un problema
    // ya que no está disponible en este contexto
    const sessionId = ''; // Necesitas obtener esto de alguna manera

    return this.capturePayment(
      preAuth.user_id,
      sessionId,
      preAuth.preAuthId,
      amountToCapture
    );
  }

};

