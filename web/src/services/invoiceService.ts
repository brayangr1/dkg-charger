import { apiClient } from './apiClient';

const API_PATH = '/api/invoices';

// Types
export interface Invoice {
    id: string;
    userId: number;
    invoiceNumber: string;
    amount: number;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled';
    dueDate: string;
    issueDate: string;
    lineItems: LineItem[];
    subtotal: number;
    tax: number;
    total: number;
    paidAt?: string;
    metadata?: any;
}

export interface LineItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface OfflineInvoice {
    id: string;
    sessionId: string;
    userId: number;
    chargerId: number;
    energyConsumed: number;
    cost: number;
    status: 'pending' | 'synced' | 'paid';
    createdAt: string;
    syncedAt?: string;
    paidAt?: string;
}

// Get pending invoices
export const getPendingInvoices = async (): Promise<Invoice[]> => {
    const response = await apiClient.get(`${API_PATH}/pending`);
    const data: any = response.data;
    return data.invoices || [];
};

// Get offline invoices
export const getOfflineInvoices = async (): Promise<OfflineInvoice[]> => {
    const response = await apiClient.get(`${API_PATH}/offline`);
    const data: any = response.data;
    return data.invoices || [];
};

// Get invoice details
export const getInvoiceDetails = async (invoiceId: string): Promise<Invoice> => {
    const response = await apiClient.get(`${API_PATH}/${invoiceId}`);
    const data: any = response.data;
    return data.invoice;
};

// Get offline invoice details
export const getOfflineInvoiceDetails = async (invoiceId: string): Promise<OfflineInvoice> => {
    const response = await apiClient.get(`${API_PATH}/offline/${invoiceId}`);
    const data: any = response.data;
    return data.invoice;
};

// Pay invoice
export const payInvoice = async (invoiceId: string, paymentMethodId: string): Promise<boolean> => {
    const response = await apiClient.post(`${API_PATH}/${invoiceId}/pay`, {
        paymentMethodId
    });
    const data: any = response.data;
    return data.success;
};

// Download invoice PDF
export const downloadInvoicePDF = async (invoiceId: string): Promise<Blob> => {
    const response = await apiClient.get(`${API_PATH}/${invoiceId}/pdf`, {
        responseType: 'blob'
    });
    return response.data as Blob;
};

const invoiceService = {
    getPendingInvoices,
    getOfflineInvoices,
    getInvoiceDetails,
    getOfflineInvoiceDetails,
    payInvoice,
    downloadInvoicePDF
};

export default invoiceService;
