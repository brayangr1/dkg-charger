"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.CONFIG = {
    PORT: parseInt(process.env.PORT || '5010'),
    BASE_URL: process.env.BASE_URL || `https://server.dkgsolutions.es`,
    NODE_ENV: process.env.NODE_ENV || 'production',
    OCPP_URL: process.env.OCPP_URL || 'ws://server.dkgsolutions.es:8887',
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
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '354805308073-o4ct83pl5l4boj6qnkuknjkqo3ahtddn.apps.googleusercontent.com',
    // Firebase
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'charger-58f6a',
    // Email
    EMAIL_USER: process.env.EMAIL_USER || 'brayangarod1@gmail.com',
    EMAIL_PASS: process.env.EMAIL_PASS || 'mfcp cepd grgt scdn',
    // Stripe
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_51RzyiG4tjFCdVQtkUbSezVqwEqTX5Wi3onrqF599txFCXWPKZxYkfUFZgvNyxjTW7VlRyWo9Fb9WuneuX0CHfsq900v6h8DEXL',
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_51RzyiG4tjFCdVQtk3wBvrdEPfDiKRdw6pYdKBkTX0ZxNx7zmYNNv9XHTgtBEMuA5aPg79QiWvZutVelEBshsEVyB00Wk2uje5D',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_...',
    // CORS
    CORS_ORIGINS: [
        'http://localhost:3000', // Para desarrollo web
        'http://localhost:19006', // Para Expo
        'http://localhost:8081', // Para React Native
        'http://192.168.1.*:19000', // Para dispositivos en red local
        'http://server.dkgsolutions.es', // Tu dominio con HTTP
        'https://server.dkgsolutions.es', // Tu dominio con HTTPS
        'http://*.dkgsolutions.es', // Subdominios con HTTP
        'https://*.dkgsolutions.es' // Subdominios con HTTPS
    ]
};
exports.default = exports.CONFIG;
