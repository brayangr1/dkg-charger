import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { useWebSocket } from '@context/WebSocketContext';
import MainLayout from '@components/layout/MainLayout';
import toast from 'react-hot-toast';
import paymentService from '@services/paymentService';
import PaymentMethodSelector from '@components/payments/PaymentMethodSelector';
import './HomeScreen.css';
import { url_global } from '@constants/config';

interface Charger {
    is_blocked: any;
    id: number;
    serial_number: string;
    name: string;
    model: string;
    status: string;
    network_status: string;
    max_power: number;
    monthly_energy?: number;
    monthly_cost?: number;
    access_level: string;
}

const HomeScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { subscribeToCharger } = useWebSocket();
    const [chargers, setChargers] = useState<Charger[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPaymentSelector, setShowPaymentSelector] = useState(false);
    const [pendingCharger, setPendingCharger] = useState<{ id: number, serial: string } | null>(null);

    useEffect(() => {
        if (user) {
            fetchChargers();
        }
    }, [user]);

    useEffect(() => {
        // Subscribe to all chargers for real-time updates
        chargers.forEach(charger => {
            subscribeToCharger(charger.id);
        });
    }, [chargers, subscribeToCharger]);

    const fetchChargers = async () => {
        try {
            setLoading(true);
            const endpoint = user?.isGuest ? `${url_global}/api/chargers/mine` : `${url_global}/api/chargers/mine-with-owner`; 

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('userToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                const allChargers = data.chargers;

                // Eliminar duplicados basados en el ID del cargador
                const uniqueChargers = allChargers.filter((charger: Charger, index: number, self: Charger[]) =>
                    index === self.findIndex((c: Charger) => c.id === charger.id)
                );

                setChargers(uniqueChargers);
            }
        } catch (error) {
            //console.error('Error fetching chargers:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusClass = (status: string, networkStatus: string) => {
        if (networkStatus === 'offline') return 'status-offline';
        const s = parseInt(status);
        if (s === 1) return 'status-busy'; // Locked
        if (s === 2) return 'status-charging';
        if (s === 3) return 'status-error';
        return 'status-online';
    };

    const getStatusText = (status: string, networkStatus: string) => {
        if (networkStatus === 'offline') return 'Offline';
        const statusNum = parseInt(status);
        if (!isNaN(statusNum)) {
            switch (statusNum) {
                case 0: return 'Disponible';
                case 1: return 'Bloqueado';
                case 2: return 'Cargando';
                case 3: return 'Error';
                case 4: return 'Offline';
                default: return 'Desconocido';
            }
        }
        return status;
    };

    const handleChargerClick = (chargerId: number) => {
        navigate(`/chargers/${chargerId}`);
    };

    const handleStartCharging = (chargerId: number, serialNumber: string) => {
        setPendingCharger({ id: chargerId, serial: serialNumber });
        setShowPaymentSelector(true);
    };

    const handlePaymentSelected = async (method: any) => {
        if (!pendingCharger) return;
        setShowPaymentSelector(false);

        try {
            // Pre-autorización
            toast.loading('Autorizando pago...', { id: 'home-auth' });

            try {
                const preAuth = await paymentService.preAuthorizePayment(15.00, method.id);
                toast.dismiss('home-auth');

                if (preAuth.success) {
                    toast.success('Pago autorizado. Iniciando sesión...');
                    navigate(`${url_global}/charging/${pendingCharger.id}`, {
                        state: {
                            serialNumber: pendingCharger.serial,
                            paymentIntentId: preAuth.paymentIntentId
                        }
                    });
                } else {
                    throw new Error('No se pudo autorizar el pago');
                }
            } catch (payError: any) {
                toast.dismiss('home-auth');
                console.error('Payment Error:', payError);
                toast.error(payError.response?.data?.error || 'Error en la autorización del pago');
            }

        } catch (error) {
            console.error('Error starting charge:', error);
            toast.error('Error al iniciar el proceso de carga');
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando cargadores...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="home-screen">
                <div className="home-header">
                    <div>
                        <h1>Mis Cargadores</h1>
                        <p style={{ color: '#636e72', marginTop: '5px' }}>Gestión en tiempo real</p>
                    </div>

                    {!user?.isGuest && (
                        <div className="header-actions">
                            <button onClick={() => navigate('/chargers/add')} className="btn-primary-action">
                                <span>+</span> Vincular
                            </button>
                        </div>
                    )}
                </div>

                {chargers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🔌</div>
                        <h2>No tienes cargadores</h2>
                        <p>
                            {user?.isGuest
                                ? 'No tienes cargadores asignados'
                                : 'Añade tu primer cargador para empezar a gestionar tu energía.'}
                        </p>
                        {!user?.isGuest && (
                            <button onClick={() => navigate('/chargers/add')} className="btn-primary-action" style={{ margin: '0 auto' }}>
                                Añadir Cargador
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="chargers-grid">
                        {chargers.map((charger) => {
                            const isCharging = parseInt(charger.status) === 2;
                            const isOffline = charger.network_status === 'offline';
                            const isLocked = parseInt(charger.status) === 1;
                            const isUserBlocked = !!charger.is_blocked; // User specifically blocked by owner

                            if (isUserBlocked) {
                                return (
                                    <div
                                        key={charger.id}
                                        className="premium-card blocked-user-card"
                                        style={{ opacity: 0.8, background: '#f8f9fa' }}
                                    >
                                        <div className="card-header">
                                            <div className="charger-icon-badge" style={{ background: '#ff7675', color: 'white' }}>
                                                🔒
                                            </div>
                                            <span className="status-badge" style={{ background: '#d63031', color: 'white' }}>
                                                Acceso Restringido
                                            </span>
                                        </div>

                                        <div className="charger-main-info">
                                            <h3>{charger.name}</h3>
                                            <div className="serial-number">SN: {charger.serial_number}</div>
                                            <p style={{ color: '#d63031', fontWeight: 'bold', marginTop: '10px' }}>
                                                ⛔ Tu usuario ha sido bloqueado en este cargador
                                            </p>
                                        </div>

                                        <div className="card-footer">
                                            <button className="btn-action-charge" disabled style={{ background: '#b2bec3', cursor: 'not-allowed' }}>
                                                Contacta al Propietario
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={charger.id}
                                    className="premium-card"
                                    onClick={() => handleChargerClick(charger.id)}
                                >
                                    <div className="card-header">
                                        <div className="charger-icon-badge">
                                            ⚡
                                        </div>
                                        <span className={`status-badge ${getStatusClass(charger.status, charger.network_status)}`}>
                                            {getStatusText(charger.status, charger.network_status)}
                                        </span>
                                    </div>

                                    <div className="charger-main-info">
                                        <h3>{charger.name}</h3>
                                        <div className="serial-number">SN: {charger.serial_number}</div>
                                    </div>

                                    <div className="stats-container">
                                        <div className="stat-item">
                                            <span className="stat-label">Potencia Max</span>
                                            <span className="stat-value">{charger.max_power} A</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Energía Mes</span>
                                            <span className="stat-value">
                                                {charger.monthly_energy ? Number(charger.monthly_energy).toFixed(1) : '0.0'} <small>kWh</small>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="card-footer">
                                        <button
                                            className={`btn-action-charge ${isCharging ? 'charging' : ''}`}
                                            disabled={isOffline || isLocked}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isCharging) handleStartCharging(charger.id, charger.serial_number);
                                            }}
                                        >
                                            {isCharging ? '⚡ Monitorizar Carga' :
                                                isOffline ? 'Offline' :
                                                    isLocked ? '🔒 Desbloquear en App' :
                                                        '⚡ Iniciar Carga'}
                                        </button>
                                    </div>
                                    - </div>
                            );
                        })}
                    </div>
                )}

                <PaymentMethodSelector
                    isOpen={showPaymentSelector}
                    onClose={() => setShowPaymentSelector(false)}
                    onSelect={handlePaymentSelected}
                />
            </div>
        </MainLayout>
    );
};

export default HomeScreen;
