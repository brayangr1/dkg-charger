import React from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';

const OfflineChargingScreen: React.FC = () => {
    const navigate = useNavigate();

    return (
        <MainLayout>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <button className="back-button" onClick={() => navigate('/')}>
                        ← Volver
                    </button>
                    <h1 style={{ margin: 0 }}>Carga Offline</h1>
                </div>

                <Card>
                    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                        <div style={{ fontSize: '64px', marginBottom: '1.5rem' }}>📴</div>
                        <h2>Modo Offline Disponible en App Móvil</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                            La carga offline (sin conexión a internet) está disponible únicamente<br />
                            en la aplicación móvil con cargadores domésticos configurados.
                        </p>
                        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                            <strong>Características del Modo Offline:</strong><br />
                            • Carga sin conexión a internet<br />
                            • Almacenamiento local de datos<br />
                            • Sincronización automática al reconectar<br />
                            • Facturación diferida
                        </p>
                    </div>
                </Card>
            </div>
        </MainLayout>
    );
};

export default OfflineChargingScreen;
