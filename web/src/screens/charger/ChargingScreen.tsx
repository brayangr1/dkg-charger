import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import toast from 'react-hot-toast';
import {
    getActiveChargingSession,
    remoteStartOcppCharging,
    remoteStopOcppCharging,
    getOcppChargerStatus
} from '@services/chargerService';
import { useAuth } from '@context/AuthContext';
import './ChargingScreen.css';

interface RealTimeData {
    energy: number;
    power: number;
    cost: number;
    duration: number;
}

const ChargingScreen: React.FC = () => {
    const { chargerId } = useParams<{ chargerId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [chargerInfo, setChargerInfo] = useState<any>(null);
    const [ocppTransactionId, setOcppTransactionId] = useState<string | number | null>(null);
    const [realTimeData, setRealTimeData] = useState<RealTimeData>({
        energy: 0,
        power: 0,
        cost: 0,
        duration: 0
    });
    const [loading, setLoading] = useState(false);
    const [/*zeroPowerCount*/, setZeroPowerCount] = useState(0); // Contador para detener carga auto
    const [autoStopTriggered, setAutoStopTriggered] = useState(false);

    useEffect(() => {
        if (chargerId) {
            loadChargerInfo();
        }
    }, [chargerId]);

    useEffect(() => {
        if (!ocppTransactionId || !chargerInfo?.serial_number) return;

        const interval = setInterval(async () => {
            try {
                const sessionData = await getActiveChargingSession(chargerInfo.serial_number) as any;
                if (sessionData?.session) {
                    const newData = {
                        energy: Number(sessionData.session.totalEnergy) || 0,
                        power: Number(sessionData.session.currentPower) || 0,
                        cost: Number(sessionData.session.estimatedCost) || 0,
                        duration: Number(sessionData.session.elapsedSeconds) || 0
                    };
                    setRealTimeData(newData);

                    // Auto-stop logic: Si potencia es 0 por más de 4 consultas (12 segundos) y ya pasó 1 minuto
                    if (newData.power === 0 && newData.duration > 60) {
                        setZeroPowerCount(prevCount => {
                            const nextCount = prevCount + 1;

                            // Si lleva más de 4 lecturas con potencia 0, auto-detener
                            if (nextCount >= 4 && !autoStopTriggered) {
                                setAutoStopTriggered(true);
                                toast.success('Carga completada detectada. Deteniendo sesión automáticamente...');
                                setTimeout(() => handleRemoteStop(), 500);
                            }
                            return nextCount;
                        });
                    } else {
                        // Reset counter si hay potencia
                        setZeroPowerCount(0);
                    }
                }
            } catch (error) {
                console.error('Error fetching real-time data:', error);
            }
        }, 3000); // Update every 3 seconds

        return () => clearInterval(interval);
    }, [ocppTransactionId, chargerInfo?.serial_number, autoStopTriggered]);

    const loadChargerInfo = async () => {
        try {
            const response = await fetch(`/api/chargers/${chargerId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('userToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setChargerInfo(data.charger);

                // Load OCPP status
                const ocppStatus = await getOcppChargerStatus(data.charger.serial_number) as any;
                if (ocppStatus?.charger?.activeTransactionId) {
                    setOcppTransactionId(ocppStatus.charger.activeTransactionId);
                }
            } else {
                toast.error('Error al cargar información del cargador');
                navigate('/');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error de conexión');
        }
    };

    const handleRemoteStart = async () => {
        if (!chargerInfo?.serial_number || !user?.id) {
            toast.error('Información insuficiente para iniciar carga');
            return;
        }

        setLoading(true);
        try {
            const userId = parseInt(user.id, 10);
            const result = await remoteStartOcppCharging(chargerInfo.serial_number, userId) as any;

            if (result?.success) {
                toast.success('Carga iniciada');
                setTimeout(() => loadChargerInfo(), 2000);
            } else {
                toast.error(result?.error || 'Error al iniciar carga');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error al iniciar carga');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoteStop = async () => {
        if (!chargerInfo?.serial_number || !ocppTransactionId) {
            toast.error('No hay transacción activa');
            return;
        }

        setLoading(true);
        try {
            const result = await remoteStopOcppCharging(chargerInfo.serial_number, ocppTransactionId) as any;

            if (result?.success) {
                toast.success('Carga detenida');
                setOcppTransactionId(null);
                setRealTimeData({ energy: 0, power: 0, cost: 0, duration: 0 });
            } else {
                toast.error(result?.error || 'Error al detener carga');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error al detener carga');
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        }
        return `${minutes}m ${secs}s`;
    };

    if (!chargerInfo) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando información del cargador...</p>
                </div>
            </MainLayout>
        );
    }

    // Determine status text/class
    // Ahora mantenemos el estado 'active' siempre que haya una transacción (ocppTransactionId no sea null)
    // Independientemente de si la potencia es > 0 o no.
    const isSessionActive = !!ocppTransactionId;
    const statusClass = isSessionActive ? 'active' : 'standby';

    return (
        <MainLayout>
            <div className="charging-screen">
                <div className="charging-header">
                    <h1>Monitor de Carga</h1>
                    <button className="back-button" onClick={() => navigate('/chargers/' + chargerId)}>
                        ← SALIR
                    </button>
                </div>

                <div className="dashboard-grid">
                    {/* Main Status Panel */}
                    <div className="status-panel">
                        <div className="charger-model-badge">{chargerInfo.model}</div>

                        <div className="status-ring-container">
                            <div className={`status-ring ${statusClass}`}></div>
                            <div className="status-content">
                                {isSessionActive ? (
                                    <>
                                        <span className="status-icon pulse-effect">⚡</span>
                                        <div className="status-label">Potencia Actual</div>
                                        <div className="status-value-large">{realTimeData.power.toFixed(2)} kW</div>
                                    </>
                                ) : (
                                    <>
                                        <span className="status-icon">🔌</span>
                                        <div className="status-label">Estado</div>
                                        <div className="status-value-large">
                                            STANDBY
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="metrics-row">
                            <div className="metric-item">
                                <span className="metric-icon">🔋</span>
                                <div className="metric-title">Energía</div>
                                <div className="metric-data">{realTimeData.energy.toFixed(2)} <small>kWh</small></div>
                            </div>
                            <div className="metric-item">
                                <span className="metric-icon">⏱️</span>
                                <div className="metric-title">Tiempo</div>
                                <div className="metric-data">
                                    {realTimeData.duration > 0 ? formatDuration(realTimeData.duration) : '--:--'}
                                </div>
                            </div>
                            <div className="metric-item">
                                <span className="metric-icon">📊</span>
                                <div className="metric-title">Potencia Max</div>
                                <div className="metric-data">{chargerInfo.max_power} <small>A</small></div>
                            </div>
                            <div className="metric-item">
                                <span className="metric-icon">🌡️</span>
                                <div className="metric-title">Conector</div>
                                <div className="metric-data">Tipo 2</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Control Panel */}
                    <div className="control-panel">
                        <div className="info-card">
                            <h3>Coste Estimado</h3>
                            <div className="cost-display">
                                <div className="cost-amount">€{realTimeData.cost.toFixed(2)}</div>
                                <div className="cost-label">Sesión Actual</div>
                            </div>
                        </div>

                        <div className="info-card">
                            <h3>Control de Sesión</h3>
                            <div className="action-buttons">
                                {!ocppTransactionId ? (
                                    <button
                                        className="btn-start"
                                        onClick={handleRemoteStart}
                                        disabled={loading}
                                    >
                                        {loading ? 'Iniciando...' : '▶ Iniciar Carga'}
                                    </button>
                                ) : (
                                    <button
                                        className="btn-stop"
                                        onClick={handleRemoteStop}
                                        disabled={loading}
                                    >
                                        {loading ? 'Deteniendo...' : '⏹ Finalizar Sesión'}
                                    </button>
                                )}
                            </div>
                            {/* Hidden/Disabled info if needed */}
                        </div>

                        <div className="info-card" style={{ opacity: 0.7 }}>
                            <h3>Detalles</h3>
                            <p style={{ color: '#aaa', margin: '5px 0' }}>Serial: {chargerInfo.serial_number}</p>
                            <p style={{ color: '#aaa', margin: '5px 0' }}>Tarifa: €0.25/kWh</p>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default ChargingScreen;
