import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import CONFIG from '../../config/env.config';
import { 
  addPaymentMethod, 
  getPaymentMethods, 
  setDefaultMethod,
  deletePaymentMethod,
  getTransactions,
  // Nuevos controladores
  processSessionPayment,
  processOfflineInvoice,
  processPendingPayment,
  generateInvoiceFromOffline,
  getPaymentHistory,
  getPaymentStats,
  processRefund,
  stripeWebhook,
  sendReceiptEmail,
  getPaymentDetails,
  preAuthorizeCharge,
  captureCharge,
  createPaymentIntent 
} from './payments.controller';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil' as const,
  typescript: true,
});

const router = Router();

// Rutas existentes
router.post('/methods', authenticate, addPaymentMethod);
router.get('/methods', authenticate, getPaymentMethods);
router.put('/methods/default/:id', authenticate, setDefaultMethod);
router.delete('/methods/:id', authenticate, deletePaymentMethod);
router.get('/transactions', authenticate, getTransactions);

// === RUTAS PARA FLUJO DE CARGA CON PRE-AUTORIZACIÓN ===
router.post('/pre-authorize', authenticate, preAuthorizeCharge);
router.post('/capture', authenticate, captureCharge);

// Nuevas rutas para pagos reales - TEMPORALMENTE SIN AUTENTICACIÓN PARA PRUEBAS
router.post('/process', authenticate, processSessionPayment);
// Endpoint nuevo para procesar pagos pendientes (facturas offline) - Requiere autenticación
router.post('/process-pending', authenticate, processPendingPayment);
router.post('/process-offline-invoice', authenticate, processOfflineInvoice);
router.post('/generate-from-offline', authenticate, generateInvoiceFromOffline);
router.get('/history', authenticate, getPaymentHistory);
router.get('/stats', authenticate, getPaymentStats);
router.post('/refund', authenticate, processRefund);

// Ruta para crear PaymentIntent
router.post('/create-payment-intent', authenticate, createPaymentIntent);

// Enviar email de boleta
router.post('/send-receipt-email', authenticate, sendReceiptEmail);

// Crear sesión de pago
router.post('/create-session', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Cantidad de pago inválida' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY no está configurada');
      return res.status(500).json({ error: 'Error de configuración de pago' });
    }

    const appUrl = CONFIG.APP_URL || process.env.APP_URL || 'https://server.dkgsolutions.es';
    
    console.log('[Payments] Creando sesión de pago:', {
      amount,
      appUrl,
      successUrl: `${appUrl}/api/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/api/payments/cancel`
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Carga Eléctrica',
            },
            unit_amount: Math.round(amount * 100), // Convertir a centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/api/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/api/payments/cancel`,
    });

    console.log('[Payments] Sesión creada exitosamente:', session.id);
    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating payment session:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Could not create payment session', details: errorMessage });
  }
});

router.get('/payment-details', authenticate, getPaymentDetails);

// Webhook de Stripe (sin autenticación)
router.post('/webhook', stripeWebhook);

// Rutas de redirección después del pago en Stripe
router.get('/success', (req, res) => {
  const sessionId = req.query.session_id as string;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'No session ID provided' });
  }

  // Retornar HTML que cierra la WebView o notifica al cliente
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Pago Exitoso</title>
      </head>
      <body>
        <h1>¡Pago procesado correctamente!</h1>
        <p>Session ID: ${sessionId}</p>
        <script>
          // Notificar a la WebView del cliente
          if (window.parent !== window) {
            window.parent.postMessage({ type: 'success', sessionId: '${sessionId}' }, '*');
          }
        </script>
      </body>
    </html>
  `);
});

router.get('/cancel', (req, res) => {
  // Retornar HTML que notifica al cliente que el pago fue cancelado
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Pago Cancelado</title>
      </head>
      <body>
        <h1>Pago cancelado</h1>
        <p>El pago ha sido cancelado. Puedes intentar nuevamente.</p>
        <script>
          // Notificar a la WebView del cliente
          if (window.parent !== window) {
            window.parent.postMessage({ type: 'cancel' }, '*');
          }
        </script>
      </body>
    </html>
  `);
});

export default router;