import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { IoRefresh, IoReceiptOutline, IoCardOutline } from 'react-icons/io5';
import { getPendingInvoices, Invoice } from '../../services/invoiceService';
import './PendingInvoicesScreen.css';

const PendingInvoicesScreen: React.FC = () => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const data = await getPendingInvoices();
            setInvoices(data || []);
        } catch (error) {
            console.error('Error fetching pending invoices:', error);
            toast.error('Error al cargar facturas pendientes');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatAmount = (amount: number) => {
        return `€ ${amount.toFixed(2)}`;
    };

    if (loading) {
        return <div className="loading-container">Cargando facturas...</div>;
    }

    return (
        <div className="pending-invoices-container">
            <div className="pending-invoices-header">
                <h1>📄 Facturas Pendientes</h1>
                <button className="refresh-button" onClick={fetchInvoices}>
                    <IoRefresh size={20} /> Actualizar
                </button>
            </div>

            {invoices.length === 0 ? (
                <div className="empty-state">
                    <IoReceiptOutline size={48} color="#ccc" />
                    <p>No hay facturas pendientes.</p>
                    <small>Todas tus facturas están al día.</small>
                </div>
            ) : (
                <>
                    <div className="invoices-list">
                        {invoices.map((invoice) => (
                            <div key={invoice.id} className="invoice-card">
                                <div className="invoice-info">
                                    <span className="invoice-number">Factura #{invoice.invoiceNumber}</span>
                                    <span className="invoice-date">Emitida: {formatDate(invoice.issueDate)}</span>
                                    <span className="invoice-date">Vence: {formatDate(invoice.dueDate)}</span>
                                </div>
                                <div className="invoice-amount">
                                    {formatAmount(invoice.total)}
                                </div>
                                <div className="invoice-actions">
                                    <button
                                        className="btn-view"
                                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                                    >
                                        Ver Detalle
                                    </button>
                                    <button
                                        className="btn-pay"
                                        onClick={() => navigate('/payment/process', { state: { invoice } })}
                                    >
                                        Pagar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pay-all-container">
                        <button
                            className="btn-pay-all"
                            onClick={() => navigate('/payment/process', { state: { invoices } })}
                        >
                            <IoCardOutline size={20} style={{ marginRight: 8 }} />
                            Pagar Todas ({formatAmount(invoices.reduce((sum, inv) => sum + inv.total, 0))})
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default PendingInvoicesScreen;
