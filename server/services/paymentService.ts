// server/services/paymentService.ts
import { connectionPool } from '../config/db.config';
import { RowDataPacket } from 'mysql2/promise';
import stripe from 'stripe'; // Asumiendo que usas Stripe

const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);

interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'applepay' | 'googlepay';
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

export const paymentService = {
  async validatePaymentMethod(userId: number, paymentMethodId: string): Promise<boolean> {
    try {
      const [rows] = await connectionPool.query<RowDataPacket[]>(
        `SELECT 1 FROM payment_methods 
         WHERE id = ? AND user_id = ?`,
        [paymentMethodId, userId]
      );
      return rows.length > 0;
    } catch (error) {
      console.error('Error validating payment method:', error);
      return false;
    }
  },

  async listPaymentMethods(userId: number): Promise<PaymentMethod[]> {
    try {
      const [rows] = await connectionPool.query<RowDataPacket[]>(
        `SELECT 
           id, type, card_brand as brand, 
           last4, exp_month, exp_year
         FROM payment_methods 
         WHERE user_id = ?`,
        [userId]
      );
      
      return rows.map(row => ({
        id: row.id,
        type: row.type,
        card: {
          brand: row.brand,
          last4: row.last4,
          exp_month: row.exp_month,
          exp_year: row.exp_year
        }
      }));
    } catch (error) {
      console.error('Error listing payment methods:', error);
      throw error;
    }
  },

  async addPaymentMethod(userId: number, paymentMethodToken: string): Promise<PaymentMethod> {
    try {
      // Crear método de pago en Stripe
      const paymentMethod = await stripeClient.paymentMethods.attach(
        paymentMethodToken,
        { customer: await this.getStripeCustomerId(userId) }
      );

      // Guardar en base de datos
      await connectionPool.query(
        `INSERT INTO payment_methods 
         (id, user_id, type, card_brand, last4, exp_month, exp_year)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          paymentMethod.id,
          userId,
          paymentMethod.type,
          paymentMethod.card?.brand,
          paymentMethod.card?.last4,
          paymentMethod.card?.exp_month,
          paymentMethod.card?.exp_year
        ]
      );

      return {
        id: paymentMethod.id,
        type: paymentMethod.type as any,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year
        } : undefined
      };
    } catch (error) {
      console.error('Error adding payment method:', error);
      throw error;
    }
  },

  async processPayment(
    userId: number,
    sessionId: string,
    amount: number,
    paymentMethodId: string
  ): Promise<{ success: boolean; transactionId?: string }> {
    try {
      // 1. Verificar sesión de carga
      const [session] = await connectionPool.query<RowDataPacket[]>(
        `SELECT charger_id FROM charging_sessions WHERE id = ? AND user_id = ?`,
        [sessionId, userId]
      );

      if (session.length === 0) {
        throw new Error('Invalid charging session');
      }

      // 2. Crear pago en Stripe
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100), // Convertir a centavos
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        metadata: {
          userId: userId.toString(),
          sessionId,
          chargerId: session[0].charger_id
        }
      });

      // 3. Registrar pago en base de datos
      await connectionPool.query(
        `INSERT INTO payments 
         (user_id, charger_id, session_id, amount, currency, 
          status, payment_method_id, transaction_id, invoice_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          session[0].charger_id,
          sessionId,
          amount,
          'USD',
          paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
          paymentMethodId,
          paymentIntent.id,
          `INV-${Date.now()}`
        ]
      );

      return {
        success: paymentIntent.status === 'succeeded',
        transactionId: paymentIntent.id
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  },

  async getStripeCustomerId(userId: number): Promise<string> {
    const [user] = await connectionPool.query<RowDataPacket[]>(
      `SELECT stripe_customer_id FROM users WHERE id = ?`,
      [userId]
    );

    if (user[0]?.stripe_customer_id) {
      return user[0].stripe_customer_id;
    }

    // Crear nuevo cliente si no existe
    const customer = await stripeClient.customers.create({
      metadata: { userId: userId.toString() }
    });

    await connectionPool.query(
      `UPDATE users SET stripe_customer_id = ? WHERE id = ?`,
      [customer.id, userId]
    );

    return customer.id;
  }
};