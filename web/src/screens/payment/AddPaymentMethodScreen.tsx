import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import MainLayout from '@components/layout/MainLayout';
import Button from '@components/common/Button';
import toast from 'react-hot-toast';
import paymentService from '@services/paymentService';
import { STRIPE_PUBLISHABLE_KEY } from '../../config/stripeConfig';
import './AddPaymentMethodScreen.css';

// Initialize Stripe with the CORRECT key
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

const AddCardForm: React.FC = () => {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [cardState, setCardState] = useState({
        brand: 'unknown',
        complete: false,
        error: null as any
    });
    const navigate = useNavigate();

    const getCardColor = (brand: string) => {
        switch (brand) {
            case 'visa': return 'linear-gradient(135deg, #1A1F71 0%, #00509E 100%)';
            case 'mastercard': return 'linear-gradient(135deg, #EB001B 0%, #F79E1B 100%)';
            case 'amex': return 'linear-gradient(135deg, #2E77BB 0%, #00509E 100%)';
            default: return 'linear-gradient(135deg, #1A1F71 0%, #0D1137 100%)';
        }
    };

    const cardColorBg = getCardColor(cardState.brand);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        const cardElement = elements.getElement(CardElement);
        if (!cardElement) return;

        setLoading(true);

        try {
            // 2. Usar createPaymentMethod (Moderno)
            const { error, paymentMethod } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
            });

            if (error) {
                console.error('[error]', error);
                toast.error(error.message || 'Error al procesar la tarjeta');
                setLoading(false);
            } else if (paymentMethod) {
                console.log('[PaymentMethod]', paymentMethod);
                // Enviar el ID (pm_) al backend en lugar del token
                // Nota: addPaymentMethod en el servicio debe aceptar este ID en el campo 'source' o 'paymentMethodId'
                await paymentService.addPaymentMethod(paymentMethod.id);
                toast.success('✅ Tarjeta agregada exitosamente');
                navigate('/payments/methods');
            }
        } catch (error: any) {
            console.error('Error adding card:', error);
            const msg = error.response?.data?.error || error.message || 'Error al guardar la tarjeta';
            toast.error(msg);
            setLoading(false);
        }
    };

    const handleCardChange = (event: any) => {
        setCardState({
            brand: event.brand || 'unknown',
            complete: event.complete,
            error: event.error
        });
    };

    return (
        <div className="add-card-container">
            {/* Visual Card Preview */}
            <div className="card-preview-container">
                <div className="card-visual" style={{ background: cardColorBg }}>
                    <div className="card-chip"></div>
                    <div className="card-brand-logo">
                        {cardState.brand !== 'unknown' ? cardState.brand.toUpperCase() : 'TARJETA'}
                    </div>

                    <div className="card-number-mask">
                        •••• •••• •••• ••••
                    </div>

                    <div className="card-footer-row">
                        <div className="card-holder-group">
                            <span className="card-label-small">TITULAR</span>
                            <span className="card-value">USUARIO</span>
                        </div>
                        <div className="card-exp-group">
                            <span className="card-label-small">EXPIRA</span>
                            <span className="card-value">MM/YY</span>
                        </div>
                    </div>

                    {/* Decor Icon */}
                    <div className="card-decor-icon">💳</div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="add-card-form">
                <div className="secure-header">
                    🔒 Transacción Segura SSL 256-bit
                </div>

                <div className="form-group">
                    <label>Detalles de la Tarjeta</label>
                    <div className="card-element-wrapper">
                        <CardElement
                            onChange={handleCardChange}
                            options={{
                                style: {
                                    base: {
                                        fontSize: '16px',
                                        color: '#32325d',
                                        fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                                        fontSmoothing: 'antialiased',
                                        '::placeholder': {
                                            color: '#aab7c4',
                                        },
                                        iconColor: '#666EE8'
                                    },
                                    invalid: {
                                        color: '#fa755a',
                                        iconColor: '#fa755a'
                                    },
                                },
                                hidePostalCode: true,
                            }}
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <Button
                        variant="primary"
                        size="lg"
                        type="submit"
                        loading={loading}
                        disabled={!stripe || loading || !cardState.complete}
                        fullWidth
                        style={{ borderRadius: '12px', height: '50px', fontSize: '16px' }}
                    >
                        {loading ? 'Verificando...' : 'Guardar Tarjeta'}
                    </Button>
                </div>

                <div className="security-note">
                    <p>🔒 Tus datos son procesados directamente por Stripe de forma segura.</p>
                </div>
            </form>
        </div>
    );
};

const AddPaymentMethodScreen: React.FC = () => {
    const navigate = useNavigate();

    return (
        <MainLayout>
            <div className="add-payment-screen-wrapper">
                <div className="screen-header">
                    <button className="back-button" onClick={() => navigate('/payments/methods')}>
                        ← Volver
                    </button>
                    <h1>Nueva Tarjeta</h1>
                </div>

                <div className="content-card">
                    <Elements stripe={stripePromise}>
                        <AddCardForm />
                    </Elements>
                </div>
            </div>
        </MainLayout>
    );
};

export default AddPaymentMethodScreen;
