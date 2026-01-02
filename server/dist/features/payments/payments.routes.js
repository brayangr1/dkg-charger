"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const payments_controller_1 = require("./payments.controller");
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-05-28.basil',
    typescript: true,
});
const router = (0, express_1.Router)();
// Rutas existentes
router.post('/methods', auth_1.authenticate, payments_controller_1.addPaymentMethod);
router.get('/methods', auth_1.authenticate, payments_controller_1.getPaymentMethods);
router.put('/methods/default/:id', auth_1.authenticate, payments_controller_1.setDefaultMethod);
router.delete('/methods/:id', auth_1.authenticate, payments_controller_1.deletePaymentMethod);
router.get('/transactions', auth_1.authenticate, payments_controller_1.getTransactions);
// === RUTAS PARA FLUJO DE CARGA CON PRE-AUTORIZACIÓN ===
router.post('/pre-authorize', auth_1.authenticate, payments_controller_1.preAuthorizeCharge);
router.post('/capture', auth_1.authenticate, payments_controller_1.captureCharge);
// Nuevas rutas para pagos reales - TEMPORALMENTE SIN AUTENTICACIÓN PARA PRUEBAS
router.post('/process', auth_1.authenticate, payments_controller_1.processSessionPayment);
// Endpoint nuevo para procesar pagos pendientes (facturas offline) - Requiere autenticación
router.post('/process-pending', auth_1.authenticate, payments_controller_1.processPendingPayment);
router.post('/process-offline-invoice', auth_1.authenticate, payments_controller_1.processOfflineInvoice);
router.post('/generate-from-offline', auth_1.authenticate, payments_controller_1.generateInvoiceFromOffline);
router.get('/history', auth_1.authenticate, payments_controller_1.getPaymentHistory);
router.get('/stats', auth_1.authenticate, payments_controller_1.getPaymentStats);
router.post('/refund', auth_1.authenticate, payments_controller_1.processRefund);
// Enviar email de boleta
router.post('/send-receipt-email', auth_1.authenticate, payments_controller_1.sendReceiptEmail);
// Crear sesión de pago
router.post('/create-session', auth_1.authenticate, async (req, res) => {
    try {
        const { amount } = req.body;
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
            success_url: `${process.env.APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.APP_URL}/payment/cancel`,
        });
        res.json({ sessionId: session.id });
    }
    catch (error) {
        console.error('Error creating payment session:', error);
        res.status(500).json({ error: 'Could not create payment session' });
    }
});
router.get('/payment-details', auth_1.authenticate, payments_controller_1.getPaymentDetails);
// Webhook de Stripe (sin autenticación)
router.post('/webhook', payments_controller_1.stripeWebhook);
exports.default = router;
