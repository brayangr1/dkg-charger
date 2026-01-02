import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import toast from 'react-hot-toast';
import { getPaymentHistory } from '@services/paymentService';
import './PaymentReceiptScreen.css';
import { generateAndSharePDF } from '@/services/pdfService';

interface PaymentHistory {
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
    isOffline?: boolean;
    offlineInvoice?: string;
    [key: string]: any;
}

const PaymentReceiptScreen: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { paymentId } = useParams<{ paymentId: string }>();
    const [payment, setPayment] = useState<PaymentHistory | null>(null);
    const [, setLoading] = useState(true);

    // Intentar cargar desde location.state primero, luego desde la API
    useEffect(() => {
        const loadPayment = async () => {
            try {
                // Si viene desde location.state, usarlo
                if (location.state) {
                    setPayment(location.state as PaymentHistory);
                    setLoading(false);
                    return;
                }

                // Si viene con paymentId en URL, cargar desde API
                if (paymentId) {
                    const history = await getPaymentHistory();
                    const foundPayment = history.find(p => p.id === paymentId);
                    if (foundPayment) {
                        setPayment(foundPayment as PaymentHistory);
                    } else {
                        toast.error('Pago no encontrado');
                        navigate('/payments/history');
                    }
                }
            } catch (error) {
                console.error('Error cargando pago:', error);
                toast.error('Error al cargar el pago');
            } finally {
                setLoading(false);
            }
        };

        loadPayment();
    }, [paymentId, location.state, navigate]);

    const defaultPayment: PaymentHistory = {
        invoice_number: 'N/A',
        created_at: new Date().toISOString(),
        status: 'completed',
        charger_name: 'N/A',
        total_energy: 0,
        start_time: '',
        end_time: '',
        amount: 0,
        currency: '€',
        card_brand: 'N/A',
        last4: '0000',
        transaction_id: 'N/A',
    };

    const currentPayment = payment || defaultPayment;

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
                return '#10b981';
            case 'pending':
                return '#f59e0b';
            case 'failed':
                return '#ef4444';
            case 'refunded':
                return '#3b82f6';
            default:
                return '#6b7280';
        }
    };

    const handleDownload = async () => {
        try {
            const success = await generateAndSharePDF({ payment: currentPayment });
            if (!success) {
                toast.error('Error al descargar el recibo');
            }
        } catch (error) {
            console.error('Error descargando PDF:', error);
            toast.error('Error al descargar el recibo');
        }
    };

    const handleShare = async () => {
        try {
            const receiptText = `
RECIBO DE PAGO - DKG SOLUTIONS

📋 Factura: ${currentPayment.invoice_number}
📅 Fecha: ${formatDate(currentPayment.created_at)}
✅ Estado: ${getStatusText(currentPayment.status)}

🔌 DETALLES DE LA CARGA:
   Cargador: ${currentPayment.charger_name}
   Energía consumida: ${currentPayment.total_energy} kWh
   Duración: ${formatDate(currentPayment.start_time)} - ${formatDate(currentPayment.end_time)}

💰 DETALLES DEL PAGO:
   Monto: ${formatAmount(currentPayment.amount, currentPayment.currency)}
   Método de pago: ${currentPayment.card_brand} ****${currentPayment.last4}
   ID de transacción: ${currentPayment.transaction_id}

¡Gracias por usar nuestro servicio de carga!
DKG SOLUTIONS
            `.trim();

            if (navigator.share) {
                await navigator.share({
                    title: `Recibo ${currentPayment.invoice_number}`,
                    text: receiptText,
                });
            } else {
                toast.success('Texto copiado al portapapeles');
                navigator.clipboard.writeText(receiptText);
            }
        } catch (error) {
            console.error('Error compartiendo:', error);
            toast.error('No se pudo compartir el recibo');
        }
    };

    return (
        <MainLayout>
            <div className="payment-receipt-screen">
                <div className="receipt-header">
                    <button className="back-button" onClick={() => navigate('/payments/history')}>
                        ← Volver
                    </button>
                    <h1>🧾 Recibo de Pago</h1>
                </div>

                <Card>
                    <div className="receipt-content">
                        {/* Logo y encabezado */}
                        <div className="receipt-logo-section">
                            <h2 className="company-name">DKG SOLUTIONS</h2>
                            <h3 className="receipt-title">RECIBO DE PAGO</h3>
                        </div>

                        {/* Información de factura */}
                        <div className="invoice-section">
                            <div className="detail-row">
                                <span className="label">Factura:</span>
                                <span className="value">{currentPayment.invoice_number}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Fecha:</span>
                                <span className="value">{formatDate(currentPayment.created_at)}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Estado:</span>
                                <span 
                                    className="value status-badge"
                                    style={{ backgroundColor: getStatusColor(currentPayment.status) }}
                                >
                                    {getStatusText(currentPayment.status)}
                                </span>
                            </div>
                        </div>

                        {/* Detalles de la carga */}
                        <div className="receipt-section">
                            <h4 className="section-title">Detalles de la Carga</h4>
                            <div className="detail-row">
                                <span className="label">Cargador:</span>
                                <span className="value">{currentPayment.charger_name}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Energía consumida:</span>
                                <span className="value">{currentPayment.total_energy} kWh</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Inicio:</span>
                                <span className="value">{currentPayment.start_time ? formatDate(currentPayment.start_time) : '-'}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Fin:</span>
                                <span className="value">{currentPayment.end_time ? formatDate(currentPayment.end_time) : '-'}</span>
                            </div>
                        </div>

                        {/* Detalles del pago */}
                        <div className="receipt-section">
                            <h4 className="section-title">Detalles del Pago</h4>
                            <div className="detail-row amount-row">
                                <span className="label">Monto:</span>
                                <span className="value amount-value">
                                    {formatAmount(currentPayment.amount, currentPayment.currency)}
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Método de pago:</span>
                                <span className="value">{currentPayment.card_brand} ****{currentPayment.last4}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">ID de transacción:</span>
                                <span className="value">{currentPayment.transaction_id}</span>
                            </div>
                        </div>

                        {/* Mensaje de agradecimiento */}
                        <div className="thank-you-section">
                            <p className="thank-you-text">¡Gracias por usar nuestro servicio de carga!</p>
                            <p className="thank-you-subtext">Para soporte técnico, contacta con nuestro equipo.</p>
                        </div>

                        <div className="receipt-actions">
                            <Button variant="outline" onClick={handleShare} fullWidth>
                                📤 Compartir
                            </Button>
                            <Button variant="primary" onClick={handleDownload} fullWidth>
                                📥 Descargar Recibo PDF
                            </Button>
                            <Button variant="primary" onClick={() => navigate('/payments/history')} fullWidth>
                                Volver a Wallet
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </MainLayout>
    );
};

export default PaymentReceiptScreen;
