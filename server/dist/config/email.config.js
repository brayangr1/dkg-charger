"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = exports.isEmailConfigured = exports.emailTransporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Configuración centralizada de email (la misma que usan invitaciones y auth)
exports.emailTransporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});
// Función para verificar si el email está configurado
const isEmailConfigured = () => {
    return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
};
exports.isEmailConfigured = isEmailConfigured;
// Función para enviar email genérico
const sendEmail = async (to, subject, html, from = 'ChargerApp <no-reply@chargerapp.com>') => {
    try {
        if (!(0, exports.isEmailConfigured)()) {
            console.error('❌ Email no configurado. Configura EMAIL_USER y EMAIL_PASS en .env');
            return false;
        }
        await exports.emailTransporter.sendMail({
            from,
            to,
            subject,
            html,
        });
        console.log(`✅ Email enviado a ${to}: ${subject}`);
        return true;
    }
    catch (error) {
        console.error('❌ Error enviando email:', error);
        return false;
    }
};
exports.sendEmail = sendEmail;
exports.default = {
    emailTransporter: exports.emailTransporter,
    isEmailConfigured: exports.isEmailConfigured,
    sendEmail: exports.sendEmail,
};
