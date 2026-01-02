import { Router } from 'express';
import { walletController } from '../controllers/walletController';

const router = Router();

/**
 * Rutas del módulo de Wallet
 * Base path: /api/wallet
 */

// Crear wallet
router.post('/create', (req, res) => walletController.createWallet(req, res));

// Obtener wallet del usuario
router.get('/user/:userId', (req, res) => walletController.getWallet(req, res));

// Obtener wallet por ID
router.get('/:walletId', (req, res) => walletController.getWalletById(req, res));

// Obtener wallet por NFC Token
router.get('/nfc/:nfcToken', (req, res) =>
  walletController.getWalletByNFCToken(req, res)
);

// Agregar fondos
router.post('/:walletId/add-funds', (req, res) =>
  walletController.addFunds(req, res)
);

// Actualizar saldo
router.put('/:walletId/balance', (req, res) =>
  walletController.updateBalance(req, res)
);

// Obtener transacciones
router.get('/:walletId/transactions', (req, res) =>
  walletController.getTransactions(req, res)
);

// Verificar saldo suficiente
router.post('/:walletId/check-balance', (req, res) =>
  walletController.checkBalance(req, res)
);

// Eliminar wallet
router.delete('/:walletId', (req, res) =>
  walletController.deleteWallet(req, res)
);

export default router;
