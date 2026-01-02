import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import toast from 'react-hot-toast';
import walletService, { Transaction, Wallet } from '@services/walletService';
import { getUserData } from '@services/authService';
import Button from '@components/common/Button';
import './TransactionHistoryScreen.css';

const TransactionHistoryScreen: React.FC = () => {
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [filter, setFilter] = useState<'ALL' | 'DEPOSIT' | 'CHARGE' | 'REFUND'>('ALL');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        applyFilter();
    }, [filter, transactions]);

    const loadData = async () => {
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

            if (!userWallet) {
                toast.error('No se encontró la wallet');
                navigate('/wallet');
                return;
            }

            setWallet(userWallet);
            const allTransactions = await walletService.getTransactions(userWallet.id);
            setTransactions(allTransactions);
        } catch (error) {
            console.error('Error loading transactions:', error);
            setError('Error al cargar transacciones');
            toast.error('Error al cargar transacciones');
        } finally {
            setLoading(false);
        }
    };

    const applyFilter = () => {
        if (filter === 'ALL') {
            setFilteredTransactions(transactions);
        } else {
            setFilteredTransactions(transactions.filter(t => t.type === filter));
        }
    };

    const getTransactionIcon = (type: string) => {
        const icons = {
            'DEPOSIT': '💰',
            'CHARGE': '⚡',
            'REFUND': '↩️'
        };
        return icons[type as keyof typeof icons] || '💸';
    };

    const getTransactionColor = (type: string) => {
        if (type === 'DEPOSIT' || type === 'REFUND') return 'positive';
        return 'negative';
    };

    if (error) {
        return (
            <MainLayout>
                <div className="error-container">
                    <div className="error-message">
                        <h2>Error</h2>
                        <p>{error}</p>
                        <Button onClick={loadData} variant="primary">
                            Reintentar
                        </Button>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando transacciones...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="transaction-history-screen">
                <div className="transaction-header">
                    <button className="back-button" onClick={() => navigate('/wallet')}>
                        ← Volver
                    </button>
                    <h1>📊 Historial de Transacciones</h1>
                </div>

                {wallet && (
                    <Card>
                        <div className="wallet-summary">
                            <div className="summary-item">
                                <span className="label">Saldo Actual</span>
                                <span className="value">€{wallet.balance.toFixed(2)}</span>
                            </div>
                            <div className="summary-item">
                                <span className="label">Total Transacciones</span>
                                <span className="value">{transactions.length}</span>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Filters */}
                <Card>
                    <div className="filters">
                        <button
                            className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
                            onClick={() => setFilter('ALL')}
                        >
                            Todas
                        </button>
                        <button
                            className={`filter-btn ${filter === 'DEPOSIT' ? 'active' : ''}`}
                            onClick={() => setFilter('DEPOSIT')}
                        >
                            💰 Depósitos
                        </button>
                        <button
                            className={`filter-btn ${filter === 'CHARGE' ? 'active' : ''}`}
                            onClick={() => setFilter('CHARGE')}
                        >
                            ⚡ Cargas
                        </button>
                        <button
                            className={`filter-btn ${filter === 'REFUND' ? 'active' : ''}`}
                            onClick={() => setFilter('REFUND')}
                        >
                            ↩️ Reembolsos
                        </button>
                    </div>
                </Card>

                {/* Transactions List */}
                {filteredTransactions.length === 0 ? (
                    <Card>
                        <div className="no-transactions">
                            <div className="empty-icon">📭</div>
                            <h2>No hay transacciones</h2>
                            <p>
                                {filter === 'ALL'
                                    ? 'Aún no tienes transacciones en tu wallet'
                                    : `No tienes transacciones de tipo "${filter}"`}
                            </p>
                        </div>
                    </Card>
                ) : (
                    <div className="transactions-list">
                        {filteredTransactions.map((transaction) => (
                            <Card key={transaction.id}>
                                <div className="transaction-card">
                                    <div className="transaction-icon-wrapper">
                                        <div className="transaction-icon">
                                            {getTransactionIcon(transaction.type)}
                                        </div>
                                    </div>
                                    <div className="transaction-details">
                                        <div className="transaction-description">{transaction.description}</div>
                                        <div className="transaction-type">{transaction.type}</div>
                                        <div className="transaction-date">
                                            {new Date(transaction.createdAt).toLocaleString('es-ES', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                        <div className="transaction-id">ID: {transaction.id.substring(0, 12)}...</div>
                                    </div>
                                    <div className={`transaction-amount ${getTransactionColor(transaction.type)}`}>
                                        {transaction.type === 'DEPOSIT' || transaction.type === 'REFUND' ? '+' : '-'}
                                        €{Math.abs(transaction.amount).toFixed(2)}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default TransactionHistoryScreen;
