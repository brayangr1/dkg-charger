import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
//import Card from '@components/common/Card';
import Button from '@components/common/Button';
import { getPaymentMethods, setDefaultPaymentMethod, deletePaymentMethod } from '@services/paymentService';
import PaymentMethodCard from '@components/payments/PaymentMethodCard';
import './PaymentMethodsScreen.css';

const PaymentMethodsScreen: React.FC = () => {
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const methods = await getPaymentMethods();
      console.log('Métodos de pago cargados:', methods);
      setMethods(methods);
    } catch (error) {
      console.error('Error cargando métodos de pago:', error);
      // Manejo de errores silencioso para evitar alertas molestas
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPaymentMethods();
    setRefreshing(false);
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      const success = await setDefaultPaymentMethod(methodId);
      if (success) {
        setMethods(prevMethods => 
          prevMethods.map(method => ({
            ...method,
            is_default: method.id === methodId
          }))
        );
        // Éxito silencioso para mejorar UX
      } else {
        console.error('No se pudo establecer como predeterminado');
      }
    } catch (error) {
      console.error('Error estableciendo método predeterminado:', error);
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    setMethodToDelete(methodId);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    if (!methodToDelete) return;

    try {
      const success = await deletePaymentMethod(methodToDelete);
      if (success) {
        setMethods(prevMethods => prevMethods.filter(method => method.id !== methodToDelete));
      } else {
        console.error('No se pudo eliminar el método de pago');
      }
    } catch (error) {
      console.error('Error eliminando método de pago:', error);
    } finally {
      closeDeleteModal();
    }
  };

  const closeDeleteModal = () => {
    setShowConfirmDelete(false);
    setMethodToDelete(null);
  };

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  return (
    <MainLayout>
      <div className="payment-methods-screen">
        {/* Header */}
        <div className="screen-header">
          <div className="header-content">
            <button
              className="back-button"
              onClick={() => navigate(-1)}
            >
              ← Volver
            </button>
            <h1 className="screen-title">Métodos de Pago</h1>
            <button 
              className="refresh-button"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? '↻' : '↻'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Cargando métodos de pago...</p>
          </div>
        ) : (
          <>
            <div className="methods-list">
              {methods.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💳</div>
                  <h3>No tienes métodos de pago</h3>
                  <p>Agrega una tarjeta para poder realizar pagos</p>
                </div>
              ) : (
                methods.map((method) => (
                  <div key={method.id} className="method-item">
                    <PaymentMethodCard method={method} />
                    <div className="method-actions">
                      {!method.is_default && (
                        <button
                          className="action-button default-button"
                          onClick={() => handleSetDefault(method.id)}
                        >
                          ✓ Predeterminado
                        </button>
                      )}
                      <button
                        className="action-button delete-button"
                        onClick={() => handleDeleteMethod(method.id)}
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="footer">
              <Button 
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate('/payments/methods/add')}
              >
                ➕ Añadir Nueva Tarjeta
              </Button>
            </div>
          </>
        )}

        {/* Modal de confirmación de eliminación */}
        {showConfirmDelete && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Eliminar Método de Pago</h2>
              <p>¿Estás seguro de que quieres eliminar este método de pago? Esta acción no se puede deshacer.</p>
              <div className="modal-actions">
                <Button 
                  variant="outline" 
                  onClick={closeDeleteModal}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="danger" 
                  onClick={confirmDelete}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default PaymentMethodsScreen;