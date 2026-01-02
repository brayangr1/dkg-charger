import html2pdf from 'html2pdf.js';
import toast from 'react-hot-toast';

export interface PaymentHistory {
  id?: string;
  invoice_number: string;
  created_at: string;
  status: string;
  charger_name: string;
  total_energy: number;
  start_time: string;
  end_time: string;
  amount: number | string;
  currency: string;
  card_brand: string;
  last4: string;
  transaction_id: string;
  user_email?: string;
  billing?: {
    company_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    cif?: string;
    address?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  };
  [key: string]: any;
}

export interface ReceiptData {
  payment: PaymentHistory;
}

const generateReceiptHTML = (data: ReceiptData): string => {
  const { payment } = data;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: string | number, currency: string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${currency} ${numAmount.toFixed(2)}`;
  };

  const getStatusText = (status: string) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#28a745';
      case 'pending':
        return '#ffc107';
      case 'failed':
        return '#dc3545';
      case 'refunded':
        return '#17a2b8';
      default:
        return '#6c757d';
    }
  };

  const billing = (payment as any).billing || {};
  const billingName =
    billing.company_name ||
    `${(billing.first_name || '').trim()} ${(billing.last_name || '').trim()}`.trim() ||
    `${((payment as any).user_first_name || '').trim()} ${((payment as any).user_last_name || '').trim()}`.trim() ||
    '-';
  const billingEmail = billing.email || (payment as any).user_email || '-';
  const billingCif = billing.cif || '-';
  const billingAddress =
    billing.address && billing.postal_code && billing.city
      ? `${billing.address}, ${billing.postal_code}, ${billing.city}`
      : billing.address || '-';
return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibo ${payment.invoice_number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, sans-serif;
      background-color: #f8f9fa;
      color: #333;
      line-height: 1.4;
      font-size: 12px;
    }
    
    .receipt-container {
      max-width: 600px; /* MÁS PEQUEÑO */
      margin: 10px auto;
      background: white;
      border-radius: 6px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.1);
    }
    
    .receipt-header {
      background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
      color: white;
      padding: 15px; /* REDUCIDO */
      text-align: center;
    }
    
    .receipt-header h1 {
      font-size: 20px; /* REDUCIDO */
      margin-bottom: 3px;
      font-weight: 700;
    }
    
    .receipt-header p {
      font-size: 11px;
    }
    
    .receipt-body {
      padding: 15px; /* REDUCIDO */
    }
    
    .section {
      margin-bottom: 15px;
    }
    
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #007bff;
      margin-bottom: 8px;
      padding-bottom: 5px;
      border-bottom: 1px solid #e9ecef;
    }
    
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      padding: 4px 0;
    }
    
    .row:nth-child(even) {
      background-color: #f8f9fa;
      padding: 4px 6px;
      border-radius: 3px;
    }
    
    .label {
      font-weight: 600;
      color: #6c757d;
      font-size: 11px; /* REDUCIDO */
    }
    
    .value {
      color: #333;
      font-weight: 500;
      text-align: right;
      font-size: 11px;
    }
    
    .amount-value {
      font-size: 16px;
      font-weight: 700;
      color: #28a745 !important;
    }
    
    .status-badge {
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      color: white;
      background-color: #28a745;
    }
    
    .thank-you-section {
      text-align: center;
      padding: 12px;
      background-color: #f0f7ff;
      border-radius: 6px;
      margin-top: 15px;
      border-left: 3px solid #007bff;
    }
    
    .thank-you-section h3 {
      color: #007bff;
      font-size: 13px;
      margin-bottom: 5px;
    }
    
    .thank-you-section p {
      color: #6c757d;
      font-size: 11px;
    }
    
    .receipt-footer {
      background-color: #f8f9fa;
      padding: 10px;
      text-align: center;
      font-size: 10px;
      color: #6c757d;
      border-top: 1px solid #e9ecef;
    }
    
    .divider {
      height: 1px;
      background-color: #e9ecef;
      margin: 12px 0;
    }
    
    @media print {
      body {
        background-color: white;
        font-size: 11px;
      }
      .receipt-container {
        box-shadow: none;
        margin: 0;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="receipt-header">
      <h1>RECIBO DE PAGO</h1>
      <p>DKG SOLUTIONS</p>
    </div>
    
    <div class="receipt-body">
      <div class="section">
        <div class="section-title">Información de Factura</div>
        <div class="row"><span class="label">Número de Factura:</span><span class="value">${payment.invoice_number}</span></div>
        <div class="row"><span class="label">Fecha:</span><span class="value">${formatDate(payment.created_at)}</span></div>
        <div class="row"><span class="label">Estado:</span><span class="status-badge" style="background-color: ${getStatusColor(payment.status)}">${getStatusText(payment.status)}</span></div>
      </div>
      
      <div class="section">
        <div class="section-title">Facturado a</div>
        <div class="row"><span class="label">Cliente:</span><span class="value">${billingName}</span></div>
        <div class="row"><span class="label">Email:</span><span class="value">${billingEmail}</span></div>
        <div class="row"><span class="label">CIF:</span><span class="value">${billingCif}</span></div>
        <div class="row"><span class="label">Dirección:</span><span class="value">${billingAddress}</span></div>
      </div>
      
      <div class="divider"></div>
      
      <div class="section">
        <div class="section-title">Detalles de Carga</div>
        <div class="row"><span class="label">Cargador:</span><span class="value">${payment.charger_name}</span></div>
        <div class="row"><span class="label">Energía Consumida:</span><span class="value">${payment.total_energy} kWh</span></div>
        <div class="row"><span class="label">Hora de Inicio:</span><span class="value">${payment.start_time ? formatDate(payment.start_time) : '-'}</span></div>
        <div class="row"><span class="label">Hora de Fin:</span><span class="value">${payment.end_time ? formatDate(payment.end_time) : '-'}</span></div>
      </div>
      
      <div class="divider"></div>
      
      <div class="section">
        <div class="section-title">Detalles del Pago</div>
        <div class="row"><span class="label">Monto Total:</span><span class="value amount-value">${formatAmount(payment.amount, payment.currency)}</span></div>
        <div class="row"><span class="label">Método de Pago:</span><span class="value">${payment.card_brand} ****${payment.last4}</span></div>
        <div class="row"><span class="label">ID de Transacción:</span><span class="value">${payment.transaction_id}</span></div>
      </div>
      
      <div class="thank-you-section">
        <h3>¡Gracias por usar nuestro servicio!</h3>
        <p>Para soporte técnico o consultas, contáctanos.</p>
      </div>
    </div>
    
    <div class="receipt-footer">
      <p>Recibo generado automáticamente por DKG SOLUTIONS</p>
      <p>Fecha de generación: ${new Date().toLocaleString('es-ES')}</p>
    </div>
  </div>
</body>
</html>
`;
};
export const generateAndSharePDF = async (receiptData: ReceiptData): Promise<boolean> => {
  try {
    console.log('Generando PDF para recibo:', receiptData.payment.invoice_number);

    const html = generateReceiptHTML(receiptData);
    const fileName = `Recibo_${receiptData.payment.invoice_number}_${new Date().getTime()}.pdf`;

    const options: { [key: string]: unknown } = {
      margin: [10, 10, 10, 10],
      filename: fileName,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    };

    await html2pdf().set(options).from(html).save();

    toast.success('Recibo descargado correctamente');
    return true;
  } catch (error) {
    console.error('Error generando PDF:', error);
    toast.error('Error al descargar el recibo');
    return false;
  }
};

export const downloadInvoicePDF = async (paymentId: string): Promise<void> => {
  try {
    console.log('Descargando factura con ID:', paymentId);
  } catch (error) {
    console.error('Error descargando factura:', error);
    throw error;
  }
};
