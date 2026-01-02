import React, { useEffect, useState } from 'react';
import paymentService, { PaymentMethod } from '@services/paymentService';
import Button from '@components/common/Button';
import './PaymentMethodSelector.css';

interface PaymentMethodSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (method: PaymentMethod) => void;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({ isOpen, onClose, onSelect }) => {
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadMethods();
        }
    }, [isOpen]);

    const loadMethods = async () => {
        setLoading(true);
        try {
            const data = await paymentService.getPaymentMethods();
            setMethods(data);
        } catch (error) {
            console.error('Error loading methods:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const getCardColor = (brand: string) => {
        switch (brand.toLowerCase()) {
            case 'visa': return 'linear-gradient(135deg, #1A1F71 0%, #00509E 100%)';
            case 'mastercard': return 'linear-gradient(135deg, #EB001B 0%, #F79E1B 100%)';
            case 'amex': return 'linear-gradient(135deg, #2E77BB 0%, #00509E 100%)';
            default: return 'linear-gradient(135deg, #1A1F71 0%, #0D1137 100%)';
        }
    };

    return (
        <div className="payment-selector-overlay" onClick={onClose}>
            <div className="payment-selector-modal" onClick={e => e.stopPropagation()}>
                <div className="selector-header">
                    <h2>Selecciona Método de Pago</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="selector-content">
                    {loading ? (
                        <div className="loading-state">Cargando tarjetas...</div>
                    ) : methods.length === 0 ? (
                        <div className="empty-state">
                            <p>No tienes tarjetas guardadas.</p>
                            <Button onClick={onClose} variant="primary">Cancelar</Button>
                        </div>
                    ) : (
                        methods.map(method => (
                            <div
                                key={method.id}
                                className="selectable-card-item"
                                onClick={() => onSelect(method)}
                            >
                                {/* Reusing the Premium Card Visual structure */}
                                <div className="payment-method-visual" style={{ background: getCardColor(method.brand) }}>
                                    <div className="pm-chip"></div>
                                    <div className="pm-brand">{method.brand.toUpperCase()}</div>
                                    <div className="pm-number">•••• •••• •••• {method.last4}</div>
                                    <div className="pm-footer">
                                        <div className="pm-exp">
                                            EXP {String(method.expMonth).padStart(2, '0')}/{String(method.expYear).slice(-2)}
                                        </div>
                                        {method.isDefault && (
                                            <div className="pm-default-badge">✓ Principal</div>
                                        )}
                                    </div>
                                    <div className="pm-decor-icon">💳</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentMethodSelector;
