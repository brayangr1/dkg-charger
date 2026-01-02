import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { IoArrowBack, IoDownloadOutline, IoCardOutline } from 'react-icons/io5';
import { getInvoiceDetails, downloadInvoicePDF, Invoice } from '../../services/invoiceService';
import './PendingInvoiceDetailScreen.css';

const PendingInvoiceDetailScreen: React.FC = () => {
    const { invoiceId } = useParams<{ invoiceId: string }>();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        if (invoiceId) {
            fetchInvoiceDetails(invoiceId);
        }
    }, [invoiceId]);

    const fetchInvoiceDetails = async (id: string) => {
        setLoading(true);
        try {
            const data = await getInvoiceDetails(id);
            setInvoice(data);
        } catch (error) {
            console.error('Error fetching invoice details:', error);
            toast.error('Error al cargar el detalle de la factura');
            navigate('/invoices/pending');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!invoiceId) return;
        setDownloading(true);
        try {
            const blob = await downloadInvoicePDF(invoiceId);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `factura-${invoice?.invoiceNumber || invoiceId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            console.error('Error downloading PDF:', error);
            toast.error('Error al descargar la factura');
        } finally {
            setDownloading(false);
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatCurrency = (amount: number) => {
        return `€ ${amount.toFixed(2)}`;
    };

    if (loading) {
        return <div className="loading-container">Cargando detalle de factura...</div>;
    }

    if (!invoice) {
        return <div className="loading-container">Factura no encontrada</div>;
    }

    return (
        <div className="invoice-detail-container">
            <div className="invoice-detail-header">
                <button className="back-button" onClick={() => navigate(-1)}>
                    <IoArrowBack />
                </button>
                <h1>Detalle de Factura</h1>
            </div>

            <div className="invoice-paper">
                <div className="invoice-top-section">
                    <div className="invoice-company-info">
                        <h2>DKG Solutions</h2>
                        <p>Calle Principal 123</p>
                        <p>Madrid, España</p>
                        <p>NIF: B12345678</p>
                    </div>
                    <div className="invoice-meta">
                        <h3>FACTURA</h3>
                        <div className="meta-row">
                            <span className="meta-label">Nº Factura:</span>
                            <span className="meta-value">#{invoice.invoiceNumber}</span>
                        </div>
                        <div className="meta-row">
                            <span className="meta-label">Fecha Emisión:</span>
                            <span className="meta-value">{formatDate(invoice.issueDate)}</span>
                        </div>
                        <div className="meta-row">
                            <span className="meta-label">Fecha Vencimiento:</span>
                            <span className="meta-value">{formatDate(invoice.dueDate)}</span>
                        </div>
                        <div className="meta-row">
                            <span className="meta-label">Estado:</span>
                            <span className="meta-value" style={{ textTransform: 'uppercase', color: invoice.status === 'paid' ? 'green' : 'red' }}>
                                {invoice.status === 'pending' ? 'Pendiente' : invoice.status}
                            </span>
                        </div>
                    </div>
                </div>

                <table className="invoice-items-table">
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th className="text-right">Cantidad</th>
                            <th className="text-right">Precio Unit.</th>
                            <th className="text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.lineItems && invoice.lineItems.map((item) => (
                            <tr key={item.id}>
                                <td>{item.description}</td>
                                <td className="text-right">{item.quantity}</td>
                                <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                                <td className="text-right">{formatCurrency(item.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="invoice-totals">
                    <div className="total-row">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(invoice.subtotal)}</span>
                    </div>
                    <div className="total-row">
                        <span>IVA (21%):</span>
                        <span>{formatCurrency(invoice.tax)}</span>
                    </div>
                    <div className="total-row final">
                        <span>Total:</span>
                        <span>{formatCurrency(invoice.total)}</span>
                    </div>
                </div>
            </div>

            <div className="invoice-actions-footer">
                <button
                    className="btn-download"
                    onClick={handleDownload}
                    disabled={downloading}
                >
                    <IoDownloadOutline size={20} />
                    {downloading ? 'Descargando...' : 'Descargar PDF'}
                </button>

                {invoice.status === 'pending' && (
                    <button
                        className="btn-pay-large"
                        onClick={() => navigate('/payment/process', { state: { invoice } })}
                    >
                        <IoCardOutline size={20} />
                        Pagar Ahora
                    </button>
                )}
            </div>
        </div>
    );
};

export default PendingInvoiceDetailScreen;
