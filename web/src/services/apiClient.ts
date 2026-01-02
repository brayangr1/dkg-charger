import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { url_global } from '@constants/config';
import { getToken } from './authService';

class ApiClient {
    private axiosInstance: AxiosInstance;

    constructor() {
        this.axiosInstance = axios.create({
            baseURL: url_global,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Agregar interceptor para incluir token en las solicitudes
        this.axiosInstance.interceptors.request.use(
            async (config) => {
                const token = await getToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config; 
            },
            (error) => Promise.reject(error)
        );

        // Agregar interceptor para manejar errores
        this.axiosInstance.interceptors.response.use(
            (response) => response,
            (error) => {
              //  console.error('Error de API:', error);

                // Si hay error 401, el usuario no está autenticado
                if (error.response?.status === 401) {
                    // Disparar evento para que AuthContext maneje el logout
                    window.dispatchEvent(new CustomEvent('unauthorized'));
                }

                return Promise.reject(error);
            }
        );
    }

    async get<T>(url: string, config?: AxiosRequestConfig) {
        return this.axiosInstance.get<T>(url, config);
    }

    async post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
        return this.axiosInstance.post<T>(url, data, config);
    }

    async put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
        return this.axiosInstance.put<T>(url, data, config);
    }

    async delete<T>(url: string, config?: AxiosRequestConfig) {
        return this.axiosInstance.delete<T>(url, config);
    }

    async patch<T>(url: string, data?: any, config?: AxiosRequestConfig) {
        return this.axiosInstance.patch<T>(url, data, config);
    }
}

export const apiClient = new ApiClient();
