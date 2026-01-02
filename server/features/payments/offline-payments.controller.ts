import { Request, Response } from 'express';
import { connectionPool } from '../../config/db.config';
import { OkPacket, RowDataPacket } from 'mysql2';

// Función temporal para obtener un usuario de prueba (coincide con payments.controller)
const getTestUserId = () => {
  return 62;
};

/**
 * Procesa un pago pendiente offline y genera la factura correspondiente
 */
export const processOfflinePayment = async (req: Request, res: Response) => {
  const connection = await connectionPool.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      sessionId,
      chargerId,
      userId,
      amount,
      energy,
      duration,
      paymentMethodId,
      offlineInvoiceId
    } = req.body;

    console.log('📄 Procesando pago offline:', {
      sessionId,
      amount,
      energy,
      duration,
      types: {
        amountType: typeof amount,
        energyType: typeof energy,
        durationType: typeof duration
      }
    });

    // 1. Verificar que el usuario exista; si no existe, usar usuario de prueba para evitar violaciones FK
    let userIdToUse = userId;
    try {
      const [users] = await connection.query<RowDataPacket[]>('SELECT id FROM users WHERE id = ?', [userId]);
      if (!users || users.length === 0) {
        console.warn(`[processOfflinePayment] Usuario ${userId} no encontrado en DB. Usando usuario de prueba ${getTestUserId()}`);
        userIdToUse = getTestUserId();
      }
    } catch (uErr) {
      console.warn('[processOfflinePayment] Error verificando usuario, usando usuario de prueba', uErr);
      userIdToUse = getTestUserId();
    }

    // 1b. Verificar si ya existe un pago para esta sesión
    const [existingPayments] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM payments WHERE session_id = ? AND user_id = ?',
      [sessionId, userIdToUse]
    );

    if (existingPayments && existingPayments.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        error: 'Ya existe un pago para esta sesión'
      });
    }

    // 2. Generar IDs únicos para la transacción y factura
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substr(2, 9);
    const transactionId = `txn_offline_${timestamp}_${randomPart}`;
    const invoiceNumber = `INV-${timestamp}-${randomPart}`;

    // 3. Insertar el pago en la base de datos
    // Asegurar que amount sea number y en euros (si el cliente manda centavos ajustar antes)
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    console.log('📊 parsedAmount =>', parsedAmount);

    // Asegurar que exista un payment_method válido para evitar violación FK
    const methodIdToUse = paymentMethodId || `offline_payment_${userIdToUse}`;
    try {
      const [pmRows] = await connection.query<RowDataPacket[]>('SELECT id FROM payment_methods WHERE id = ?', [methodIdToUse]);
      if (!pmRows || pmRows.length === 0) {
        console.log(`[processOfflinePayment] Creando payment_method fallback: ${methodIdToUse} para user ${userIdToUse}`);
        await connection.query(
          `INSERT INTO payment_methods (id, user_id, type, card_brand, last4, is_default, created_at) VALUES (?, ?, 'card', 'offline', '0000', 0, NOW())`
        , [methodIdToUse, userIdToUse]);
      }
    } catch (pmErr) {
      console.warn('[processOfflinePayment] Error asegurando payment_method fallback:', pmErr);
    }

    const [paymentResult] = await connection.query<OkPacket>(
      `INSERT INTO payments 
       (user_id, charger_id, session_id, amount, currency, status, 
        payment_method_id, transaction_id, invoice_number, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userIdToUse,
        chargerId,
        sessionId,
        parsedAmount,
        'EUR',
        'completed',
        methodIdToUse,
        transactionId,
        invoiceNumber
      ]
    );

    // 4. Registrar la sesión de carga y obtener sessionDbId numérico
    let sessionDbId: number | null = null;
    const incomingSessionStr = sessionId ? sessionId.toString() : '';
    const isNumericSession = /^[0-9]+$/.test(incomingSessionStr);

    if (isNumericSession) {
      sessionDbId = Number(incomingSessionStr);
      const [existingSessions] = await connection.query<RowDataPacket[]>('SELECT id FROM charging_sessions WHERE id = ?', [sessionDbId]);
      if (!existingSessions || existingSessions.length === 0) {
        const [res] = await connection.query<any>(
          `INSERT INTO charging_sessions 
           (charger_id, user_id, start_time, end_time, total_energy, duration_seconds, estimated_cost, charging_mode) 
           VALUES (?, ?, NOW() - INTERVAL ? MINUTE, NOW(), ?, ?, ?, 'offline')`,
          [chargerId, userIdToUse, duration || 1, energy || 0, (duration || 1) * 60, amount]
        );
        sessionDbId = res.insertId || sessionDbId;
      }
    } else {
      const [res] = await connection.query<any>(
        `INSERT INTO charging_sessions 
         (charger_id, user_id, start_time, end_time, total_energy, duration_seconds, estimated_cost, charging_mode) 
         VALUES (?, ?, NOW() - INTERVAL ? MINUTE, NOW(), ?, ?, ?, 'offline')`,
        [chargerId, userIdToUse, duration || 1, energy || 0, (duration || 1) * 60, amount]
      );
      sessionDbId = res.insertId;
    }

    await connection.commit();

    console.log('✅ Pago offline procesado exitosamente');
    console.log('📄 Factura generada:', invoiceNumber);
    console.log('💳 ID de transacción:', transactionId);

    res.json({
      success: true,
      paymentId: paymentResult.insertId,
      transactionId,
      invoiceNumber,
      message: 'Pago offline procesado exitosamente'
    });

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error procesando pago offline:', error instanceof Error ? error.stack || error.message : error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  } finally {
    connection.release();
  }
};
