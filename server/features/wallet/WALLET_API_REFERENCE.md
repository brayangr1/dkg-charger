## 📱 WALLET API - Referencia Rápida

### Base URL
```
http://localhost:5010/api/wallet
```

### Autenticación
Todas las solicitudes requieren un token JWT en el header:
```
Authorization: Bearer {token}
```

---

## 🔌 Endpoints

### 1. Crear Wallet
**POST** `/api/wallet/create`

**Request Body:**
```json
{
  "userId": "string",
  "initialDeposit": 10.00,
  "paymentMethodId": "string (opcional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet creada exitosamente",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "balance": 10.00,
    "currency": "EUR",
    "nfcToken": "NFC_xxxxx",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 2. Obtener Wallet del Usuario
**GET** `/api/wallet/user/:userId`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "balance": 25.50,
    "currency": "EUR",
    "nfcToken": "NFC_xxxxx",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T11:45:00Z"
  }
}
```

---

### 3. Obtener Wallet por ID
**GET** `/api/wallet/:walletId`

**Response:** (igual que endpoint anterior)

---

### 4. Agregar Fondos
**POST** `/api/wallet/:walletId/add-funds`

**Request Body:**
```json
{
  "amount": 50.00,
  "paymentMethodId": "string (opcional)",
  "description": "string (opcional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Fondos agregados exitosamente",
  "data": {
    "id": "uuid",
    "balance": 75.50,
    "updatedAt": "2024-01-15T12:00:00Z"
  }
}
```

---

### 5. Actualizar Saldo
**PUT** `/api/wallet/:walletId/balance`

**Request Body:**
```json
{
  "amount": 15.00,
  "type": "add | subtract",
  "description": "string (opcional)",
  "referenceId": "string (opcional)"
}
```

**Response:** (igual que agregar fondos)

---

### 6. Obtener Transacciones
**GET** `/api/wallet/:walletId/transactions?limit=50`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "walletId": "uuid",
      "type": "DEPOSIT | CHARGE | REFUND | BONUS",
      "amount": 10.00,
      "description": "Depósito inicial",
      "status": "COMPLETED",
      "referenceId": "string",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### 7. Verificar Saldo Suficiente
**POST** `/api/wallet/:walletId/check-balance`

**Request Body:**
```json
{
  "amount": 15.00
}
```

**Response:**
```json
{
  "success": true,
  "hasSufficientBalance": true
}
```

---

### 8. Obtener Wallet por NFC Token
**GET** `/api/wallet/nfc/:nfcToken`

**Response:** (igual que obtener wallet por ID)

---

### 9. Eliminar Wallet
**DELETE** `/api/wallet/:walletId`

**Response:**
```json
{
  "success": true,
  "message": "Wallet eliminada exitosamente"
}
```

---

## 📊 Tipos de Transacciones

- **DEPOSIT**: Depósito de fondos
- **CHARGE**: Cargo por uso (carga de vehículo)
- **REFUND**: Reembolso
- **BONUS**: Aplicación de bonificación

---

## 🔄 Estados de Transacciones

- **PENDING**: Pendiente de procesar
- **COMPLETED**: Transacción completada
- **FAILED**: Transacción fallida

---

## 💾 Base de Datos

Las tablas siguientes se crean con la migración SQL:

### wallets
- id (VARCHAR 36)
- user_id (VARCHAR 36) - FK: users.id
- balance (DECIMAL 10,2)
- currency (VARCHAR 3)
- nfc_token (VARCHAR 255, UNIQUE)
- created_at, updated_at

### transactions
- id (VARCHAR 36)
- wallet_id (VARCHAR 36) - FK: wallets.id
- type (ENUM)
- amount (DECIMAL 10,2)
- description (VARCHAR 255)
- status (ENUM)
- reference_id (VARCHAR 255)
- created_at

### bonuses
- id (VARCHAR 36)
- wallet_id (VARCHAR 36) - FK: wallets.id
- type (ENUM)
- value (DECIMAL 10,2)
- max_amount (DECIMAL 10,2)
- remaining_uses (INT)
- expiry_date (TIMESTAMP)
- is_active (BOOLEAN)
- created_at, updated_at

### packages
- id (VARCHAR 36)
- wallet_id (VARCHAR 36) - FK: wallets.id
- name (VARCHAR 100)
- type (ENUM)
- total_value (DECIMAL 10,2)
- remaining (DECIMAL 10,2)
- purchase_date, expiry_date (TIMESTAMP)
- is_active (BOOLEAN)
- created_at, updated_at

---

## 🚀 Ejemplos de Uso (Frontend)

```typescript
import walletService from '../services/walletService';

// Crear wallet
const wallet = await walletService.createWallet({
  userId: user.id,
  initialDeposit: 10,
  paymentMethodId: 'stripe_pm_xxx'
});

// Obtener wallet
const userWallet = await walletService.getWallet(userId);

// Agregar fondos
const updated = await walletService.addFunds(walletId, 25);

// Obtener transacciones
const transactions = await walletService.getTransactions(walletId);

// Verificar saldo
const hasBalance = await walletService.hasSufficientBalance(walletId, 15);

// Eliminar wallet
await walletService.deleteWallet(walletId);
```

---

## ⚙️ Archivos Creados

```
server/src/features/wallet/
├── controllers/
│   └── walletController.ts
├── services/
│   └── walletService.ts
├── routes/
│   └── wallet.routes.ts
├── types/
│   └── wallet.types.ts
└── index.ts

server/src/database/
└── migrations/
    └── 001_create_wallet_tables.sql

mobile/services/
├── walletService.ts (actualizado)
└── apiClient.ts (nuevo)
```

---

## ✅ Estado del Proyecto

### Backend
- ✅ Tablas de base de datos creadas
- ✅ Controlador de wallet implementado
- ✅ Servicio de wallet implementado
- ✅ Rutas de wallet registradas
- ✅ Integración en app.ts

### Frontend
- ✅ apiClient.ts con interceptores
- ✅ walletService.ts conectado a APIs
- ✅ Pantallas de UI existentes compatibles
- ✅ Sistema de caché local implementado

---

## 🔐 Seguridad

- ✅ Token JWT requerido en todas las solicitudes
- ✅ Validación de entrada en controllers
- ✅ NFC Token único generado para cada wallet
- ✅ Base de datos con constraints y indexes
- ✅ Fallback a caché local en caso de fallo

---

## 📝 Notas

1. Las transacciones se registran automáticamente al actualizar el saldo
2. El caché local permite funcionamiento offline
3. Los fondos se deducen automáticamente sin pantalla en el cargador
4. Se soportan múltiples métodos de pago (Stripe, etc.)
