# 🏦 CONFIGURACIÓN DE STRIPE PARA PAGOS REALES

## 📋 Requisitos Previos

1. **Cuenta de Stripe**: Crear cuenta en [stripe.com](https://stripe.com)
2. **Verificación de cuenta**: Completar verificación de identidad
3. **Dominio verificado**: Para webhooks en producción

## 🔧 Configuración del Servidor

### 1. Variables de Entorno

Agregar al archivo `.env` del servidor:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # Clave secreta de prueba
STRIPE_PUBLISHABLE_KEY=pk_test_... # Clave pública de prueba
STRIPE_WEBHOOK_SECRET=whsec_... # Secreto del webhook

# Para producción:
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_PUBLISHABLE_KEY=pk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Obtener Claves de Stripe

1. **Dashboard de Stripe** → Developers → API keys
2. **Test keys** para desarrollo
3. **Live keys** para producción

### 3. Configurar Webhook

1. **Dashboard de Stripe** → Developers → Webhooks
2. **Add endpoint**: `https://tu-dominio.com/api/payments/webhook`
3. **Events to send**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
4. **Copy webhook secret** al `.env`

## 💳 Tarjetas de Prueba

### Tarjetas Válidas (Test)
- **Visa**: `4242424242424242`
- **Mastercard**: `5555555555554444`
- **American Express**: `378282246310005`

### Tarjetas que Fallan (Test)
- **Declined**: `4000000000000002`
- **Insufficient funds**: `4000000000009995`
- **Expired card**: `4000000000000069`

### Códigos de Seguridad
- **CVC**: Cualquier 3 dígitos (ej: `123`)
- **Fecha**: Cualquier fecha futura (ej: `12/25`)

## 🚀 Implementación en la App

### 1. Configurar Stripe en React Native

```bash
npm install @stripe/stripe-react-native
```

### 2. Inicializar Stripe

```typescript
// App.tsx
import { StripeProvider } from '@stripe/stripe-react-native';

export default function App() {
  return (
    <StripeProvider publishableKey="pk_test_...">
      {/* Tu app */}
    </StripeProvider>
  );
}
```

### 3. Crear Payment Sheet

```typescript
import { useStripe } from '@stripe/stripe-react-native';

const PaymentScreen = () => {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const handlePayment = async () => {
    // 1. Crear PaymentIntent en el servidor
    const response = await fetch('/api/payments/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, currency: 'eur' })
    });
    
    const { clientSecret } = await response.json();

    // 2. Inicializar Payment Sheet
    const { error } = await initPaymentSheet({
      clientSecret,
      merchantDisplayName: 'Charger App',
    });

    if (error) {
      console.error('Error:', error);
      return;
    }

    // 3. Presentar Payment Sheet
    const { error: presentError } = await presentPaymentSheet();
    
    if (presentError) {
      console.error('Error:', presentError);
    } else {
      console.log('Pago exitoso!');
    }
  };
};
```

## 🔄 Flujo de Pago Completo

### 1. Usuario Finaliza Carga
```typescript
// ChargingScreen.tsx
const handleSessionComplete = async () => {
  try {
    // Procesar pago automáticamente
    const result = await processSessionPayment(
      sessionId,
      totalCost,
      'EUR'
    );

    if (result.success) {
      // Mostrar recibo
      setShowReceipt(true);
      setPaymentData(result.payment);
    } else {
      Alert.alert('Error', result.error);
    }
  } catch (error) {
    Alert.alert('Error', 'No se pudo procesar el pago');
  }
};
```

### 2. Servidor Procesa Pago
```typescript
// payments.service.ts
export const processPayment = async (paymentData) => {
  // 1. Verificar método de pago predeterminado
  // 2. Crear PaymentIntent en Stripe
  // 3. Confirmar pago automáticamente
  // 4. Guardar en base de datos
  // 5. Generar factura
};
```

### 3. Webhook Confirma Pago
```typescript
// payments.controller.ts
export const stripeWebhook = async (req, res) => {
  // 1. Verificar firma del webhook
  // 2. Procesar evento
  // 3. Actualizar estado en BD
  // 4. Enviar notificación al usuario
};
```

## 📊 Monitoreo y Reportes

### 1. Dashboard de Stripe
- **Payments**: Ver todos los pagos
- **Customers**: Gestión de clientes
- **Disputes**: Manejo de disputas
- **Reports**: Reportes financieros

### 2. Logs del Servidor
```typescript
// Logging de pagos
console.log('💳 Pago procesado:', {
  userId: paymentData.userId,
  amount: paymentData.amount,
  status: result.status,
  transactionId: result.transactionId
});
```

### 3. Base de Datos
```sql
-- Consultar pagos
SELECT 
  p.*,
  u.email,
  c.name as charger_name,
  cs.total_energy
FROM payments p
JOIN users u ON p.user_id = u.id
JOIN chargers c ON p.charger_id = c.id
JOIN charging_sessions cs ON p.session_id = cs.id
ORDER BY p.created_at DESC;
```

## 🛡️ Seguridad

### 1. Validaciones
- ✅ Verificar monto antes del pago
- ✅ Validar sesión de carga
- ✅ Verificar método de pago
- ✅ Confirmar webhook signature

### 2. Manejo de Errores
```typescript
// Errores comunes de Stripe
const handleStripeError = (error) => {
  switch (error.code) {
    case 'card_declined':
      return 'Tarjeta rechazada';
    case 'insufficient_funds':
      return 'Fondos insuficientes';
    case 'expired_card':
      return 'Tarjeta expirada';
    default:
      return 'Error en el pago';
  }
};
```

### 3. Reembolsos
```typescript
// Procesar reembolso
export const processRefund = async (paymentId, amount) => {
  const refund = await stripe.refunds.create({
    payment_intent: payment.transaction_id,
    amount: amount * 100 // Convertir a centavos
  });
};
```

## 🧪 Testing

### 1. Script de Prueba
```bash
# Probar pago real
node scripts/test-real-payment.js

# Limpiar datos de prueba
node scripts/test-real-payment.js --cleanup
```

### 2. Simulador de Stripe
- **Dashboard** → Developers → Payment Intents
- **Create test payment**
- **Simulate webhook events**

### 3. Logs de Desarrollo
```bash
# Ver logs de Stripe
stripe logs tail

# Ver webhooks
stripe listen --forward-to localhost:5000/api/payments/webhook
```

## 📱 Integración en la App Móvil

### 1. Pantalla de Historial
- Lista de pagos realizados
- Estado de cada pago
- Detalles de facturación

### 2. Recibo Digital
- Generar PDF del recibo
- Compartir por email/WhatsApp
- Descargar para archivo

### 3. Notificaciones
- Confirmación de pago exitoso
- Error en el pago
- Reembolso procesado

## 🚀 Pasos para Producción

1. **Cambiar a claves Live**
2. **Configurar webhook en producción**
3. **Verificar dominio SSL**
4. **Configurar notificaciones**
5. **Probar con montos pequeños**
6. **Monitorear logs y errores**

## 📞 Soporte

- **Stripe Support**: [support.stripe.com](https://support.stripe.com)
- **Documentación**: [stripe.com/docs](https://stripe.com/docs)
- **Comunidad**: [stripe.com/community](https://stripe.com/community) 