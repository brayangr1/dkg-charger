import { apiClient } from './apiClient';

const API_PATH = '/api/support';

export interface SupportTicketPayload {
    subject: string;
    type: 'general' | 'billing' | 'payment' | 'technical';
    description: string;
}

export const sendSupportTicket = async (payload: SupportTicketPayload): Promise<{ success: boolean; message?: string; error?: string }> => {
    try {
        const response = await apiClient.post(`${API_PATH}/send-ticket`, payload);
        const data: any = response.data;
        return { success: true, message: data.message };
    } catch (error: any) {
        const message = error.response?.data?.error || error.message || 'Error desconocido al enviar ticket';
        console.error('Error sending support ticket:', message);
        return { success: false, error: message };
    }
};

const supportService = {
    sendSupportTicket
};

export default supportService;
