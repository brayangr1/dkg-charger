/**
 * Tipos para el módulo de Wallet
 */

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  nfcToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: 'DEPOSIT' | 'CHARGE' | 'REFUND' | 'BONUS';
  amount: number;
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  referenceId?: string;
  createdAt: string;
}

export interface Bonus {
  id: string;
  walletId: string;
  type: 'FREE_CHARGE' | 'DISCOUNT_PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  maxAmount?: number;
  remainingUses: number;
  expiryDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Package {
  id: string;
  walletId: string;
  name: string;
  type: 'PREPAID_KWH' | 'MONTHLY_SUBSCRIPTION';
  totalValue: number;
  remaining: number;
  purchaseDate: string;
  expiryDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWalletRequest {
  userId: string;
  initialDeposit: number;
  paymentMethodId?: string;
}

export interface AddFundsRequest {
  walletId: string;
  amount: number;
  paymentMethodId?: string;
  description?: string;
}

export interface UpdateBalanceRequest {
  walletId: string;
  amount: number;
  type: 'add' | 'subtract';
  description?: string;
  referenceId?: string;
}

export interface RecordTransactionRequest {
  walletId: string;
  type: 'DEPOSIT' | 'CHARGE' | 'REFUND' | 'BONUS';
  amount: number;
  description: string;
  referenceId?: string;
}
