import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import toast from 'react-hot-toast';
import walletService, { Wallet } from '@services/walletService';
import paymentService, { PaymentMethod } from '@services/paymentService';
import { getUserData } from '@services/authService'; // Importar función para obtener datos del usuario
import './AddFundsScreen.css';

const PRESET_AMOUNTS = [10, 20, 50, 100];

const AddFundsScreen: React.FC = () => {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [selectedMethod, setSelectedMethod] = useState<string>('');
    const [amount, setAmount] = useState<number>(20);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null); // Nuevo estado para manejar errores
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null); // Limpiar errores anteriores
            
            // Usar la función correcta para obtener datos del usuario
            const user = await getUserData();
            if (!user) {
                setError('No se encontraron datos de usuario');
                setLoading(false);
                return;
            }

            const [userWallet, methods] = await Promise.all([
                walletService.getWallet(user.id),
                paymentService.getPaymentMethods()
            ]);

            setWallet(userWallet);
            setPaymentMethods(methods);

            // Select default payment method
            const defaultMethod = methods.find(m => m.isDefault);
            if (defaultMethod) {
                setSelectedMethod(defaultMethod.id);
            } else if (methods.length > 0) {
                setSelectedMethod(methods[0].id);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            setError('Error al cargar datos');
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFunds = async () => {
        if (!wallet) {
            toast.error('No se encontró la wallet');
            return;
        }

        if (!selectedMethod) {
            toast.error('Selecciona un método de pago');
            return;
        }

        const finalAmount = customAmount ? parseFloat(customAmount) : amount;

        if (finalAmount < 5) {
            toast.error('El monto mínimo es €5');
            return;
        }

        if (finalAmount > 500) {
            toast.error('El monto máximo es €500');
            return;
        }

        try {
            setProcessing(true);
            await walletService.addFunds({
                walletId: wallet.id,
                amount: finalAmount,
                paymentMethodId: selectedMethod
            });

            toast.success(`✅ Se agregaron €${finalAmount.toFixed(2)} a tu wallet`);
            setTimeout(() => navigate('/wallet'), 1500);
        } catch (error: any) {
            console.error('Error adding funds:', error);
            toast.error(error.message || 'Error al agregar fondos');
        } finally {
            setProcessing(false);
        }
    };

    // Mostrar mensaje de error si existe
    if (error) {
        return (
            <MainLayout>
                <div className="error-container">
                    <div className="error-message">
                        <h2>Error</h2>
                        <p>{error}</p>
                        <Button onClick={loadData} variant="primary">
                            Reintentar
                        </Button>
                    </div>
                </div>
            </MainLayout>
        );
    }

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

    if (!wallet) {
        return (
            <MainLayout>
                <div className="error-container">
                    <p>No se encontró la wallet</p>
                    <Button onClick={() => navigate('/wallet')}>Volver</Button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="add-funds-screen">
                <div className="add-funds-header">
                    <button className="back-button" onClick={() => navigate('/wallet')}>
                        ← Volver
                    </button>
                    <h1>💵 Agregar Fondos</h1>
                </div>

                {/* Current Balance */}
                <Card>
                    <div className="current-balance">
                        <span className="label">Saldo Actual</span>
                        <span className="balance">€{wallet.balance.toFixed(2)}</span>
                    </div>
                </Card>

                {/* Amount Selection */}
                <Card>
                    <h2>Selecciona el monto</h2>
                    <div className="preset-amounts">
                        {PRESET_AMOUNTS.map((preset) => (
                            <button
                                key={preset}
                                className={`amount-btn ${amount === preset && !customAmount ? 'active' : ''}`}
                                onClick={() => {
                                    setAmount(preset);
                                    setCustomAmount('');
                                }}
                            >
                                €{preset}
                            </button>
                        ))}
                    </div>

                    <div className="custom-amount">
                        <Input
                            label="O ingresa un monto personalizado"
                            type="number"
                            placeholder="Monto (mín. €5, máx. €500)"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            fullWidth
                        />
                    </div>
                </Card>

                {/* Payment Method */}
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
                        <div className="payment-methods-list">
                            {paymentMethods.map((method) => (
                                <div
                                    key={method.id}
                                    className={`payment-method-item ${selectedMethod === method.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedMethod(method.id)}
                                >
                                    <div className="method-info">
                                        <span className={`brand-icon ${method.brand.toLowerCase()}`}>
                                            {method.brand === 'visa' ? '💳' : '💳'}
                                        </span>
                                        <div>
                                            <div className="method-name">{method.brand} •••• {method.last4}</div>
                                            <div className="method-expiry">Vence {method.expMonth}/{method.expYear}</div>
                                        </div>
                                    </div>
                                    {method.isDefault && <span className="default-badge">Predeterminada</span>}
                                    <input
                                        type="radio"
                                        checked={selectedMethod === method.id}
                                        onChange={() => setSelectedMethod(method.id)}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Summary */}
                <Card>
                    <div className="summary">
                        <div className="summary-row">
                            <span>Monto a agregar:</span>
                            <span className="amount-value">
                                €{(customAmount ? parseFloat(customAmount) : amount).toFixed(2)}
                            </span>
                        </div>
                        <div className="summary-row total">
                            <span>Nuevo saldo:</span>
                            <span className="total-value">
                                €{(wallet.balance + (customAmount ? parseFloat(customAmount) || 0 : amount)).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    <Button
                        variant="primary"
                        size="lg"
                        onClick={handleAddFunds}
                        loading={processing}
                        disabled={processing || !selectedMethod}
                        fullWidth
                    >
                        {processing ? 'Procesando...' : '✨ Agregar Fondos'}
                    </Button>
                </Card>
            </div>
        </MainLayout>
    );
};

export default AddFundsScreen;
