import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import toast from 'react-hot-toast';
import paymentService, { PaymentMethod } from '@services/paymentService';
import './PaymentMethodsScreen.css';

const PaymentMethodsScreen: React.FC = () => {
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null); // Nuevo estado para manejar errores
    const navigate = useNavigate();

    useEffect(() => {
        loadPaymentMethods();
    }, []);

    const loadPaymentMethods = async () => {
        try {
            setLoading(true);
            setError(null); // Limpiar errores anteriores
            const data = await paymentService.getPaymentMethods();
            setMethods(data);
        } catch (error) {
            console.error('Error loading payment methods:', error);
            setError('Error al cargar métodos de pago');
            toast.error('Error al cargar métodos de pago');
        } finally {
            setLoading(false);
            setRefreshing(false);
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
                        <Button onClick={loadPaymentMethods} variant="primary">
                            Reintentar
                        </Button>
                    </div>
                </div>
            </MainLayout>
        );
    }

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadPaymentMethods();
    };

    const handleSetDefault = async (methodId: string) => {
        try {
            const success = await paymentService.setDefaultPaymentMethod(methodId);
            if (success) {
                setMethods(prevMethods =>
                    prevMethods.map(method => ({
                        ...method,
                        isDefault: method.id === methodId
                    }))
                );
                toast.success('✅ Método predeterminado actualizado');
            } else {
                toast.error('Error al establecer como predeterminado');
            }
        } catch (error) {
            console.error('Error setting default:', error);
            toast.error('Error al establecer como predeterminado');
        }
    };

    const handleDeleteMethod = async (methodId: string) => {
        if (!confirm('¿Eliminar este método de pago? Esta acción no se puede deshacer.')) return;

        try {
            const success = await paymentService.deletePaymentMethod(methodId);
            if (success) {
                setMethods(prevMethods => prevMethods.filter(method => method.id !== methodId));
                toast.success('✅ Método de pago eliminado');
            } else {
                toast.error('Error al eliminar método de pago');
            }
        } catch (error) {
            console.error('Error deleting method:', error);
            toast.error('Error al eliminar método de pago');
        }
    };

    /*  const getBrandIcon = (brand: string) => {
          const icons: { [key: string]: string } = {
              'visa': '💳',
              'mastercard': '💳',
              'amex': '💳',
              'discover': '💳'
          };
          return icons[brand.toLowerCase()] || '💳';
      };*/

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando métodos de pago...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="payment-methods-screen">
                <div className="payment-methods-header">
                    <h1>💳 Métodos de Pago</h1>
                    <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing}>
                        🔄 {refreshing ? 'Actualizando...' : 'Actualizar'}
                    </button>
                </div>

                {methods.length === 0 ? (
                    <Card>
                        <div className="no-methods">
                            <div className="empty-icon">💳</div>
                            <h2>No tienes métodos de pago</h2>
                            <p>Agrega una tarjeta para poder realizar pagos y agregar fondos a tu wallet</p>
                            <Button variant="primary" size="lg" onClick={() => navigate('/payments/methods/add')}>
                                + Agregar Tarjeta
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <>
                        <div className="methods-list">
                            <div className="methods-list">
                                {methods.map((method) => {
                                    const cardColor = (() => {
                                        switch (method.brand.toLowerCase()) {
                                            case 'visa': return 'linear-gradient(135deg, #1A1F71 0%, #00509E 100%)';
                                            case 'mastercard': return 'linear-gradient(135deg, #EB001B 0%, #F79E1B 100%)';
                                            case 'amex': return 'linear-gradient(135deg, #2E77BB 0%, #00509E 100%)';
                                            default: return 'linear-gradient(135deg, #1A1F71 0%, #0D1137 100%)';
                                        }
                                    })();

                                    return (
                                        <div key={method.id} className="payment-method-item-container">
                                            <div className="payment-method-visual" style={{ background: cardColor }}>
                                                <div className="pm-chip"></div>
                                                <div className="pm-brand">{method.brand.toUpperCase()}</div>
                                                <div className="pm-number">•••• •••• •••• {method.last4}</div>
                                                <div className="pm-footer">
                                                    <div className="pm-exp">
                                                        EXP {String(method.expMonth).padStart(2, '0')}/{String(method.expYear).slice(-2)}
                                                    </div>
                                                    {method.isDefault && (
                                                        <div className="pm-default-badge">
                                                            ✓ Principal
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="pm-decor-icon">💳</div>
                                            </div>

                                            <div className="method-actions-bar">
                                                {!method.isDefault && (
                                                    <button
                                                        className="action-link default-link"
                                                        onClick={() => handleSetDefault(method.id)}
                                                    >
                                                        ★ Principal
                                                    </button>
                                                )}
                                                <button
                                                    className="action-link delete-link"
                                                    onClick={() => handleDeleteMethod(method.id)}
                                                >
                                                    🗑 Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <Card>
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={() => navigate('/payments/methods/add')}
                                fullWidth
                            >
                                + Agregar Nueva Tarjeta
                            </Button>
                        </Card>
                    </>
                )}
            </div>
        </MainLayout>
    );
};

export default PaymentMethodsScreen;