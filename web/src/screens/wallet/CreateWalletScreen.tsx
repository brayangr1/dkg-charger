import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import toast from 'react-hot-toast';
import walletService from '@services/walletService';
import './CreateWalletScreen.css';

const CreateWalletScreen: React.FC = () => {
    const [creating, setCreating] = useState(false);
    const navigate = useNavigate();

    const handleCreateWallet = async () => {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            toast.error('Usuario no autenticado');
            return;
        }

        try {
            setCreating(true);
            const user = JSON.parse(userStr);
            await walletService.createWallet(user.id);

            toast.success('✅ Wallet creada exitosamente!');
            setTimeout(() => navigate('/wallet'), 1500);
        } catch (error: any) {
            console.error('Error creating wallet:', error);
            toast.error(error.message || 'Error al crear wallet');
        } finally {
            setCreating(false);
        }
    };

    return (
        <MainLayout>
            <div className="create-wallet-screen">
                <div className="create-wallet-header">
                    <button className="back-button" onClick={() => navigate('/wallet')}>
                        ← Volver
                    </button>
                    <h1>Crear Wallet Digital</h1>
                </div>

                <Card>
                    <div className="create-wallet-content">
                        <div className="wallet-icon">💳</div>
                        <h2>Tu Wallet Digital</h2>
                        <p className="description">
                            Una wallet digital te permite gestionar tus fondos de forma segura y realizar pagos
                            de carga de manera rápida y sencilla.
                        </p>

                        <div className="features-list">
                            <div className="feature-item">
                                <span className="icon">🔒</span>
                                <div>
                                    <h3>Segura</h3>
                                    <p>Tus fondos están protegidos con encriptación de nivel bancario</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <span className="icon">⚡</span>
                                <div>
                                    <h3>Rápida</h3>
                                    <p>Paga automáticamente al cargar tu vehículo eléctrico</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <span className="icon">📊</span>
                                <div>
                                    <h3>Transparente</h3>
                                    <p>Consulta el historial completo de todas tus transacciones</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <span className="icon">💰</span>
                                <div>
                                    <h3>Flexible</h3>
                                    <p>Agrega o retira fondos cuando lo necesites</p>
                                </div>
                            </div>
                        </div>

                        <div className="terms">
                            <p>
                                Al crear tu wallet, aceptas nuestros términos y condiciones de uso.
                                No se aplicarán cargos por la creación de la wallet.
                            </p>
                        </div>

                        <Button
                            variant="primary"
                            size="lg"
                            onClick={handleCreateWallet}
                            loading={creating}
                            disabled={creating}
                            fullWidth
                        >
                            {creating ? 'Creando...' : '✨ Crear Mi Wallet'}
                        </Button>
                    </div>
                </Card>
            </div>
        </MainLayout>
    );
};

export default CreateWalletScreen;
