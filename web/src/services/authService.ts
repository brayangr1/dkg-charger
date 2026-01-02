import { apiClient } from './apiClient';

const TOKEN_KEY = 'userToken';
const USER_DATA_KEY = 'userData';
const API_PATH = '/api/users';

/**
 * Obtiene el token JWT almacenado en localStorage
 * @returns Token JWT o null si no existe
 */
export const getToken = async (): Promise<string | null> => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Error al obtener el token:', error);
    return null;
  }
};

/**
 * Almacena el token JWT en localStorage
 * @param token Token JWT a almacenar
 */
export const setToken = async (token: string): Promise<void> => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error al guardar el token:', error);
  }
};

/**
 * Elimina el token JWT de localStorage (logout)
 */
export const removeToken = async (): Promise<void> => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error al eliminar el token:', error);
  }
};

/**
 * Obtiene los datos del usuario almacenados en localStorage
 * @returns Datos del usuario o null si no existen
 */
export const getUserData = async (): Promise<any | null> => {
  try {
    const userData = localStorage.getItem(USER_DATA_KEY);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error al obtener los datos del usuario:', error);
    return null;
  }
};

/**
 * Almacena los datos del usuario en localStorage
 * @param userData Datos del usuario a almacenar
 */
export const setUserData = async (userData: any): Promise<void> => {
  try {
    localStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error('Error al guardar los datos del usuario:', error);
  }
};

/**
 * Elimina los datos del usuario de localStorage (logout)
 */
export const removeUserData = async (): Promise<void> => {
  try {
    localStorage.removeItem(USER_DATA_KEY);
  } catch (error) {
    console.error('Error al eliminar los datos del usuario:', error);
  }
};

// Profile Management
export const updateProfile = async (_userId: number, data: any): Promise<any> => {
  const response = await apiClient.post(`${AUTH_API_PATH}/update-profile`, data);
  return response.data;
};

export const getBillingDetails = async (_userId: number): Promise<any> => {
  const response = await apiClient.get(`/api/billing/me`);
  return response.data;
};

export const updateBillingDetails = async (_userId: number, data: any): Promise<any> => {
  const response = await apiClient.post(`/api/billing`, data);
  return response.data;
}

// Cambiar contraseña
export const changePassword = async (userId: string, currentPassword: string, newPassword: string): Promise<boolean> => {
  const response = await apiClient.post(`${API_PATH}/${userId}/change-password`, {
    currentPassword,
    newPassword
  });
  return (response.data as any).success;
};

// Recuperar contraseña
export const forgotPassword = async (email: string): Promise<boolean> => {
  const response = await apiClient.post(`${AUTH_API_PATH}/forgot-password`, { email });
  return (response.data as any).success;
};

// Restablecer contraseña
export const resetPassword = async (token: string, password: string): Promise<boolean> => {
  const response = await apiClient.post(`${AUTH_API_PATH}/reset-password`, { token, password });
  return (response.data as any).success;
};

// Support
export const getSupportCategories = async (): Promise<any[]> => {
  // Mock response for now
  return [
    { id: 'general', name: 'General', icon: 'ℹ️' },
    { id: 'technical', name: 'Técnico', icon: '🔧' },
    { id: 'billing', name: 'Facturación', icon: '💳' },
    { id: 'account', name: 'Cuenta', icon: '👤' }
  ];
};

export const getFAQs = async (): Promise<any[]> => {
  // Mock response for now
  return [
    { id: 1, question: '¿Cómo cargo mi vehículo?', answer: 'Conecta el cable y usa la app para iniciar la sesión.' },
    { id: 2, question: '¿Cómo agrego saldo?', answer: 'Ve a la sección Wallet y selecciona "Agregar Fondos".' },
    { id: 3, question: '¿Qué hago si el cargador no responde?', answer: 'Intenta reiniciar el cargador desde la configuración.' }
  ];
};

export const sendSupportMessage = async (data: any): Promise<boolean> => {
  const response = await apiClient.post('/api/support/contact', data);
  return (response.data as any).success;
};