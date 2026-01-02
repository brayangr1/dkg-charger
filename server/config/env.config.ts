import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
    PORT: parseInt(process.env.PORT || '5010'),
    BASE_URL: process.env.BASE_URL || `https://server.dkgsolutions.es`,
    APP_URL: process.env.APP_URL || 'https://server.dkgsolutions.es',
    NODE_ENV: process.env.NODE_ENV || 'production',
    OCPP_URL: process.env.OCPP_URL || 'wss://server.dkgsolutions.es:8887',

    // Database
    DB_HOST: process.env.DB_HOST || '127.0.0.1',
    DB_USER: process.env.DB_USER || 'appdkg',
    DB_PASSWORD: process.env.DB_PASSWORD || 'Dkg010203',
    DB_NAME: process.env.DB_NAME || 'charger',
    DB_PORT: parseInt(process.env.DB_PORT || '3306'),

    // Device Database
    DEVICE_DB_HOST: process.env.DEVICE_DB_HOST || '127.0.0.1',
    DEVICE_DB_USER: process.env.DEVICE_DB_USER || 'appdkg',
    DEVICE_DB_PASSWORD: process.env.DEVICE_DB_PASSWORD || 'Dkg010203',
    DEVICE_DB_NAME: process.env.DEVICE_DB_NAME || 'devices_db',
    DEVICE_DB_PORT: parseInt(process.env.DEVICE_DB_PORT || '3306'),

    // Admin Database
    ADMIN_DB_HOST: process.env.ADMIN_DB_HOST || '127.0.0.1',
    ADMIN_DB_USER: process.env.ADMIN_DB_USER || 'appdkg',
    ADMIN_DB_PASSWORD: process.env.ADMIN_DB_PASSWORD || 'Dkg010203',
    ADMIN_DB_NAME: process.env.ADMIN_DB_NAME || 'administracion',
    ADMIN_DB_PORT: parseInt(process.env.ADMIN_DB_PORT || '3306'),

    // JWT
    JWT_SECRET: process.env.JWT_SECRET || 'tusecretoseguro',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',

    // Google OAuth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '471068698493-1nuvbo1gd1rltjmg6mg3p0oia04p1kvm.apps.googleusercontent.com',

    // Firebase
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'dkg-cargadores-17a89',

    // Email
    EMAIL_USER: process.env.EMAIL_USER || 'brayangarod1@gmail.com',
    EMAIL_PASS: process.env.EMAIL_PASS || 'mfcp cepd grgt scdn',

    // Stripe
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_51Pz0EaRsidlM9v3kBZnV2XWVTbqKs8E7yacgLMDcEbUy4tMcugCOdvRobB3XHPazav8D6Cs7Ps4ucxF56sYiXies00JmYUMc7g',
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_51Pz0EaRsidlM9v3k7RYDhrXLmnISwRrmEQikadvq7e9jKuh0xDzPqXTS3Xre3900h2Der4Mckj4gppybXyYKb6Ky00ZzXaZSjI',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_UKCYsEysFROV6ej9S1zCgp8mY3hix2ZY',

    // CORS 
    CORS_ORIGINS: [

        'http://localhost:3000',      // Para desarrollo web
        'http://localhost:19006',     // Para Expo
        'http://localhost:8081',      // Para React Native
        'http://192.168.1.*:19000',   // Para dispositivos en red local
        'http://server.dkgsolutions.es',   // Tu dominio con HTTP
        'https://server.dkgsolutions.es',  // Tu dominio con HTTPS
        'https://www.dkgsolutions.es',     // Dominio con www
        'http://*.dkgsolutions.es',   // Subdominios con HTTP
        'https://*.dkgsolutions.es'   // Subdominios con HTTPS
    ]
};

export default CONFIG;