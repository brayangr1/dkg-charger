import nodemailer from 'nodemailer';

// Configuración centralizada de email (la misma que usan invitaciones y auth)
export const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Función para verificar si el email está configurado
export const isEmailConfigured = (): boolean => {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
};

// Función para enviar email genérico
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  from: string = 'ChargerApp <no-reply@chargerapp.com>'
): Promise<boolean> => {
  try {
    if (!isEmailConfigured()) {
      console.error('❌ Email no configurado. Configura EMAIL_USER y EMAIL_PASS en .env');
      return false;
    }

    await emailTransporter.sendMail({
      from,
      to,
      subject,
      html,
    });

    console.log(`✅ Email enviado a ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    return false;
  }
};

export default {
  emailTransporter,
  isEmailConfigured,
  sendEmail,
}; 