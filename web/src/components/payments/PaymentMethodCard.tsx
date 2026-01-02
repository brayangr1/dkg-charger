import React from 'react';
import Card from '@components/common/Card';
import './PaymentMethodCard.css';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  is_default: boolean;
}

interface PaymentMethodCardProps {
  method: PaymentMethod;
}

const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ method }) => {
  const getBrandIcon = (brand: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return '💳';
      case 'mastercard':
        return '💳';
      case 'amex':
        return '💳';
      default:
        return '💳';
    }
  };

  const formatExpiryDate = (month: number, year: number) => {
    const formattedMonth = month.toString().padStart(2, '0');
    // Assuming year is stored as full year (e.g., 2025) or two digits
    const formattedYear = year.toString().length === 2 ? `20${year}` : year.toString();
    const displayYear = formattedYear.slice(-2);
    return `${formattedMonth}/${displayYear}`;
  };

  return (
    <Card className="payment-method-card">
      <div className="payment-method-header">
        <div className="payment-method-brand">
          <span className="brand-icon">{getBrandIcon(method.brand)}</span>
          <span className="brand-name">{method.brand || 'Tarjeta'}</span>
        </div>
        {method.is_default && (
          <span className="default-badge">Predeterminado</span>
        )}
      </div>
      
      <div className="payment-method-details">
        <div className="card-number">•••• •••• •••• {method.last4 || '****'}</div>
        <div className="card-expiry">
          Vence: {formatExpiryDate(method.expMonth, method.expYear)}
        </div>
      </div>
    </Card>
  );
};

export default PaymentMethodCard;