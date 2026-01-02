import { apiClient } from './apiClient';

const API_PATH = '/api/invitations';

export interface Invitation {
    id: number;
    guest_email: string;
    access_level: 'admin' | 'user';
    status: 'pending' | 'accepted' | 'expired';
    created_at: string;
    charger_id: number;
    charger_name?: string;
}

export interface GuestUser {
    id: number;
    email: string;
    alias?: string;
    firstName?: string;
    lastName?: string;
    chargerName: string;
    serial: string;
    status: string;
    isBlocked?: boolean;
    ratePerKwh?: number;
    energyLimit?: number;
    monthlyEnergyUsed?: number;
    monthlyEnergyAccumulated?: number;
    monthlyCostAccumulated?: number;
    totalEnergy?: number;
    totalCost?: number;
    acceptedAt?: string;
}

export const getInvitations = async (): Promise<{ invitations: Invitation[] }> => {
    const response = await apiClient.get(API_PATH);
    return response.data as { invitations: Invitation[] };
};

export const sendInvitation = async (email: string, chargerId: number, accessLevel: 'admin' | 'user'): Promise<{ success: boolean; message?: string }> => {
    const response = await apiClient.post(`${API_PATH}/send`, {
        email,
        chargerId,
        accessLevel
    });
    return response.data as { success: boolean; message?: string };
};

export const cancelInvitation = async (invitationId: number): Promise<{ success: boolean }> => {
    const response = await apiClient.delete(`${API_PATH}/${invitationId}`);
    return response.data as { success: boolean };
};

export const validateInvitationToken = async (token: string): Promise<{ success: boolean; invitation?: any; error?: string }> => {
    const response = await apiClient.get(`${API_PATH}/validate-token?token=${token}`);
    return response.data as { success: boolean; invitation?: any; error?: string };
};

// Guest Management
export const getGuests = async (): Promise<{ guests: GuestUser[] }> => {
    const response = await apiClient.get(`${API_PATH}/my-invited-users`);
    return response.data as { guests: GuestUser[] };
};

export const updateGuest = async (serial: string, userId: number, data: Partial<GuestUser>) => {
    const response = await apiClient.put(`${API_PATH}/chargers/${serial}/update-user/${userId}`, data);
    return response.data;
};

export const blockGuest = async (serial: string, userId: number) => {
    const response = await apiClient.put(`${API_PATH}/${serial}/block-user/${userId}`);
    return response.data;
};

export const unblockGuest = async (serial: string, userId: number) => {
    const response = await apiClient.put(`${API_PATH}/chargers/${serial}/unblock-user/${userId}`);
    return response.data;
};

export const removeGuest = async (serial: string, userId: number) => {
    const response = await apiClient.delete(`${API_PATH}/chargers/${serial}/remove-user/${userId}`);
    return response.data;
};

export const resetEnergyLimit = async (serial: string, userId: number) => {
    const response = await apiClient.put(`${API_PATH}/chargers/${serial}/reset-energy-limit/${userId}`);
    return response.data;
};

export const acceptInvitation = async (token: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiClient.post(`${API_PATH}/accept`, { token });
    return response.data as { success: boolean; message?: string; error?: string };
};
