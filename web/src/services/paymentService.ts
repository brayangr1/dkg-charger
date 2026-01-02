import { apiClient } from './apiClient';

const API_PATH = '/api/payments';

// Types
export interface PaymentMethod {
    id: string;
    userId: number;
    type: 'card';
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
    stripePaymentMethodId: string;
    createdAt: string;
}

export interface PaymentRequest {
    amount: number;
    paymentMethodId: string;
    description: string;
    metadata?: any;
}

export interface PaymentReceipt {
    id: string;
    paymentId: string;
    amount: number;
    currency: string;
    status: 'succeeded' | 'failed' | 'pending';
    paymentMethod: string;
    description: string;
    createdAt: string;
    metadata?: any;
}

// Get all payment methods for user
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
    try {
        const response = await apiClient.get(`${API_PATH}/methods`);
        const data: any = response.data;
        // Ajustar la estructura de datos para que coincida con la respuesta del servidor
        if (data.methods) {
            return data.methods.map((method: any) => ({
                id: method.id,
                userId: method.user_id,
                type: method.type,
                brand: method.card_brand,
                last4: method.last4,
                expMonth: method.exp_month,
                expYear: method.exp_year,
                isDefault: method.is_default === 1,
                stripePaymentMethodId: method.stripe_payment_method_id,
                createdAt: method.created_at
            }));
        }
        return [];
    } catch (error) {
        console.error('Error getting payment methods:', error);
        return [];
    }
};

// Add new payment method
export const addPaymentMethod = async (stripeToken: string, email?: string): Promise<PaymentMethod> => {
    try {
        const response = await apiClient.post(`${API_PATH}/methods`, {
            source: stripeToken,
            email: email
        });
        const data: any = response.data;
        return data.paymentMethod;
    } catch (error) {
        console.error('Error adding card:', error);
        throw error;
    }
};

// Simulate adding a payment method when Stripe is not configured
export const addMockPaymentMethod = async (cardData: {
    cardNumber: string;
    expMonth: number;
    expYear: number;
    cvc: string;
}, email?: string): Promise<PaymentMethod> => {
    try {
        const response = await apiClient.post(`${API_PATH}/methods`, {
            ...cardData,
            email: email
        });
        const data: any = response.data;
        return data.paymentMethod;
    } catch (error) {
        console.error('Error adding mock card:', error);
        throw error;
    }
};

// Set default payment method
export const setDefaultPaymentMethod = async (methodId: string): Promise<boolean> => {
    try {
        // Corregir la ruta para coincidir con la definida en el backend
        const response = await apiClient.put(`${API_PATH}/methods/default/${methodId}`);
        const data: any = response.data;
        return data.success || false;
    } catch (error) {
        console.error('Error setting default payment method:', error);
        return false;
    }
};

// Delete payment method
export const deletePaymentMethod = async (methodId: string): Promise<boolean> => {
    try {
        const response = await apiClient.delete(`${API_PATH}/methods/${methodId}`);
        const data: any = response.data;
        return data.success || false;
    } catch (error) {
        console.error('Error deleting payment method:', error);
        return false;
    }
};

// Process payment
export const processPayment = async (data: PaymentRequest): Promise<any> => {
    const response = await apiClient.post(`${API_PATH}/process`, data);
    return response.data;
};

// Get payment receipt
export const getReceipt = async (paymentId: string): Promise<PaymentReceipt> => {
    const response = await apiClient.get(`${API_PATH}/receipt/${paymentId}`);
    const data: any = response.data;
    return data.receipt;
};

// Get payment history
export const getPaymentHistory = async (filters?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}): Promise<any[]> => {
    const response = await apiClient.get(`${API_PATH}/history`, {
        params: filters
    });
    const data: any = response.data;
    return data.history || [];
};

// Pre-authorize payment
export const preAuthorizePayment = async (amount: number, paymentMethodId: string): Promise<any> => {
    try {
        const response = await apiClient.post(`${API_PATH}/pre-authorize`, {
            amount,
            paymentMethodId
        });
        return response.data;
    } catch (error) {
        console.error('Error pre-authorizing payment:', error);
        throw error;
    }
};

const paymentService = {
    getPaymentMethods,
    addPaymentMethod,
    addMockPaymentMethod,
    setDefaultPaymentMethod,
    deletePaymentMethod,
    processPayment,
    getReceipt,
    getPaymentHistory,
    preAuthorizePayment
};

export interface ReceiptData {
    isOffline: any;
    offlineInvoice: any;
    id: number;
    user_id: number;
    charger_id: number;
    session_id: number;
    amount: string;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    payment_method_id: string;
    transaction_id: string;
    invoice_number: string;
    created_at: string;
    updated_at: string;
    charger_name: string;
    serial_number: string;
    start_time: string;
    end_time: string;
    total_energy: string;
    card_brand: string;
    last4: string;
}

export default paymentService;