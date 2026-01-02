"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
const env_config_1 = require("./env.config");
// Configuración de Sequelize para OCPP
exports.sequelize = new sequelize_1.Sequelize(env_config_1.CONFIG.DB_NAME, env_config_1.CONFIG.DB_USER, env_config_1.CONFIG.DB_PASSWORD, {
    host: env_config_1.CONFIG.DB_HOST,
    dialect: 'postgres',
    port: env_config_1.CONFIG.DB_PORT,
    logging: env_config_1.CONFIG.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});
