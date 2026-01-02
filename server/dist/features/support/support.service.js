"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSupportTicketEmail = void 0;
const email_config_1 = require("../../config/email.config");
const SUPPORT_EMAIL_RECIPIENT = process.env.SUPPORT_EMAIL || 'ventas@electroprime.es';
const sendSupportTicketEmail = async (payload) => {
    const { subject, type, description, userEmail } = payload;
    const emailSubject = `[Soporte App] - ${type}: ${subject}`;
    const emailBody = `
    <h2>Nuevo Ticket de Soporte</h2>
    <p><strong>Usuario:</strong> ${userEmail}</p>
    <p><strong>Tipo de Incidencia:</strong> ${type}</p>
    <p><strong>Asunto:</strong> ${subject}</p>
    <hr>
    <h3>Descripción:</h3>
    <p style="white-space: pre-wrap;">${description}</p>
  `;
    try {
        await (0, email_config_1.sendEmail)(SUPPORT_EMAIL_RECIPIENT, emailSubject, emailBody);
        return true;
    }
    catch (error) {
        console.error('Error sending support ticket email:', error);
        return false;
    }
};
exports.sendSupportTicketEmail = sendSupportTicketEmail;
