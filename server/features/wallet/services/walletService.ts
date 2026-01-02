import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../database';
import {
  Wallet,
  Transaction,
  CreateWalletRequest,
  AddFundsRequest,
  UpdateBalanceRequest,
  RecordTransactionRequest,
} from '../types/wallet.types';

class WalletService {
  /**
   * Crear una nueva wallet con depósito inicial
   */
  async createWallet(request: CreateWalletRequest): Promise<Wallet> {
    const walletId = uuidv4();
    const now = new Date().toISOString();

    try {
      // Generar token NFC único
      const nfcToken = this.generateNFCToken();

      // Insertar wallet en la base de datos
      const sql = `
        INSERT INTO wallets (id, user_id, balance, currency, nfc_token, created_at, updated_at)
        VALUES (?, ?, ?, 'EUR', ?, ?, ?)
      `;

      await db.query(sql, [
        walletId,
        request.userId,
        request.initialDeposit,
        nfcToken,
        now,
        now,
      ]);

      // Registrar la transacción de depósito inicial
      if (request.initialDeposit > 0) {
        await this.recordTransaction({
          walletId,
          type: 'DEPOSIT',
          amount: request.initialDeposit,
          description: 'Depósito inicial',
        });
      }

      // Retornar la wallet creada
      return {
        id: walletId,
        userId: request.userId,
        balance: request.initialDeposit,
        currency: 'EUR',
        nfcToken,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      console.error('Error creando wallet:', error);
      throw error;
    }
  }

  /**
   * Obtener wallet del usuario
   */
  async getWallet(userId: string): Promise<Wallet | null> {
    try {
      const sql = `
        SELECT 
          id,
          user_id as userId,
          balance,
          currency,
          nfc_token as nfcToken,
          created_at as createdAt,
          updated_at as updatedAt
        FROM wallets
        WHERE user_id = ?
        LIMIT 1
      `;

      const [results] = await db.query<any>(sql, [userId]);

      if (Array.isArray(results) && results.length > 0) {
        return results[0];
      }

      return null;
    } catch (error) {
      console.error('Error obteniendo wallet:', error);
      throw error;
    }
  }

  /**
   * Obtener wallet por ID
   */
  async getWalletById(walletId: string): Promise<Wallet | null> {
    try {
      const sql = `
        SELECT 
          id,
          user_id as userId,
          balance,
          currency,
          nfc_token as nfcToken,
          created_at as createdAt,
          updated_at as updatedAt
        FROM wallets
        WHERE id = ?
        LIMIT 1
      `;

      const [results] = await db.query<any>(sql, [walletId]);

      if (Array.isArray(results) && results.length > 0) {
        return results[0];
      }

      return null;
    } catch (error) {
      console.error('Error obteniendo wallet por ID:', error);
      throw error;
    }
  }

  /**
   * Obtener wallet por NFC Token
   */
  async getWalletByNFCToken(nfcToken: string): Promise<Wallet | null> {
    try {
      const sql = `
        SELECT 
          id,
          user_id as userId,
          balance,
          currency,
          nfc_token as nfcToken,
          created_at as createdAt,
          updated_at as updatedAt
        FROM wallets
        WHERE nfc_token = ?
        LIMIT 1
      `;

      const [results] = await db.query<any>(sql, [nfcToken]);

      if (Array.isArray(results) && results.length > 0) {
        return results[0];
      }

      return null;
    } catch (error) {
      console.error('Error obteniendo wallet por NFC token:', error);
      throw error;
    }
  }

  /**
   * Registrar una transacción
   */
  async recordTransaction(request: RecordTransactionRequest): Promise<Transaction> {
    const transactionId = uuidv4();
    const now = new Date().toISOString();

    try {
      const sql = `
        INSERT INTO transactions (id, wallet_id, type, amount, description, status, reference_id, created_at)
        VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?)
      `;

      await db.query(sql, [
        transactionId,
        request.walletId,
        request.type,
        request.amount,
        request.description,
        request.referenceId || null,
        now,
      ]);

      return {
        id: transactionId,
        walletId: request.walletId,
        type: request.type,
        amount: request.amount,
        description: request.description,
        status: 'COMPLETED',
        referenceId: request.referenceId,
        createdAt: now,
      };
    } catch (error) {
      console.error('Error registrando transacción:', error);
      throw error;
    }
  }

  /**
   * Obtener transacciones de una wallet
   */
  async getTransactions(walletId: string, limit: number = 50): Promise<Transaction[]> {
    try {
      const sql = `
        SELECT 
          id,
          wallet_id as walletId,
          type,
          amount,
          description,
          status,
          reference_id as referenceId,
          created_at as createdAt
        FROM transactions
        WHERE wallet_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `;

      const [results] = await db.query<any>(sql, [walletId, limit]);

      return Array.isArray(results) ? results : [];
    } catch (error) {
      console.error('Error obteniendo transacciones:', error);
      throw error;
    }
  }

  /**
   * Actualizar saldo de la wallet
   */
  async updateBalance(request: UpdateBalanceRequest): Promise<Wallet> {
    try {
      // Obtener wallet actual
      const wallet = await this.getWalletById(request.walletId);
      if (!wallet) {
        throw new Error('Wallet no encontrada');
      }

      // Calcular nuevo saldo
      const newBalance =
        request.type === 'add'
          ? wallet.balance + request.amount
          : Math.max(0, wallet.balance - request.amount);

      // Actualizar balance en la base de datos
      const sql = `
        UPDATE wallets
        SET balance = ?, updated_at = ?
        WHERE id = ?
      `;

      const now = new Date().toISOString();
      await db.query(sql, [newBalance, now, request.walletId]);

      // Registrar la transacción
      await this.recordTransaction({
        walletId: request.walletId,
        type:
          request.type === 'add' && request.amount > 0 ? 'DEPOSIT' : 'CHARGE',
        amount: request.amount,
        description: request.description || `Saldo ${request.type === 'add' ? 'agregado' : 'deducido'}`,
        referenceId: request.referenceId,
      });

      // Retornar wallet actualizada
      return {
        ...wallet,
        balance: newBalance,
        updatedAt: now,
      };
    } catch (error) {
      console.error('Error actualizando balance:', error);
      throw error;
    }
  }

  /**
   * Agregar fondos a la wallet
   */
  async addFunds(request: AddFundsRequest): Promise<Wallet> {
    try {
      return await this.updateBalance({
        walletId: request.walletId,
        amount: request.amount,
        type: 'add',
        description: request.description || 'Fondos agregados',
        referenceId: request.paymentMethodId,
      });
    } catch (error) {
      console.error('Error agregando fondos:', error);
      throw error;
    }
  }

  /**
   * Deducir fondos de la wallet (para cargas)
   */
  async deductFunds(
    walletId: string,
    amount: number,
    description: string,
    referenceId?: string
  ): Promise<Wallet> {
    try {
      return await this.updateBalance({
        walletId,
        amount,
        type: 'subtract',
        description,
        referenceId,
      });
    } catch (error) {
      console.error('Error deduciendo fondos:', error);
      throw error;
    }
  }

  /**
   * Eliminar wallet del usuario
   */
  async deleteWallet(walletId: string): Promise<void> {
    try {
      const sql = 'DELETE FROM wallets WHERE id = ?';
      await db.query(sql, [walletId]);
    } catch (error) {
      console.error('Error eliminando wallet:', error);
      throw error;
    }
  }

  /**
   * Verificar si hay saldo suficiente
   */
  async hasSufficientBalance(walletId: string, amount: number): Promise<boolean> {
    try {
      const wallet = await this.getWalletById(walletId);
      if (!wallet) {
        return false;
      }
      return wallet.balance >= amount;
    } catch (error) {
      console.error('Error verificando balance:', error);
      return false;
    }
  }

  /**
   * Generar token NFC único
   */
  private generateNFCToken(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `NFC_${timestamp}_${randomStr}`.toUpperCase();
  }
}

export const walletService = new WalletService();
