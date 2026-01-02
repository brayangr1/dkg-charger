import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import toast from 'react-hot-toast';
import invoiceService, { OfflineInvoice } from '@services/invoiceService';

const OfflineInvoiceScreen: React.FC = () => {
    const [invoices, setInvoices] = useState<OfflineInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadInvoices();
    }, []);

    const loadInvoices = async () => {
        try {
            setLoading(true);
            const data = await invoiceService.getOfflineInvoices();
            setInvoices(data);
        } catch (error) {
            console.error('Error loading offline invoices:', error);
            toast.error('Error al cargar facturas offline');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando facturas...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="pending-invoices-screen">
                <h1>📱 Facturas Offline</h1>

                {invoices.length === 0 ? (
                    <Card>
                        <div className="no-invoices">
                            <div className="empty-icon">📭</div>
                            <h2>No tienes facturas offline</h2>
                            <p>Las facturas generadas sin conexión aparecerán aquí</p>
                        </div>
                    </Card>
                ) : (
                    <div className="invoices-list">
                        {invoices.map((invoice) => (
                            <Card key={invoice.id}>
                                <div
                                    className="invoice-card"
                                    onClick={() => navigate(`/invoices/offline/${invoice.id}`)}
                                >
                                    <div className="invoice-header">
                                        <div className="invoice-number">Sesión #{invoice.sessionId.substring(0, 8)}</div>
                                        <span className={`status-badge status-${invoice.status}`}>
                                            {invoice.status === 'pending' ? 'Pendiente' : invoice.status === 'synced' ? 'Sincronizada' : 'Pagada'}
                                        </span>
                                    </div>
                                    <div className="invoice-amount">€{invoice.cost.toFixed(2)}</div>
                                    <div className="invoice-dates">
                                        <div>Energía: {invoice.energyConsumed.toFixed(2)} kWh</div>
                                        <div>Fecha: {new Date(invoice.createdAt).toLocaleDateString('es-ES')}</div>
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

export default OfflineInvoiceScreen;
