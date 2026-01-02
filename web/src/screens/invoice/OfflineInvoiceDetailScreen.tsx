import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import toast from 'react-hot-toast';
import invoiceService, { OfflineInvoice } from '@services/invoiceService';

const OfflineInvoiceDetailScreen: React.FC = () => {
    const { invoiceId } = useParams<{ invoiceId: string }>();
    const [invoice, setInvoice] = useState<OfflineInvoice | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        loadInvoice();
    }, [invoiceId]);

    const loadInvoice = async () => {
        if (!invoiceId) return;

        try {
            setLoading(true);
            const data = await invoiceService.getOfflineInvoiceDetails(invoiceId);
            setInvoice(data);
        } catch (error) {
            console.error('Error loading invoice:', error);
            toast.error('Error al cargar factura');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando factura...</p>
                </div>
            </MainLayout>
        );
    }

    if (!invoice) {
        return (
            <MainLayout>
                <div className="error-container">
                    <p>Factura no encontrada</p>
                    <Button onClick={() => navigate('/invoices/offline')}>Volver</Button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="invoice-detail-screen">
                <div className="detail-header">
                    <button className="back-button" onClick={() => navigate('/invoices/offline')}>
                        ← Volver
                    </button>
                    <h1>📱 Detalle Factura Offline</h1>
                </div>

                <Card>
                    <div className="invoice-header-info">
                        <div className="invoice-number">Sesión #{invoice.sessionId.substring(0, 12)}</div>
                        <div className={`status-badge status-${invoice.status}`}>
                            {invoice.status === 'pending' ? 'Pendiente' : invoice.status === 'synced' ? 'Sincronizada' : 'Pagada'}
                        </div>
                    </div>

                    <div className="offline-details">
                        <div className="detail-item">
                            <span className="label">Energía Consumida:</span>
                            <span className="value">{invoice.energyConsumed.toFixed(2)} kWh</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">Costo Total:</span>
                            <span className="value grand-total">€{invoice.cost.toFixed(2)}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">Cargador ID:</span>
                            <span className="value">#{invoice.chargerId}</span>
                        </div>
                        <div className="detail-item">
                            <span className="label">Fecha de Creación:</span>
                            <span className="value">{new Date(invoice.createdAt).toLocaleString('es-ES')}</span>
                        </div>
                        {invoice.syncedAt && (
                            <div className="detail-item">
                                <span className="label">Sincronizada:</span>
                                <span className="value">{new Date(invoice.syncedAt).toLocaleString('es-ES')}</span>
                            </div>
                        )}
                        {invoice.paidAt && (
                            <div className="detail-item">
                                <span className="label">Pagada:</span>
                                <span className="value">{new Date(invoice.paidAt).toLocaleString('es-ES')}</span>
                            </div>
                        )}
                    </div>
                </Card>

                <Card>
                    <div className="info-section">
                        <h3>ℹ️ Sobre Facturas Offline</h3>
                        <p>
                            Las facturas offline se generan automáticamente cuando se realiza una carga sin conexión a internet.
                            Una vez restablecida la conexión, se sincronizan con el servidor.
                        </p>
                    </div>
                </Card>
            </div>
        </MainLayout>
    );
};

export default OfflineInvoiceDetailScreen;
