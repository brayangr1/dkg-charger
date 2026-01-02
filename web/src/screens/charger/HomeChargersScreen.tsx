import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import { getHomeChargers, removeHomeCharger, getMyChargers, setChargerUsageType } from '@services/chargerService';
import toast from 'react-hot-toast';
import './HomeChargersScreen.css';

interface HomeCharger {
    id: number;
    name: string;
    serial_number: string;
    created_at: string;
    status?: string | number;
    model?: string;
}

interface UserCharger {
    id: number;
    name: string;
    serial_number: string;
    model: string;
}

const HomeChargersScreen: React.FC = () => {
    const navigate = useNavigate();
    const [chargers, setChargers] = useState<HomeCharger[]>([]);
    const [userChargers, setUserChargers] = useState<UserCharger[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [setupLoading, setSetupLoading] = useState(false);

    useEffect(() => {
        loadChargers();
    }, []);

    const loadChargers = async () => {
        try {
            setLoading(true);
            const data = await getHomeChargers();
            const responseData = data as any;
            if (responseData && responseData.chargers) {
                setChargers(responseData.chargers);
            }
        } catch (error) {
            console.error('Error loading home chargers:', error);
            toast.error('Error al cargar los cargadores hogar');
        } finally {
            setLoading(false);
        }
    };

    const loadUserChargers = async () => {
        try {
            setSetupLoading(true);
            const data = await getMyChargers();
            if (data && data.chargers) {
                const allChargers = data.chargers;
                const uniqueChargers = allChargers.filter((charger: UserCharger, index: number, self: UserCharger[]) =>
                    index === self.findIndex((c: UserCharger) => c.id === charger.id)
                );
                setUserChargers(uniqueChargers);
            }
        } catch (error) {
            console.error('Error loading user chargers:', error);
            toast.error('No se pudieron cargar tus cargadores');
        } finally {
            setSetupLoading(false);
        }
    };

    const openSetupModal = () => {
        setShowSetupModal(true);
        loadUserChargers();
    };

    const handleSetAsHome = async (charger: UserCharger) => {
        if (chargers.some(c => c.id === charger.id)) {
            toast('Este cargador ya es un cargador hogar', { icon: 'ℹ️' });
            return;
        }

        try {
            toast.loading('Configurando...', { id: 'setup-home' });
            await setChargerUsageType(charger.id, 'home');
            toast.success('¡Configurado como Hogar!', { id: 'setup-home' });
            await loadChargers();
            setShowSetupModal(false);
        } catch (error) {
            console.error('Error setting home charger:', error);
            toast.error('Error al configurar cargador', { id: 'setup-home' });
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`¿Estás seguro de eliminar "${name}" de tus cargadores hogar?`)) return;

        try {
            toast.loading('Eliminando...', { id: 'delete-charger' });
            await removeHomeCharger(id);
            toast.success('Cargador eliminado correctamente', { id: 'delete-charger' });
            loadChargers();
        } catch (error) {
            console.error('Error removing home charger:', error);
            toast.error('No se pudo eliminar el cargador', { id: 'delete-charger' });
        }
    };

    const handleStartCharging = (id: number) => {
        navigate(`/charging/${id}`);
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="home-chargers-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                    <div className="pulse-effect" style={{ width: 50, height: 50, borderRadius: '50%', background: '#00d2ff' }}></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="home-chargers-container">
                <div className="home-chargers-header">
                    <div className="header-title-group">
                        <h1>Cargadores Hogar</h1>
                        <p className="header-subtitle">Administra y accede rápidamente a tus puntos de recarga personales.</p>
                    </div>
                    <button onClick={openSetupModal} className="btn-add-charger">
                        <span>+</span> Configurar Nuevo
                    </button>
                </div>

                {chargers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🏠</div>
                        <h2>No tienes cargadores hogar</h2>
                        <p style={{ color: '#666', marginBottom: '30px' }}>
                            Configura un cargador existente como "Hogar" para acceder a él rápidamente.
                        </p>
                        <button onClick={openSetupModal} className="btn-add-charger" style={{ margin: '0 auto' }}>
                            Configurar Cargador
                        </button>
                    </div>
                ) : (
                    <div className="chargers-grid">
                        {chargers.map((charger) => (
                            <div key={charger.id} className="charger-card">
                                <div className="card-header">
                                    <div className="charger-icon-wrapper">
                                        ⚡
                                    </div>
                                    <span className={`charger-status-badge ${charger.status === 'charging' ? 'status-charging' : 'status-online'}`}>
                                        {charger.status === 'charging' ? 'Cargando' : 'Disponible'}
                                    </span>
                                </div>

                                <div className="charger-info">
                                    <h3>{charger.name}</h3>
                                    <div className="charger-serial">SN: {charger.serial_number}</div>
                                </div>

                                <div className="card-actions">
                                    <button
                                        className="btn-charge"
                                        onClick={() => handleStartCharging(charger.id)}
                                    >
                                        <span>⚡</span> Cargar
                                    </button>
                                    <button
                                        className="btn-delete"
                                        onClick={() => handleDelete(charger.id, charger.name)}
                                        title="Quitar de hogar"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Setup Modal */}
                {showSetupModal && (
                    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSetupModal(false) }}>
                        <div className="modal-content">
                            <div className="modal-header">
                                <h3>Configurar Cargador Hogar</h3>
                                <button className="btn-close" onClick={() => setShowSetupModal(false)}>×</button>
                            </div>

                            <div className="modal-body">
                                <p style={{ color: '#666', marginBottom: '20px' }}>
                                    Selecciona uno de tus cargadores registrados.
                                </p>

                                {setupLoading ? (
                                    <p style={{ textAlign: 'center' }}>Cargando cargadores...</p>
                                ) : userChargers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>
                                        <p>No tienes cargadores registrados.</p>
                                        <button className="btn-select" onClick={() => navigate('/chargers/add')}>
                                            Vincular Nuevo
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {userChargers.map(uc => {
                                            const isHome = chargers.some(c => c.id === uc.id);
                                            return (
                                                <div key={uc.id} className={`charger-item ${isHome ? 'is-home' : ''}`}>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', color: '#2d3436' }}>{uc.name}</div>
                                                        <small style={{ color: '#b2bec3' }}>{uc.model || 'Cargador DKG'}</small>
                                                    </div>
                                                    {isHome ? (
                                                        <span className="badge-home">✓ Hogar</span>
                                                    ) : (
                                                        <button className="btn-select" onClick={() => handleSetAsHome(uc)}>
                                                            Seleccionar
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default HomeChargersScreen;
