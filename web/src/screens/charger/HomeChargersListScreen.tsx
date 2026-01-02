import React from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';

const HomeChargersListScreen: React.FC = () => {
    const navigate = useNavigate();

    return (
        <MainLayout>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <button className="back-button" onClick={() => navigate('/')}>
                        ← Volver
                    </button>
                    <h1 style={{ margin: 0 }}>Cargadores Hogar</h1>
                </div>

                <Card>
                    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                        <div style={{ fontSize: '64px', marginBottom: '1.5rem' }}>🏠</div>
                        <h2>Gestión de Cargadores Hogar</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                            Los cargadores domésticos se configuran mediante la aplicación móvil.<br />
                            Esta funcionalidad estará disponible próximamente en la versión web.
                        </p>
                        <Button variant="outline" onClick={() => navigate('/')}>
                            Volver al Inicio
                        </Button>
                    </div>
                </Card>
            </div>
        </MainLayout>
    );
};

export default HomeChargersListScreen;
