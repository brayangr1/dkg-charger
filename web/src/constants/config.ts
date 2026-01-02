// Configuration constants for web app

// API Configuration
//const isDevelopment = import.meta.env.DEV;

export const API_URL = 'https://server.dkgsolutions.es';

//export const API_URL = isDevelopment
//    ? '' // Servidor local en desarrollo
//    : (import.meta.env.VITE_API_URL || 'https://server.dkgsolutions.es');

export const API_URL_WS = import.meta.env.VITE_WEBSOCKET_URL || 'wss://server.dkgsolutions.es/ws';

export const url_global = API_URL;

export const PAYMENT_MODE: 'online' | 'local' = 'local';
