export interface Charger {
  id: number;
  device_id: number;
  name: string;
  serial_number: string;
  model?: string;
  vendor?: string;
  firmware_version?: string;
  ocpp_protocol?: string;
  endpoint_url?: string;
  status: string;
  last_heartbeat?: string;
  online_status: string;
  connector_count?: number;
  registered_at?: string;
  // Agrega otras propiedades si existen
}

// Definición de la interfaz para la respuesta de getChargers
interface GetChargersResponse {
  chargers: Charger[];
  // Agrega otras propiedades si la respuesta de la API incluye más datos
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Función mejorada para obtener el token de autenticación
const getAuthToken = () => {
  // En una aplicación real, obtendrías esto de localStorage, una cookie, o un estado global
  return localStorage.getItem('authToken');
};

const request = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Solo añadir el header de autorización si hay un token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network response was not ok' }));
    throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
  }

  return response.json();
};

// --- Charger Endpoints ---

export const getChargers = (): Promise<GetChargersResponse> => {
  // En una implementación real, esto vendría del backend que consulta la base de datos devices_db
  return request('/api/chargers');
};

// --- OCPP Endpoints ---

export const resetCharger = (serial: string, type: 'Hard' | 'Soft') => {
  return request(`/api/ocpp/reset/${serial}`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
};

export const changeChargerAvailability = (serial: string, connectorId: number, type: 'Inoperative' | 'Operative') => {
  return request(`/api/ocpp/change-availability/${serial}`, {
    method: 'POST',
    body: JSON.stringify({ connectorId, type }),
  });
};

export const clearChargerCache = (serial: string) => {
  return request(`/api/ocpp/clear-cache/${serial}`, {
    method: 'POST',
  });
};

export const remoteStartTransaction = (serial: string, userId: number) => {
  return request(`/api/ocpp/remote-start/${serial}`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

export const remoteStopTransaction = (serial: string, transactionId: number) => {
  return request(`/api/ocpp/remote-stop/${serial}`, {
    method: 'POST',
    body: JSON.stringify({ transactionId }),
  });
};

export const unlockConnector = (serial: string, connectorId: number) => {
  return request(`/api/ocpp/unlock-connector/${serial}`, {
    method: 'POST',
    body: JSON.stringify({ connectorId }),
  });
};

export const changeConfiguration = (serial: string, key: string, value: string) => {
  return request(`/api/ocpp/change-configuration/${serial}`, {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  });
};

export const getConfiguration = (serial: string, keys?: string[]) => {
  return request(`/api/ocpp/get-configuration/${serial}`, {
    method: 'POST',
    body: JSON.stringify({ keys }),
  });
};

export const updateFirmware = (serial: string, location: string, retrieveDate: string, retries?: number, retryInterval?: number) => {
  const body: any = { location, retrieveDate };
  if (retries !== undefined) body.retries = retries;
  if (retryInterval !== undefined) body.retryInterval = retryInterval;
  
  return request(`/api/ocpp/update-firmware/${serial}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const getDiagnostics = (serial: string, location: string, startTime?: string, stopTime?: string, retries?: number, retryInterval?: number) => {
  const body: any = { location };
  if (startTime) body.startTime = startTime;
  if (stopTime) body.stopTime = stopTime;
  if (retries !== undefined) body.retries = retries;
  if (retryInterval !== undefined) body.retryInterval = retryInterval;
  
  return request(`/api/ocpp/get-diagnostics/${serial}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
};

export const setChargingProfile = (serial: string, connectorId: number, chargingProfile: any) => {
  return request(`/api/ocpp/set-charging-profile/${serial}`, {
    method: 'POST',
    body: JSON.stringify({ connectorId, chargingProfile }),
  });
};