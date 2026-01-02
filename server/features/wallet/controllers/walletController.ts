import { Request, Response } from 'express';
import { walletService } from '../services/walletService';
import {
  CreateWalletRequest,
  AddFundsRequest,
  UpdateBalanceRequest,
} from '../types/wallet.types';

class WalletController {
  /**
   * Crear una nueva wallet
   * POST /api/wallet/create
   */
  async createWallet(req: Request, res: Response): Promise<void> {
    try {
      const { userId, initialDeposit, paymentMethodId } = req.body;

      // Validar datos requeridos
      if (!userId) {
        res.status(400).json({ error: 'userId es requerido' });
        return;
      }

      if (initialDeposit === undefined || initialDeposit <= 0) {
        res.status(400).json({ error: 'initialDeposit debe ser mayor a 0' });
        return;
      }

      // Verificar si el usuario ya tiene una wallet
      const existingWallet = await walletService.getWallet(userId);
      if (existingWallet) {
        res.status(409).json({ error: 'El usuario ya tiene una wallet' });
        return;
      }

      const request: CreateWalletRequest = {
        userId,
        initialDeposit,
        paymentMethodId,
      };

      const wallet = await walletService.createWallet(request);

      res.status(201).json({
        success: true,
        message: 'Wallet creada exitosamente',
        data: wallet,
      });
    } catch (error) {
      console.error('Error en createWallet:', error);
      res.status(500).json({
        error: 'Error al crear la wallet',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Obtener wallet del usuario
   * GET /api/wallet/user/:userId
   */
  async getWallet(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({ error: 'userId es requerido' });
        return;
      }

      const wallet = await walletService.getWallet(userId);

      if (!wallet) {
        res.status(404).json({ error: 'Wallet no encontrada' });
        return;
      }

      res.status(200).json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      console.error('Error en getWallet:', error);
      res.status(500).json({
        error: 'Error al obtener la wallet',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Obtener wallet por ID
   * GET /api/wallet/:walletId
   */
  async getWalletById(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;

      if (!walletId) {
        res.status(400).json({ error: 'walletId es requerido' });
        return;
      }

      const wallet = await walletService.getWalletById(walletId);

      if (!wallet) {
        res.status(404).json({ error: 'Wallet no encontrada' });
        return;
      }

      res.status(200).json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      console.error('Error en getWalletById:', error);
      res.status(500).json({
        error: 'Error al obtener la wallet',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Agregar fondos a la wallet
   * POST /api/wallet/:walletId/add-funds
   */
  async addFunds(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const { amount, paymentMethodId, description } = req.body;

      if (!walletId) {
        res.status(400).json({ error: 'walletId es requerido' });
        return;
      }

      if (!amount || amount <= 0) {
        res.status(400).json({ error: 'amount debe ser mayor a 0' });
        return;
      }

      // Verificar que la wallet existe
      const wallet = await walletService.getWalletById(walletId);
      if (!wallet) {
        res.status(404).json({ error: 'Wallet no encontrada' });
        return;
      }

      const request: AddFundsRequest = {
        walletId,
        amount,
        paymentMethodId,
        description,
      };

      const updatedWallet = await walletService.addFunds(request);

      res.status(200).json({
        success: true,
        message: 'Fondos agregados exitosamente',
        data: updatedWallet,
      });
    } catch (error) {
      console.error('Error en addFunds:', error);
      res.status(500).json({
        error: 'Error al agregar fondos',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Actualizar saldo de la wallet
   * PUT /api/wallet/:walletId/balance
   */
  async updateBalance(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const { amount, type, description, referenceId } = req.body;

      if (!walletId) {
        res.status(400).json({ error: 'walletId es requerido' });
        return;
      }

      if (!amount || amount <= 0) {
        res.status(400).json({ error: 'amount debe ser mayor a 0' });
        return;
      }

      if (type !== 'add' && type !== 'subtract') {
        res.status(400).json({ error: 'type debe ser "add" o "subtract"' });
        return;
      }

      // Verificar que la wallet existe
      const wallet = await walletService.getWalletById(walletId);
      if (!wallet) {
        res.status(404).json({ error: 'Wallet no encontrada' });
        return;
      }

      const request: UpdateBalanceRequest = {
        walletId,
        amount,
        type,
        description,
        referenceId,
      };

      const updatedWallet = await walletService.updateBalance(request);

      res.status(200).json({
        success: true,
        message: 'Saldo actualizado exitosamente',
        data: updatedWallet,
      });
    } catch (error) {
      console.error('Error en updateBalance:', error);
      res.status(500).json({
        error: 'Error al actualizar el saldo',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Obtener transacciones de una wallet
   * GET /api/wallet/:walletId/transactions
   */
  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const { limit = 50 } = req.query;

      if (!walletId) {
        res.status(400).json({ error: 'walletId es requerido' });
        return;
      }

      // Verificar que la wallet existe
      const wallet = await walletService.getWalletById(walletId);
      if (!wallet) {
        res.status(404).json({ error: 'Wallet no encontrada' });
        return;
      }

      const transactions = await walletService.getTransactions(
        walletId,
        parseInt(limit as string) || 50
      );

      res.status(200).json({
        success: true,
        data: transactions,
      });
    } catch (error) {
      console.error('Error en getTransactions:', error);
      res.status(500).json({
        error: 'Error al obtener transacciones',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Eliminar wallet
   * DELETE /api/wallet/:walletId
   */
  async deleteWallet(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;

      if (!walletId) {
        res.status(400).json({ error: 'walletId es requerido' });
        return;
      }

      // Verificar que la wallet existe
      const wallet = await walletService.getWalletById(walletId);
      if (!wallet) {
        res.status(404).json({ error: 'Wallet no encontrada' });
        return;
      }

      await walletService.deleteWallet(walletId);

      res.status(200).json({
        success: true,
        message: 'Wallet eliminada exitosamente',
      });
    } catch (error) {
      console.error('Error en deleteWallet:', error);
      res.status(500).json({
        error: 'Error al eliminar la wallet',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Verificar saldo suficiente
   * POST /api/wallet/:walletId/check-balance
   */
  async checkBalance(req: Request, res: Response): Promise<void> {
    try {
      const { walletId } = req.params;
      const { amount } = req.body;

      if (!walletId) {
        res.status(400).json({ error: 'walletId es requerido' });
        return;
      }

      if (!amount || amount <= 0) {
        res.status(400).json({ error: 'amount debe ser mayor a 0' });
        return;
      }

      const hasSufficientBalance = await walletService.hasSufficientBalance(
        walletId,
        amount
      );

      res.status(200).json({
        success: true,
        hasSufficientBalance,
      });
    } catch (error) {
      console.error('Error en checkBalance:', error);
      res.status(500).json({
        error: 'Error al verificar el saldo',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Obtener wallet por NFC Token
   * GET /api/wallet/nfc/:nfcToken
   */
  async getWalletByNFCToken(req: Request, res: Response): Promise<void> {
    try {
      const { nfcToken } = req.params;

      if (!nfcToken) {
        res.status(400).json({ error: 'nfcToken es requerido' });
        return;
      }

      const wallet = await walletService.getWalletByNFCToken(nfcToken);

      if (!wallet) {
        res.status(404).json({ error: 'Wallet no encontrada' });
        return;
      }

      res.status(200).json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      console.error('Error en getWalletByNFCToken:', error);
      res.status(500).json({
        error: 'Error al obtener la wallet',
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }
}

export const walletController = new WalletController();
