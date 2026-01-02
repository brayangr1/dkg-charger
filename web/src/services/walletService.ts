import { apiClient } from './apiClient';

const API_PATH = '/api/wallet';

// Types
export interface Wallet {
    id: string;
    userId: number;
    balance: number;
    nfcToken?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Transaction {
    id: string;
    walletId: string;
    type: 'DEPOSIT' | 'CHARGE' | 'REFUND';
    amount: number;
    description: string;
    createdAt: string;
    metadata?: any;
}

export interface AddFundsRequest {
    walletId: string;
    amount: number;
    paymentMethodId: string;
}

// Get user's wallet
export const getWallet = async (userId: number): Promise<Wallet | null> => {
    try {
        const response = await apiClient.get(`${API_PATH}/user/${userId}`);
        const data: any = response.data;
        return data.wallet || null;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
};

// Create new wallet
export const createWallet = async (userId: number): Promise<Wallet> => {
    const response = await apiClient.post(`${API_PATH}/create`, { userId });
    const data: any = response.data;
    return data.wallet;
};

// Delete wallet
export const deleteWallet = async (walletId: string): Promise<boolean> => {
    const response = await apiClient.delete(`${API_PATH}/${walletId}`);
    const data: any = response.data;
    return data.success;
};

// Add funds to wallet
export const addFunds = async (data: AddFundsRequest): Promise<Transaction> => {
    const response = await apiClient.post(`${API_PATH}/add-funds`, data);
    const responseData: any = response.data;
    return responseData.transaction;
};

// Get wallet transactions
export const getTransactions = async (
    walletId: string,
    filters?: {
        type?: 'DEPOSIT' | 'CHARGE' | 'REFUND';
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
    }
): Promise<Transaction[]> => {
    const response = await apiClient.get(`${API_PATH}/${walletId}/transactions`, {
        params: filters
    });
    const data: any = response.data;
    return data.transactions || [];
};

// Get wallet balance
export const getBalance = async (walletId: string): Promise<number> => {
    const response = await apiClient.get(`${API_PATH}/${walletId}/balance`);
    const data: any = response.data;
    return data.balance || 0;
};

const walletService = {
    getWallet,
    createWallet,
    deleteWallet,
    addFunds,
    getTransactions,
    getBalance
};

export default walletService;
