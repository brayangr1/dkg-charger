import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import './PaymentSuccessScreen.css';

const PaymentSuccessScreen: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const paymentData = location.state as { amount: number; transactionId: string } || { amount: 0, transactionId: '' };

    return (
        <MainLayout>
            <div className="payment-success-screen">
                <Card>
                    <div className="success-content">
                        <div className="success-icon">
                            <div className="checkmark-circle">
                                <div className="checkmark">✓</div>
                            </div>
                        </div>

                        <h1>¡Pago Exitoso!</h1>
                        <p className="success-message">
                            Tu pago de <strong>€{paymentData.amount.toFixed(2)}</strong> ha sido procesado correctamente
                        </p>

                        <div className="transaction-info">
                            <div className="info-row">
                                <span className="label">ID de Transacción:</span>
                                <span className="value">{paymentData.transactionId || 'N/A'}</span>
                            </div>
                            <div className="info-row">
                                <span className="label">Fecha:</span>
                                <span className="value">{new Date().toLocaleString('es-ES')}</span>
                            </div>
                        </div>

                        <div className="success-actions">
                            <Button variant="primary" size="lg" onClick={() => navigate('/wallet')} fullWidth>
                                🏠 Volver a Wallet
                            </Button>
                            <Button variant="outline" onClick={() => navigate('/')} fullWidth>
                                Ir al Inicio
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </MainLayout>
    );
};

export default PaymentSuccessScreen;
