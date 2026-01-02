import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { IoRefresh } from 'react-icons/io5';
import { getPaymentHistory } from '../../services/paymentService';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import './PaymentHistoryScreen.css';

interface Payment {
    id: number;
    user_id: number;
    charger_id: number;
    session_id: number;
    amount: string | number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    payment_method_id: string;
    transaction_id: string;
    invoice_number: string;
    created_at: string;
    updated_at: string;
    charger_name: string;
    serial_number: string;
    start_time: string;
    end_time: string;
    total_energy: string | number;
    card_brand: string;
    last4: string;
    isOffline?: boolean;
    [key: string]: any;
}

const PaymentHistoryScreen: React.FC = () => {
    const [history, setHistory] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await getPaymentHistory();
            setHistory(data || []);
        } catch (error) {
            console.error('Error fetching payment history:', error);
            toast.error('Error al cargar el historial de pagos');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatAmount = (amount: string | number, currency: string) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        return `${currency} ${numAmount.toFixed(2)}`;
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completed': return 'Completado';
            case 'pending': return 'Pendiente';
            case 'failed': return 'Fallido';
            case 'refunded': return 'Reembolsado';
            default: return status;
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando historial...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="payment-history-container">
                <div className="payment-history-header">
                    <h1>Historial de Pagos</h1>
                    <Button variant="secondary" size="md" onClick={fetchHistory}>
                        <IoRefresh size={20} /> Actualizar
                    </Button>
                </div>

                {/* Stats Summary could go here if available from API */}

                {history.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">💳</div>
                        <h2>No hay pagos registrados</h2>
                        <p>Tus pagos aparecerán aquí una vez que realices recargas</p>
                    </div>
                ) : (
                    <div className="payment-list">
                        {history.map((payment) => (
                            <Card
                                key={payment.id}
                                className="payment-item"
                                onClick={() => navigate(`/payment/receipt/${payment.id}`, { state: payment })}
                            >
                                <div className="payment-info-left">
                                    <span className="payment-amount">
                                        {formatAmount(payment.amount, payment.currency)}
                                    </span>
                                    <span className="payment-date">
                                        {formatDate(payment.created_at)}
                                    </span>
                                    <span className="payment-charger">
                                        {payment.charger_name}
                                    </span>
                                </div>
                                <div className="payment-info-right">
                                    <span className={`status-badge status-${payment.status}`}>
                                        {getStatusLabel(payment.status)}
                                    </span>
                                    <span className="payment-details-text">
                                        {payment.isOffline
                                            ? `${payment.total_energy} kWh`
                                            : `${payment.total_energy} kWh • ${payment.card_brand} ****${payment.last4}`
                                        }
                                    </span>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default PaymentHistoryScreen;