import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';

import toast from 'react-hot-toast';
import paymentService, { PaymentMethod } from '@services/paymentService';
import './PaymentScreen.css';

const PaymentScreen: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const paymentInfo = location.state as { amount: number; description: string } || { amount: 0, description: 'Pago' };

    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [processing, setProcessing] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPaymentMethods();
    }, []);

    const loadPaymentMethods = async () => {
        try {
            setLoading(true);
            const methods = await paymentService.getPaymentMethods();
            setPaymentMethods(methods);

            const defaultMethod = methods.find(m => m.isDefault);
            if (defaultMethod) {
                setSelectedMethod(defaultMethod.id);
            }
        } catch (error) {
            console.error('Error loading payment methods:', error);
            toast.error('Error al cargar métodos de pago');
        } finally {
            setLoading(false);
        }
    };

    const handlePayment = async () => {
        if (!selectedMethod) {
            toast.error('Selecciona un método de pago');
            return;
        }

        try {
            setProcessing(true);
            const result = await paymentService.processPayment({
                amount: paymentInfo.amount,
                paymentMethodId: selectedMethod,
                description: paymentInfo.description
            });

            toast.success('✅ Pago procesado correctamente');
            navigate('/payment/success', {
                state: {
                    amount: paymentInfo.amount,
                    transactionId: result.id || 'N/A'
                }
            });
        } catch (error: any) {
            console.error('Error processing payment:', error);
            toast.error(error.message || 'Error al procesar el pago');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="payment-screen">
                <div className="payment-header">
                    <button className="back-button" onClick={() => navigate(-1)}>
                        ← Volver
                    </button>
                    <h1>💳 Realizar Pago</h1>
                </div>

                <Card>
                    <div className="payment-summary">
                        <div className="summary-label">Total a Pagar</div>
                        <div className="summary-amount">€{paymentInfo.amount.toFixed(2)}</div>
                        <div className="summary-description">{paymentInfo.description}</div>
                    </div>
                </Card>

                <Card>
                    <h2>Método de Pago</h2>
                    {paymentMethods.length === 0 ? (
                        <div className="no-methods">
                            <p>No tienes métodos de pago guardados</p>
                            <Button variant="outline" onClick={() => navigate('/payments/methods/add')}>
                                + Agregar Tarjeta
                            </Button>
                        </div>
                    ) : (
                        <div className="payment-methods">
                            {paymentMethods.map((method) => (
                                <div
                                    key={method.id}
                                    className={`payment-method ${selectedMethod === method.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedMethod(method.id)}
                                >
                                    <input type="radio" checked={selectedMethod === method.id} readOnly />
                                    <div className="method-details">
                                        <div className="method-brand">{method.brand.toUpperCase()}</div>
                                        <div className="method-number">•••• {method.last4}</div>
                                        {method.isDefault && <span className="default-label">Predeterminada</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {paymentMethods.length > 0 && (
                    <Card>
                        <Button
                            variant="primary"
                            size="lg"
                            onClick={handlePayment}
                            loading={processing}
                            disabled={processing || !selectedMethod}
                            fullWidth
                        >
                            {processing ? 'Procesando...' : `💳 Pagar €${paymentInfo.amount.toFixed(2)}`}
                        </Button>
                    </Card>
                )}
            </div>
        </MainLayout>
    );
};

export default PaymentScreen;
