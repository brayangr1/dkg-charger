"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPaymentConfirmationEmail = exports.sendPaymentReceiptEmail = void 0;
const email_config_1 = require("../config/email.config");
// Función para generar el HTML de la boleta
const generateReceiptHTML = (payment) => {
    const formatDate = (dateString) => {
        if (!dateString) {
            return 'N/A';
        }
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };
    const formatAmount = (amount, currency) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        return `${currency} ${numAmount.toFixed(2)}`;
    };
    const getStatusText = (status) => {
        switch (status) {
            case 'completed':
                return 'Completado';
            case 'pending':
                return 'Pendiente';
            case 'failed':
                return 'Fallido';
            case 'refunded':
                return 'Reembolsado';
            default:
                return status;
        }
    };
    // Lógica segura para obtener los datos de facturación
    const b = payment.billing;
    const recipientName = b ? (b.company_name || `${b.first_name || ''} ${b.last_name || ''}`.trim()) : 'N/A';
    const recipientCif = b ? (b.cif || '') : '';
    const recipientAddress = b ? (b.address || '') : '';
    const recipientCity = b ? (`${b.postal_code || ''} ${b.city || ''}`).trim() : '';
    const recipientPhone = b ? (b.phone || '') : '';
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Recibo ${payment.invoice_number}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f8f9fa;
          color: #333;
        }
        .receipt {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .logo {
          width: 60px;
          height: 60px;
          background: #007bff;
          border-radius: 50%;
          margin: 0 auto 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e9ecef;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 5px;
        }
        .receipt-title {
          font-size: 16px;
          color: #6c757d;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .section {
          margin-bottom: 25px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 15px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .label {
          font-size: 14px;
          color: #6c757d;
          font-weight: 500;
        }
        .value {
          font-size: 14px;
          color: #333;
          font-weight: 600;
        }
        .amount {
          font-size: 20px;
          font-weight: bold;
          color: #28a745;
        }
        .status {
          background: #28a745;
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }
        .thank-you {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e9ecef;
        }
        .thank-you-text {
          font-size: 18px;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 8px;
        }
        .thank-you-subtext {
          font-size: 14px;
          color: #6c757d;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #6c757d;
          border-top: 1px solid #e9ecef;
          padding-top: 15px;
        }
        .button {
          display: inline-block;
          background: #007bff;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          margin-top: 20px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <img src="https://www.electroprime.es/wp-content/uploads/2025/08/logo.png" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin: 0 auto 15px; display: block;" alt="Logo">
          <div class="company-name">DKG SOLUTIONS</div>
          <div class="receipt-title">Recibo de Pago</div>
        </div>

        <div class="section">
          <div class="row">
            <span class="label">Factura:</span>
            <span class="value"> ${payment.invoice_number}</span>
          </div>
          <div class="row">
            <span class="label">Fecha:</span>
            <span class="value"> ${formatDate(payment.created_at)}</span>
          </div>
          <div class="row">
            <span class="label">Estado:</span>
            <span class="status">  ${getStatusText(payment.status)}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Detalles de la Carga</div>
          <div class="row">
            <span class="label">Cargador:</span>
            <span class="value">  ${payment.charger_name}</span>
          </div>
          <div class="row">
            <span class="label">Energía consumida:</span>
            <span class="value">  ${payment.total_energy} kWh</span>
          </div>
          <div class="row">
            <span class="label">Inicio:</span>
            <span class="value">  ${formatDate(payment.start_time)}</span>
          </div>
          <div class="row">
            <span class="label">Fin:</span>
            <span class="value">  ${formatDate(payment.end_time)}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Detalles del Pago</div>
          <div class="row">
            <span class="label">Monto:</span>
            <span class="amount">  ${formatAmount(payment.amount, payment.currency)}</span>
          </div>
          <div class="row">
            <span class="label">Método de pago:</span>
            <span class="value">  ${payment.card_brand} ****  ${payment.last4}</span>
          </div>
          <div class="row">
            <span class="label">ID de transacción:</span>
            <span class="value">  ${payment.transaction_id}</span>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Facturado a</div>
            <div class="row">
              <span class="label">Nombre / Empresa:</span>
              <span class="value">  ${recipientName}</span>
            </div>
            <div class="row">
              <span class="label">CIF / NIF:</span>
              <span class="value">  ${recipientCif}</span>
            </div>
            <div class="row">
              <span class="label">Dirección:</span>
              <span class="value">  ${recipientAddress}</span>
            </div>
            <div class="row">
              <span class="label">C.P. / Ciudad:</span>
              <span class="value">  ${recipientCity}</span>
            </div>
            <div class="row">
              <span class="label">Teléfono:</span>
              <span class="value">  ${recipientPhone}</span>
            </div>
        </div>

        <div class="thank-you">
          <div class="thank-you-text">¡Gracias por usar nuestro servicio de carga!</div>
          <div class="thank-you-subtext">Para soporte técnico, contacta con nuestro equipo.</div>
        </div>

        <div class="footer">
          <p>Este es un recibo oficial generado automáticamente.</p>
          <p>Fecha de generación: ${new Date().toLocaleString('es-ES')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
// Función para enviar la boleta por email
const sendPaymentReceiptEmail = async (userEmail, payment, userName) => {
    try {
        const htmlContent = generateReceiptHTML(payment);
        return await (0, email_config_1.sendEmail)(userEmail, `Recibo de Pago - ${payment.invoice_number}`, htmlContent);
    }
    catch (error) {
        console.error('❌ Error enviando email de recibo:', error);
        return false;
    }
};
exports.sendPaymentReceiptEmail = sendPaymentReceiptEmail;
// Función para enviar email de confirmación de pago
const sendPaymentConfirmationEmail = async (userEmail, payment, userName) => {
    try {
        const formatAmount = (amount, currency) => {
            const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
            return `${currency} ${numAmount.toFixed(2)}`;
        };
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="width: 60px; height: 60px; background: #28a745; border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">
            ✓
          </div>
          <h1 style="color: #28a745; margin: 0;">¡Pago Confirmado!</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-top: 0;">Detalles del Pago</h2>
          <p><strong>Factura:</strong> ${payment.invoice_number}</p>
          <p><strong>Monto:</strong> ${formatAmount(payment.amount, payment.currency)}</p>
          <p><strong>Cargador:</strong> ${payment.charger_name}</p>
          <p><strong>Energía:</strong> ${payment.total_energy} kWh</p>
          <p><strong>Fecha:</strong> ${new Date(payment.created_at).toLocaleDateString('es-ES')}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #6c757d;">Gracias por usar nuestro servicio de carga eléctrica.</p>
          <p style="color: #6c757d;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
        </div>
      </div>
    `;
        return await (0, email_config_1.sendEmail)(userEmail, `Pago Confirmado - ${formatAmount(payment.amount, payment.currency)}`, html);
    }
    catch (error) {
        console.error('❌ Error enviando email de confirmación:', error);
        return false;
    }
};
exports.sendPaymentConfirmationEmail = sendPaymentConfirmationEmail;
exports.default = {
    sendPaymentReceiptEmail: exports.sendPaymentReceiptEmail,
    sendPaymentConfirmationEmail: exports.sendPaymentConfirmationEmail,
};
