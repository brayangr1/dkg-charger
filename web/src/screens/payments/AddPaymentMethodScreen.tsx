import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { addPaymentMethod, addMockPaymentMethod } from '@services/paymentService';
import { useAuth } from '@context/AuthContext';
import './AddPaymentMethodScreen.css';

// Solo cargar Stripe si la clave pública está disponible
let stripePromise: Promise<any> | null = null;
if (process.env.REACT_APP_STRIPE_PUBLIC_KEY) {
  stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#000',
      fontFamily: 'Arial, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: 'rgba(0,0,0,0.5)',
      },
    },
    invalid: {
      color: '#e74c3c',
      iconColor: '#e74c3c',
    },
  },
};

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Estados para datos de tarjeta simulados
  const [mockCardData, setMockCardData] = useState({
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvc: ''
  });

  // Manejar cambios en los campos de tarjeta simulada
  const handleMockCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMockCardData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validar datos de tarjeta simulada
  const validateMockCardData = () => {
    const { cardNumber, expMonth, expYear, cvc } = mockCardData;
    
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
      return 'Número de tarjeta inválido';
    }
    
    if (!expMonth || parseInt(expMonth) < 1 || parseInt(expMonth) > 12) {
      return 'Mes de expiración inválido';
    }
    
    if (!expYear || parseInt(expYear) < new Date().getFullYear() % 100) {
      return 'Año de expiración inválido';
    }
    
    if (!cvc || cvc.length < 3) {
      return 'CVC inválido';
    }
    
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    setLoading(true);
    setError(null);

    try {
      // Si Stripe no está configurado o no está disponible, usar datos simulados
      if (!stripe || !elements) {
        const validationError = validateMockCardData();
        if (validationError) {
          throw new Error(validationError);
        }

        // Agregar método de pago simulado
        await addMockPaymentMethod({
          cardNumber: mockCardData.cardNumber.replace(/\s/g, ''),
          expMonth: parseInt(mockCardData.expMonth),
          expYear: 2000 + parseInt(mockCardData.expYear),
          cvc: mockCardData.cvc
        }, user?.email);
      } else {
        // Usar Stripe si está disponible
        const cardElement = elements.getElement(CardElement);
        
        if (!cardElement) {
          throw new Error('No se pudo obtener el elemento de tarjeta');
        }

        // Crear token de Stripe
        const { token, error: tokenError } = await stripe.createToken(cardElement);

        if (tokenError) {
          throw new Error(tokenError.message);
        }

        if (!token) {
          throw new Error('No se pudo crear el token de tarjeta');
        }

        // Agregar método de pago
        await addPaymentMethod(token.id, user?.email);
      }
      
      // Redirigir a la lista de métodos de pago
      navigate('/payments/methods');
    } catch (err: any) {
      console.error('Error adding card:', err);
      setError(err.message || 'Error al agregar la tarjeta');
    } finally {
      setLoading(false);
    }
  };

  // Determinar si estamos en modo simulado
  const isStripeAvailable = stripe && elements;

  return (
    <form onSubmit={handleSubmit}>
      <Card className="payment-form-card">
        {!isStripeAvailable ? (
          // Formulario simulado cuando Stripe no está disponible
          <div className="mock-card-form">
            <h3>Simulación de tarjeta (modo desarrollo)</h3>
            <div className="form-group">
              <label>Número de tarjeta</label>
              <Input
                type="text"
                name="cardNumber"
                value={mockCardData.cardNumber}
                onChange={handleMockCardChange}
                placeholder="4242 4242 4242 4242"
                maxLength={19}
              />
            </div>
            
            <div className="form-row">
              <div className="form-group half-width">
                <label>Mes Exp.</label>
                <Input
                  type="number"
                  name="expMonth"
                  value={mockCardData.expMonth}
                  onChange={handleMockCardChange}
                  placeholder="MM"
                  min="1"
                  max="12"
                />
              </div>
              
              <div className="form-group half-width">
                <label>Año Exp.</label>
                <Input
                  type="number"
                  name="expYear"
                  value={mockCardData.expYear}
                  onChange={handleMockCardChange}
                  placeholder="YY"
                  min={(new Date().getFullYear() % 100).toString()}
                  max="99"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>CVC</label>
              <Input
                type="password"
                name="cvc"
                value={mockCardData.cvc}
                onChange={handleMockCardChange}
                placeholder="123"
                maxLength={4}
              />
            </div>
          </div>
        ) : (
          // Formulario real de Stripe
          <div className="form-group">
            <label>Datos de la tarjeta</label>
            <div className="card-element-wrapper">
              <CardElement options={CARD_ELEMENT_OPTIONS} />
            </div>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={loading}
          loading={loading}
        >
          {loading ? 'Procesando...' : 'Agregar tarjeta'}
        </Button>
      </Card>
    </form>
  );
};

const AddPaymentMethodScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="add-payment-method-screen">
        <div className="screen-header">
          <button
            className="back-button"
            onClick={() => navigate(-1)}
          >
            ← Volver
          </button>
          <h1 className="screen-title">Agregar Método de Pago</h1>
        </div>

        <div className="content">
          {/* Renderizar el formulario dentro de Elements si stripePromise existe */}
          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <CheckoutForm />
            </Elements>
          ) : (
            <CheckoutForm />
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default AddPaymentMethodScreen;