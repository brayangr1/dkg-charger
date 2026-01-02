import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import toast from 'react-hot-toast';
import walletService, { Wallet, Transaction } from '@services/walletService';
import { getUserData } from '@services/authService';
import './WalletScreen.css';

const WalletScreen: React.FC = () => {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadWalletData();
    }, []);

    const loadWalletData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            const user = await getUserData();
            if (!user) {
                setError('No se encontraron datos de usuario');
                setLoading(false);
                return;
            }

            const userWallet = await walletService.getWallet(user.id);
            setWallet(userWallet);

            if (userWallet) {
                const userTransactions = await walletService.getTransactions(userWallet.id);
                setTransactions(userTransactions);
            }
        } catch (error) {
            console.error('Error loading wallet:', error);
            setError('No se pudieron cargar los datos de la wallet');
            toast.error('No se pudieron cargar los datos de la wallet');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadWalletData();
    };

    const handleCreateWallet = () => {
        navigate('/wallet/create');
    };

    const handleAddFunds = () => {
        navigate('/wallet/add-funds');
    };

    const handleDeleteWallet = async () => {
        if (!wallet || !confirm('¿Estás seguro de que deseas eliminar tu wallet? Esta acción no se puede deshacer.')) return;

        try {
            await walletService.deleteWallet(wallet.id);
            setWallet(null);
            setTransactions([]);
            toast.success('✅ Wallet eliminada correctamente');
        } catch (error) {
            console.error('Error deleting wallet:', error);
            toast.error('No se pudo eliminar la wallet');
        }
    };

    const handleViewAllTransactions = () => {
        navigate('/wallet/transactions');
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando wallet...</p>
                </div>
            </MainLayout>
        );
    }

    if (!wallet) {
        return (
            <MainLayout>
                <div className="wallet-empty">
                    <div className="empty-icon">💳</div>
                    <h1>Aún no tienes una wallet</h1>
                    <p>Crea tu wallet para gestionar tus fondos y realizar pagos de carga fácilmente</p>
                    <Button variant="primary" size="lg" onClick={handleCreateWallet}>
                        ✨ Crear Wallet
                    </Button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="wallet-screen">
                <div className="wallet-header">
                    <h1>💼 Mi Wallet</h1>
                    <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing}>
                        🔄 {refreshing ? 'Actualizando...' : 'Actualizar'}
                    </button>
                </div>

                {/* Wallet Card */}
                <Card>
                    <div className="wallet-card">
                        <div className="wallet-title">Wallet Digital</div>
                        <div className="wallet-balance">
                            <span className="currency">€</span>
                            <span className="amount">{wallet.balance.toFixed(2)}</span>
                        </div>
                        <div className="balance-label">Saldo disponible</div>

                        <div className="wallet-info">
                            <div className="info-row">
                                <span className="label">ID:</span>
                                <span className="value">{wallet.id.substring(0, 12)}...</span>
                            </div>
                            {wallet.nfcToken && (
                                <div className="info-row">
                                    <span className="label">Token NFC:</span>
                                    <span className="value">{wallet.nfcToken.substring(0, 12)}...</span>
                                </div>
                            )}
                        </div>

                        <div className="wallet-actions">
                            <Button variant="primary" onClick={handleAddFunds} fullWidth>
                                💵 Agregar Fondos
                            </Button>
                            <Button variant="danger" onClick={handleDeleteWallet} fullWidth>
                                🗑️ Eliminar Wallet
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Recent Transactions */}
                <Card>
                    <div className="transactions-header">
                        <h2>💸 Últimas Transacciones</h2>
                        {transactions.length > 5 && (
                            <button className="view-all-btn" onClick={handleViewAllTransactions}>
                                Ver todas →
                            </button>
                        )}
                    </div>

                    {transactions.length === 0 ? (
                        <div className="no-transactions">
                            <p>No hay transacciones aún</p>
                        </div>
                    ) : (
                        <div className="transactions-list">
                            {transactions.slice(0, 5).map((transaction) => (
                                <div key={transaction.id} className="transaction-item">
                                    <div className="transaction-info">
                                        <div className="transaction-icon">
                                            {transaction.type === 'DEPOSIT' ? '💰' : '⚡'}
                                        </div>
                                        <div>
                                            <div className="transaction-description">{transaction.description}</div>
                                            <div className="transaction-date">
                                                {new Date(transaction.createdAt).toLocaleDateString('es-ES', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`transaction-amount ${transaction.type === 'DEPOSIT' ? 'positive' : 'negative'}`}>
                                        {transaction.type === 'DEPOSIT' ? '+' : '-'}€{Math.abs(transaction.amount).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Info Card */}
                <Card>
                    <div className="info-section">
                        <h3>ℹ️ ¿Cómo usar tu Wallet?</h3>
                        <ul className="info-list">
                            <li>💳 Agrega fondos usando tu tarjeta de crédito o débito</li>
                            <li>⚡ El saldo se deduce automáticamente al cargar tu vehículo</li>
                            <li>📊 Consulta el historial completo de transacciones</li>
                            <li>🔒 Tus fondos están seguros y encriptados</li>
                        </ul>
                    </div>
                </Card>
            </div>
        </MainLayout>
    );
};

export default WalletScreen;
