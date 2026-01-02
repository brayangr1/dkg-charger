import { Sequelize } from 'sequelize';
import { CONFIG } from './env.config';

// Configuración de Sequelize para OCPP
export const sequelize = new Sequelize(CONFIG.DB_NAME, CONFIG.DB_USER, CONFIG.DB_PASSWORD, {
    host: CONFIG.DB_HOST,
    dialect: 'postgres',
    port: CONFIG.DB_PORT,
    logging: CONFIG.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});