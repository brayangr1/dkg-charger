import { apiClient } from './apiClient';
import { getToken } from './authService';
import { url_global } from '@constants/config';

//const API_PATH = `${url_global}/api/`;

// Types
export interface ChargerSettings {
    name: string;
    network?: {
        wifiSSID?: string;
        wifiPassword?: string;
    };
    lighting: {
        standby: { color: string; enabled: boolean };
        charging: { color: string; enabled: boolean };
        locked: { color: string; enabled: boolean };
    };
    lockMethods: {
        app: boolean;
        nfc: boolean;
        bluetooth: boolean;
    };
}

// Charger Details
export const getChargerDetails = async (chargerId: number) => {
    try {
        const response = await apiClient.get(`${url_global}/api/chargers/${chargerId}`);
        const data: any = response.data;
        return {
            charger: data.charger || {},
            schedules: data.schedules || [],
            sessions: data.sessions || []
        };
    } catch (error) {
     //   console.error('Error getting charger details:', error);
        return {
            charger: {},
            schedules: [],
            sessions: []
        };
    }
};

// Charger Current Session
export const getChargerCurrentSession = async (chargerId: number) => {
    try {
        const response = await apiClient.get(`${url_global}/api/chargers/${chargerId}/current-session`);
        return response.data;
    } catch (error) {
      //  console.error('Error getting current session:', error);
        return {
            success: false,
            error: 'Error de conexión'
        };
    }
};

// Update Charger Power
export const updateChargerPower = async (chargerId: number, newPower: number) => {
    if (newPower < 6 || newPower > 32) {
        throw new Error('La potencia debe estar entre 6A y 32A');
    }

    const response = await apiClient.put(`${url_global}/api/chargers/${chargerId}/power`, {
        max_power: newPower
    });
    return response.data;
};

// Get Charger Settings
export const getChargerSettings = async (chargerId: number): Promise<ChargerSettings> => {
    try {
        const response = await apiClient.get(`${url_global}/api/chargers/${chargerId}/settings`);
        const data: any = response.data;

        return {
            name: data.name || '',
            network: {
                wifiSSID: data.network?.wifiSSID || '',
                wifiPassword: data.network?.wifiPassword || ''
            },
            lighting: {
                standby: {
                    color: data.lighting?.standby?.color || '#2196F3',
                    enabled: data.lighting?.standby?.enabled !== false
                },
                charging: {
                    color: data.lighting?.charging?.color || '#4CAF50',
                    enabled: data.lighting?.charging?.enabled !== false
                },
                locked: {
                    color: data.lighting?.locked?.color || '#FFC107',
                    enabled: data.lighting?.locked?.enabled !== false
                }
            },
            lockMethods: {
                app: data.lockMethods?.app !== false,
                nfc: !!data.lockMethods?.nfc,
                bluetooth: !!data.lockMethods?.bluetooth
            }
        };
    } catch (error) {
       // console.error('Error getting charger settings:', error);
        return {
            name: '',
            network: {},
            lighting: {
                standby: { color: '#2196F3', enabled: true },
                charging: { color: '#4CAF50', enabled: true },
                locked: { color: '#FFC107', enabled: true }
            },
            lockMethods: {
                app: true,
                nfc: false,
                bluetooth: false
            }
        };
    }
};

// Update Charger Settings
export const updateChargerSettings = async (chargerId: number, settings: ChargerSettings) => {
    const response = await apiClient.put(`${url_global}/api/chargers/${chargerId}/settings`, settings);
    return response.data;
};

// Get Charging History
export const getChargingHistory = async (
    chargerId: number,
    range: 'week' | 'month' | 'year'
) => {
    try {
        const token = await getToken();
        const response = await fetch(
            `${url_global}/api/chargers/${chargerId}/history?range=${range}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        // console.error('Error getting charging history:', error);
        throw error;
    }
};

// Toggle Plug
export const togglePlug = async (chargerId: number, newState: boolean) => {
    const response = await apiClient.put(`${url_global}/api/chargers/${chargerId}/plug`, {
        is_plugged: newState
    });
    return response.data;
};

// Charging Schedules
export const addChargingSchedule = async (chargerId: number, scheduleData: {
    schedule_name: string;
    start_time: string;
    end_time: string;
    week_days: string[];
    action: string;
}) => {
    try {
        const response = await apiClient.post(`${url_global}/api/chargers/${chargerId}/schedules`, {
            ...scheduleData,
            action: scheduleData.action === 'charge' ? 'enable' : scheduleData.action
        });

        const data: any = response.data;

        if (!data || !data.success) {
            return {
                success: false,
                error: data?.error || 'Respuesta inválida del servidor',
                scheduleId: null
            };
        }

        return {
            success: true,
            scheduleId: data.scheduleId,
            message: data.message || 'Programación creada correctamente'
        };
    } catch (error: any) {
       // console.error('Error adding schedule:', error);
        return {
            success: false,
            error: error.response?.data?.error || 'Error de red o servidor',
            scheduleId: null
        };
    }
};

export const removeChargingSchedule = async (chargerId: number, scheduleId: number) => {
    const response = await apiClient.delete(`${url_global}/api/chargers/${chargerId}/schedules/${scheduleId}`);
    return response.data;
};

// Charging Sessions
export const startChargingSession = async (
    chargerId: number,
    paymentMethodId: string
): Promise<{ sessionId: string; ratePerKwh?: number }> => {
    const response = await apiClient.post(`${url_global}/api/chargers/${chargerId}/start-session`, {
        paymentMethodId
    });
    return response.data as { sessionId: string; ratePerKwh?: number };
};

export const stopChargingSession = async (sessionId: string) => {
    const response = await apiClient.post(`${url_global}/api/chargers/sessions/${sessionId}/stop`);
    return response.data;
};

// OCPP Functions
export const getOcppChargerStatus = async (serial: string) => {
    const response = await apiClient.get(`${url_global}/api/ocpp/status/${serial}`);
    return response.data;
};

export const remoteStartOcppCharging = async (serial: string, userId: number) => {
    const response = await apiClient.post(`${url_global}/api/ocpp/remote-start/${serial}`, {
        idTag: String(userId)
    });
    return response.data;
};

export const remoteStopOcppCharging = async (serial: string, transactionId: string | number) => {
    const response = await apiClient.post(`${url_global}/api/ocpp/remote-stop/${serial}`, {
        transactionId: String(transactionId)
    });
    return response.data;
};

export const getActiveChargingSession = async (serial: string) => {
    const response = await apiClient.get(`${url_global}/api/ocpp/charging-session/${serial}`);
    return response.data;
};

export const resetOcppCharger = async (serial: string, type: 'Hard' | 'Soft') => {
    const response = await apiClient.post(`${url_global}/api/ocpp/reset/${serial}`, { type });
    return response.data;
};

export const unlockOcppConnector = async (serial: string, connectorId: number) => {
    const response = await apiClient.post(`${url_global}/api/ocpp/unlock-connector/${serial}`, {
        connectorId
    });
    return response.data;
};

export const changeOcppConfiguration = async (serial: string, key: string, value: string) => {
    const response = await apiClient.post(`${url_global}/api/ocpp/change-configuration/${serial}`, {
        key,
        value
    });
    return response.data;
};

export const getOcppConfiguration = async (serial: string, keys?: string[]) => {
    const response = await apiClient.post(`${url_global}/api/ocpp/get-configuration/${serial}`, {
        keys
    });
    return response.data;
};

// Lighting
export const updateChargerLighting = async (chargerId: number, lighting: any) => {
    const response = await apiClient.put(`${url_global}/api/chargers/${chargerId}/lighting`, {
        lighting
    });
    return response.data;
};

// Lock/Unlock
export const toggleChargerLock = async (chargerId: number, isLocked: boolean) => {
    const response = await apiClient.put(`${url_global}/api/chargers/${chargerId}/lock`, {
        is_locked: isLocked
    });
    return response.data;
};

// Energy Settings
export const getEnergySettings = async (chargerId: number) => {
    const response = await apiClient.get(`${url_global}/api/chargers/${chargerId}/energy-settings`);
    return response.data;
};

export const updateChargingMode = async (chargerId: number, mode: string) => {
    const response = await apiClient.put(`${url_global}/api/chargers/${chargerId}/charging-mode`, {
        mode
    });
    return response.data;
};

export const updateUserPrice = async (chargerId: number, userId: number, rate_per_kwh: number) => {
    const response = await apiClient.put(`${url_global}/api/chargers/${chargerId}/users/${userId}/price`, {
        rate_per_kwh
    });
    return response.data;
};

// Factory Actions
export const resetCharger = async (chargerId: number) => {
    const response = await apiClient.post(`${url_global}/api/chargers/${chargerId}/factory/reset`);
    return response.data;
};

export const restoreCharger = async (chargerId: number) => {
    const response = await apiClient.post(`${url_global}/api/chargers/${chargerId}/factory/restore`);
    return response.data;
};

export const unlinkCharger = async (chargerId: number) => {
    const response = await apiClient.post(`${url_global}/api/chargers/${chargerId}/factory/unlink`);
    return response.data;
};

// Get Offline Charger Status
export const getOfflineChargerStatus = async (serialNumber: string) => {
    try {
        const response = await apiClient.get(`${url_global}/api/chargers/offline-status/${serialNumber}`);
        return response.data;
    } catch (error) {
        return { isOnline: false, lastSeen: null };
    }
};
// Charger Management
export const getMyChargers = async (): Promise<{ chargers: any[] }> => {
    const response = await apiClient.get<{ chargers: any[] }>(`${url_global}/api/chargers/mine`);
    return response.data;
};

export const associateCharger = async (serial: string) => {
    const response = await apiClient.put(`${url_global}/api/chargers/${serial}/associate`);
    return response.data;
};

export const addCharger = async (serial: string) => {
    const response = await apiClient.post(`${url_global}/api/chargers/add`, { serial });
    return response.data;
};

export const claimCharger = async (serial: string) => {
    const response = await apiClient.post(`${url_global}/api/chargers/${encodeURIComponent(serial)}/claim`);
    return response.data;
};

export const deleteCharger = async (chargerId: number) => {
    const response = await apiClient.delete(`${url_global}/api/chargers/${chargerId}`);
    return response.data;
};

// Home Chargers
export const getHomeChargers = async () => {
    const response = await apiClient.get(`${url_global}/api/chargers/home-chargers`);
    return response.data;
};

export const removeHomeCharger = async (chargerId: number) => {
    // This updates usage_type to 'payment' effectively "removing" it from home chargers
    const response = await apiClient.put(`${url_global}/api/chargers/${chargerId}/usage-type`, {
        usage_type: 'payment'
    });
    return response.data;
};

export const setChargerUsageType = async (chargerId: number, type: 'home' | 'payment') => {
    const response = await apiClient.put(`${url_global}/api/chargers/${chargerId}/usage-type`, {
        usage_type: type
    });
    return response.data;
};
