import { sendEmail } from '../../config/email.config';

interface SupportTicketPayload {
  subject: string;
  type: string;
  description: string;
  userEmail: string; // Email del usuario que envía el ticket
}

const SUPPORT_EMAIL_RECIPIENT = process.env.SUPPORT_EMAIL || 'ventas@electroprime.es';

export const sendSupportTicketEmail = async (payload: SupportTicketPayload): Promise<boolean> => {
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
    await sendEmail(SUPPORT_EMAIL_RECIPIENT, emailSubject, emailBody);
    return true;
  } catch (error) {
    console.error('Error sending support ticket email:', error);
    return false;
  }
};