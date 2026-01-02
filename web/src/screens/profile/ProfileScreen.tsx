import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import { useAuth } from '@context/AuthContext';
import { getMyChargers } from '@services/chargerService';
//import walletService from '@services/walletService';
import './ProfileScreen.css';

const ProfileScreen: React.FC = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    //const [balance, setBalance ] = useState<number>(0);
    const [stats, setStats] = useState({
        totalCharges: 0,
        totalEnergy: 0,
        moneySaved: 0,
        chargerCount: 0
    });

    useEffect(() => {
        if (user) {
            loadUserData();
        }
    }, [user]);

    const loadUserData = async () => {
        try {
            const chargersData = await getMyChargers();

            // Filter unique chargers to avoid duplicates from backend joins
            const uniqueChargers = chargersData.chargers
                ? Array.from(new Set(chargersData.chargers.map((c: any) => c.id)))
                : [];

            // Mock stats for now - in real app fetch from stats service
            setStats({
                totalCharges: 12,
                totalEnergy: 450.5,
                moneySaved: 125.40,
                chargerCount: uniqueChargers.length
            });

            if (user?.id) {
                // const userId = parseInt(user.id);
                // if (!isNaN(userId)) {
                //     const wallet = await walletService.getWallet(userId);
                //     if (wallet) {
                //         setBalance(wallet.balance);
                //     }
                // }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            setStats(prev => ({ ...prev, chargerCount: 0 }));
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <MainLayout>
            <div className="profile-screen">
                <div className="profile-header-bg"></div>

                <div className="profile-content">
                    <Card>
                        <div className="profile-info">
                            <div className="avatar-container">
                                <div className="avatar">
                                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                {/* <button className="edit-avatar-btn">📷</button> */}
                            </div>

                            <h1 className="user-name">{user.name || user.firstName}</h1>
                            <p className="user-email">{user.email}</p>


                            <div className="profile-actions">
                                <Button variant="outline" onClick={() => navigate('/profile/edit')}>
                                    Perfil
                                </Button>
                                <Button variant="outline" onClick={() => navigate('/profile/password')}>
                                    🔒 Cambiar Contraseña
                                </Button>
                                <Button variant="outline" onClick={() => navigate('/profile/billing')}>
                                    Datos de Facturacion
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <div className="stats-grid">
                        <Card>
                            <div className="stat-item">
                                <div className="stat-icon charging-station">🔌</div>
                                <div className="stat-value">{stats.chargerCount}</div>
                                <div className="stat-label">Cargadores</div>

                            </div>
                        </Card>

                        <Card>
                            <div className="stat-item">
                                <div className="stat-icon energy">⚡</div>
                                <div className="stat-value">{stats.totalEnergy.toFixed(1)} kWh</div>
                                <div className="stat-label">Energía Total</div>
                            </div>
                        </Card>

                        <Card>
                            <div className="stat-item">
                                <div className="stat-icon charges">🔋</div>
                                <div className="stat-value">{stats.totalCharges}</div>
                                <div className="stat-label">Cargas Realizadas</div>
                            </div>
                        </Card>
                    </div>

                    <Card>
                        <div className="menu-list">
                            {/*<div className="menu-item" onClick={() => navigate('/wallet')}>
                                <span className="menu-icon">💳</span>
                                <span className="menu-text">Mi Wallet</span>
                                <span className="menu-arrow">›</span>
                            </div>*/}
                            <div className="menu-item" onClick={() => navigate('/payments/history')}>
                                <span className="menu-icon">📄</span>
                                <span className="menu-text">Facturas</span>
                                <span className="menu-arrow">›</span>
                            </div>
                            <div className="menu-item" onClick={() => navigate('/chargers/mine')}>
                                <span className="menu-icon">🔌</span>
                                <span className="menu-text">Mis Cargadores</span>
                                <span className="menu-arrow">›</span>
                            </div>
                            <div className="menu-item" onClick={() => navigate('/support')}>
                                <span className="menu-icon">❓</span>
                                <span className="menu-text">Ayuda y Soporte</span>
                                <span className="menu-arrow">›</span>
                            </div>
                            <div className="menu-item logout" onClick={handleLogout}>
                                <span className="menu-icon">🚪</span>
                                <span className="menu-text">Cerrar Sesión</span>
                            </div>
                        </div>
                    </Card>

                    <div className="app-version">
                        Versión 1.0.0 (Build 2025.12)
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default ProfileScreen;
