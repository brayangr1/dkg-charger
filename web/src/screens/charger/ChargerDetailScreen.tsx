import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import toast from 'react-hot-toast';
import './ChargerDetailScreen.css';
import { url_global } from '@constants/config';

interface ChargerDetails {
    id: number;
    serial_number: string;
    name: string;
    model: string;
    max_power: number;
    firmware_version: string;
    status: string;
    network_status: string;
    rate_per_kwh?: number;
    energy_limit?: number;
    monthly_energy?: number;
    access_level?: string;
    charger_vendor?: string;
    charger_ip?: string;
}

interface Schedule {
    id: number;
    schedule_name: string;
    start_time: string;
    end_time: string;
    week_days: string[];
}

const ChargerDetailScreen: React.FC = () => {
    const { chargerId } = useParams<{ chargerId: string }>();
    const navigate = useNavigate();
    const [charger, setCharger] = useState<ChargerDetails | null>(null);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (chargerId) {
            fetchChargerDetails();
        }
    }, [chargerId]);

    const fetchChargerDetails = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${url_global}/api/chargers/${chargerId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('userToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setCharger(data.charger);
                setSchedules(data.schedules || []);
            } else {
                toast.error('No se pudo obtener la información del cargador');
                navigate('/');
            }
        } catch (error) {
            console.error('Error fetching charger details:', error);
            toast.error('Error de conexión');
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const getStatusText = (status: string) => {
        const statusNum = parseInt(status);
        if (!isNaN(statusNum)) {
            switch (statusNum) {
                case 1: return 'Bloqueado';
                case 2: return 'Cargando';
                case 3: return 'Fallo';
                case 4: return 'Offline';
                case 0: return 'Disponible';
                default: return 'Desconocido';
            }
        }
        return status;
    };

    const getStatusClass = (status: string, netStatus: string) => {
        if (netStatus !== 'online') return 'offline';
        const s = parseInt(status);
        if (s === 2) return 'charging';
        if (s === 3) return 'error';
        return 'online';
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando detalles...</p>
                </div>
            </MainLayout>
        );
    }

    if (!charger) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <h2>Cargador no encontrado</h2>
                    <button className="back-btn-modern" onClick={() => navigate('/')}>Volver al inicio</button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="charger-detail-enhanced">
                {/* Header */}
                <div className="screen-header">
                    <button className="back-btn-modern" onClick={() => navigate('/')}>
                        <span>←</span> Volver
                    </button>
                    <h1>Detalles del Dispositivo</h1>
                </div>

                {/* Hero Card */}
                <div className="hero-status-card">
                    <div className="hero-info">
                        <div>MODELO {charger.model}</div>
                        <div className="hero-charger-name">{charger.name}</div>
                        <div className="hero-badges">
                            <div className={`status-badge ${getStatusClass(charger.status, charger.network_status)}`}>
                                <span style={{ fontSize: '18px' }}>
                                    {charger.network_status !== 'online' ? '📡' :
                                        charger.status === '2' ? '⚡' : '●'}
                                </span>
                                {charger.network_status !== 'online' ? 'OFFLINE' : getStatusText(charger.status).toUpperCase()}
                            </div>
                            <div className="status-badge" style={{ background: '#f1f2f6', color: '#2d3436' }}>
                                🆔 {charger.serial_number}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="detail-grid-layout">
                    {/* Left Column: Data */}
                    <div className="left-column">
                        <div className="content-card">
                            <h2>📊 Resumen de Energía</h2>
                            <div className="energy-highlight">
                                <div className="energy-big-number">
                                    {charger.monthly_energy ? Number(charger.monthly_energy).toFixed(2) : '0.00'} kWh
                                </div>
                                <div className="energy-subtitle">Consumo acumulado este mes</div>
                            </div>
                            <button className="dashboard-btn" onClick={() => navigate(`${url_global}/chargers/${chargerId}/history`)}>
                                <span>Ver Historial Detallado</span>
                                <span>➝</span>
                            </button>
                        </div>

                        <div className="content-card">
                            <h2>🛠️ Especificaciones Técnicas</h2>
                            <div className="specs-list">
                                <div className="spec-item">
                                    <span className="spec-label">Potencia Max</span>
                                    <span className="spec-value">{charger.max_power} A</span>
                                </div>
                                <div className="spec-item">
                                    <span className="spec-label">Límite Energía</span>
                                    <span className="spec-value">{charger.energy_limit ? `${charger.energy_limit} kWh` : '∞'}</span>
                                </div>
                                <div className="spec-item">
                                    <span className="spec-label">Tarifa</span>
                                    <span className="spec-value">
                                        {charger.rate_per_kwh !== undefined && charger.rate_per_kwh !== null
                                            ? `${Number(charger.rate_per_kwh).toFixed(4)} €/kWh`
                                            : <span style={{ color: '#b2bec3' }}>Sin Tarifas</span>}
                                    </span>
                                </div>
                                <div className="spec-item">
                                    <span className="spec-label">IP Local</span>
                                    <span className="spec-value">{charger.charger_ip || 'N/A'}</span>
                                </div>
                                <div className="spec-item">
                                    <span className="spec-label">Firmware</span>
                                    <span className="spec-value">{charger.firmware_version || 'v1.0'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div className="right-column">
                        <div className="content-card">
                            <h2>⚡ Acciones Rápidas</h2>
                            <div className="action-grid-buttons">
                                <button className="dashboard-btn primary" onClick={() => navigate(`/chargers/${chargerId}/manage`)}>
                                    <span>Gestión OCPP (Carga)</span>
                                    <span>🔌</span>
                                </button>
                                <button className="dashboard-btn" onClick={() => navigate(`/chargers/${chargerId}/settings`)}>
                                    <span>Configuración General</span>
                                    <span>⚙️</span>
                                </button>
                                <button className="dashboard-btn" onClick={() => navigate(`/invitations/manage`)}>
                                    <span>Gestión de Invitados</span>
                                    <span>👥</span>
                                </button>
                                <button className="dashboard-btn" onClick={() => navigate(`/chargers/${chargerId}/scheduling`)}>
                                    <span>Programar Carga</span>
                                    <span>📅</span>
                                </button>
                            </div>
                        </div>

                        {schedules.length > 0 && (
                            <div className="content-card">
                                <h2>📅 Próximas Cargas</h2>
                                <div>
                                    {schedules.slice(0, 3).map(s => (
                                        <div key={s.id} className="schedule-item-modern">
                                            <div>
                                                <div className="sched-time">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</div>
                                                <div className="sched-days">{s.week_days.length === 7 ? 'Todos los días' : s.week_days.join(', ')}</div>
                                            </div>
                                            <span style={{ fontSize: '20px' }}>⏰</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default ChargerDetailScreen;
