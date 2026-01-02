import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import toast from 'react-hot-toast';
import {
    remoteStartOcppCharging,
    remoteStopOcppCharging,
    resetOcppCharger,
    unlockOcppConnector,
    getOcppChargerStatus,
    //toggleChargerLock
} from '@services/chargerService';
import paymentService from '@services/paymentService';
import PaymentMethodSelector from '@components/payments/PaymentMethodSelector';
import './ChargerManagementScreen.css';

const ChargerManagementScreen: React.FC = () => {
    const { chargerId } = useParams<{ chargerId: string }>();
    const navigate = useNavigate();
    const [serialNumber, setSerialNumber] = useState('');
    const [ocppStatus, setOcppStatus] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [showPaymentSelector, setShowPaymentSelector] = useState(false);

    useEffect(() => {
        if (chargerId) {
            fetchChargerInfo();
        }
    }, [chargerId]);

    const fetchChargerInfo = async () => {
        try {
            const response = await fetch(`/api/chargers/${chargerId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('userToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setSerialNumber(data.charger.serial_number);
                // Load OCPP status
                loadOcppStatus(data.charger.serial_number);
            }
        } catch (error) {
            console.error('Error fetching charger:', error);
        }
    };

    const loadOcppStatus = async (serial: string) => {
        try {
            const status = await getOcppChargerStatus(serial);
            setOcppStatus(status);
        } catch (error) {
            console.error('Error loading OCPP status:', error);
        }
    };

    const handleRemoteStart = () => {
        if (!serialNumber) return;
        setShowPaymentSelector(true);
    };

    const handlePaymentSelected = async (method: any) => {
        setShowPaymentSelector(false);
        setLoading(true);

        try {
            // Pre-autorizar pago (Ej: 15 EUR)
            toast.loading('Autorizando pago...', { id: 'auth-toast' });

            try {
                const preAuth = await paymentService.preAuthorizePayment(15.00, method.id);
                toast.dismiss('auth-toast');

                if (!preAuth.success) {
                    throw new Error('Falló la pre-autorización del pago');
                }
                toast.success('Pago pre-autorizado correctamente');
            } catch (payError: any) {
                toast.dismiss('auth-toast');
                console.error('Error pago:', payError);
                throw new Error(payError.response?.data?.error || 'Error al procesar el pago. Verifica tu tarjeta.');
            }

            // Iniciar Carga
            const userId = JSON.parse(localStorage.getItem('userData') || '{}').id;
            await remoteStartOcppCharging(serialNumber, userId);
            toast.success('Comando de inicio enviado');

            // Refresh status after a moment
            setTimeout(() => loadOcppStatus(serialNumber), 3000);

        } catch (error: any) {
            toast.error(error.message || 'Error al iniciar carga remota');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoteStop = async () => {
        if (!serialNumber || !ocppStatus?.transactionId) return;

        setLoading(true);
        try {
            await remoteStopOcppCharging(serialNumber, ocppStatus.transactionId);
            toast.success('Comando de parada enviado');
            setTimeout(() => loadOcppStatus(serialNumber), 3000);
        } catch (error: any) {
            toast.error(error.message || 'Error al detener carga remota');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (type: 'Hard' | 'Soft') => {
        if (!serialNumber || !confirm(`¿Seguro que quieres hacer un reset ${type === 'Hard' ? 'duro' : 'suave'}?`)) return;

        setLoading(true);
        try {
            await resetOcppCharger(serialNumber, type);
            toast.success(`Reset ${type} ejecutado`);
        } catch (error: any) {
            toast.error(error.message || 'Error al resetear cargador');
        } finally {
            setLoading(false);
        }
    };

    const handleUnlock = async () => {
        if (!serialNumber || !confirm('¿Desbloquear el conector?')) return;

        setLoading(true);
        try {
            await unlockOcppConnector(serialNumber, 1);
            toast.success('Comando de desbloqueo enviado');
        } catch (error: any) {
            toast.error(error.message || 'Error al desbloquear');
        } finally {
            setLoading(false);
        }
    };

   /* const handleBlock = async () => {
        if (!chargerId || !confirm('¿Bloquear el cargador? Esto impedirá nuevas sesiones.')) return;

        setLoading(true);
        try {
            await toggleChargerLock(Number(chargerId), true);
            toast.success('Cargador bloqueado correctamente');
        } catch (error: any) {
            toast.error(error.message || 'Error al bloquear');
        } finally {
            setLoading(false);
        }
    };*/

    return (
        <MainLayout>
            <div className="charger-management">
                <div className="management-header">
                    <button className="back-button" onClick={() => navigate('/chargers/' + chargerId)}>← Volver</button>
                    <h1>Gestión OCPP</h1>
                </div>

                {/* Status Section (Ring Design) */}
                {ocppStatus && (
                    <div style={{ marginBottom: 25 }}>
                        <div className="premium-card status-card">
                            <h2 style={{ justifyContent: 'center' }}>📡 Estado en Vivo</h2>

                            <div className="status-ring-container">
                                <div className={`status-ring ${ocppStatus.status === 'Charging' ? 'active' : 'paused'}`}></div>
                                <div className="status-content">
                                    <span className={`status-icon ${ocppStatus.status === 'Charging' ? 'pulse-effect' : ''}`}>
                                        {ocppStatus.status === 'Charging' ? '⚡' : '🔌'}
                                    </span>
                                    <div className="status-label">Estado Actual</div>
                                    <div className="status-value-large" style={{
                                        color: ocppStatus.status === 'Available' ? '#00b894' :
                                            ocppStatus.status === 'Charging' ? '#0984e3' : '#2d3436'
                                    }}>
                                        {ocppStatus.status || 'Desconocido'}
                                    </div>
                                    {ocppStatus.transactionId && (
                                        <div style={{ fontSize: '13px', color: '#636e72', marginTop: 5 }}>
                                            Transacción: #{ocppStatus.transactionId}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, width: '100%', maxWidth: '600px', marginTop: 20 }}>
                                <div style={{ background: '#f8f9fa', padding: 15, borderRadius: 12 }}>
                                    <div style={{ fontSize: '12px', color: '#636e72', textTransform: 'uppercase' }}>Serial</div>
                                    <div style={{ fontWeight: 'bold' }}>{serialNumber}</div>
                                </div>
                                <div style={{ background: '#f8f9fa', padding: 15, borderRadius: 12 }}>
                                    <div style={{ fontSize: '12px', color: '#636e72', textTransform: 'uppercase' }}>Conector</div>
                                    <div style={{ fontWeight: 'bold' }}>Tipo 2</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="management-grid">
                    {/* Charging Control */}
                    <div className="premium-card">
                        <h2>⚡ Control de Carga</h2>
                        <div className="control-actions">
                            <button
                                className="action-btn-large btn-primary"
                                onClick={handleRemoteStart}
                                disabled={loading}
                            >
                                {loading ? 'Procesando...' : '🔌 Iniciar Carga Remota'}
                            </button>
                            <button
                                className="action-btn-large btn-danger"
                                onClick={handleRemoteStop}
                                disabled={loading || !ocppStatus?.transactionId}
                            >
                                🛑 Detener Carga Remota
                            </button>
                        </div>
                    </div>

                    {/* System Operations */}
                    <div className="premium-card">
                        <h2>🛠️ Operaciones del Sistema</h2>
                        <div className="control-actions">
                            <button
                                className="action-btn-large btn-secondary"
                                onClick={() => handleReset('Soft')}
                                disabled={loading}
                            >
                                🔄 Reset Suave (Reiniciar SW)
                            </button>
                            <button
                                className="action-btn-large btn-warning"
                                onClick={() => handleReset('Hard')}
                                disabled={loading}
                            >
                                ⚠️ Reset Duro (Reboot Físico)
                            </button>
                            
                            <button
                                className="action-btn-large btn-secondary"
                                onClick={handleUnlock}
                                disabled={loading}
                            >
                                🔓 Desbloquear Conector
                            </button>
                            
                        </div>
                    </div>
                </div>

                <div className="warning-card">
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <div>
                        <strong>Zona de Peligro:</strong> Los comandos OCPP interactúan directamente con el hardware del cargador. Úsalos solo si sabes lo que haces.
                    </div>
                </div>

                <PaymentMethodSelector
                    isOpen={showPaymentSelector}
                    onClose={() => setShowPaymentSelector(false)}
                    onSelect={handlePaymentSelected}
                />
            </div>
        </MainLayout>
    );
};

export default ChargerManagementScreen;
