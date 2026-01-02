import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { IoMailOutline, IoSend } from 'react-icons/io5';
import { sendSupportTicket } from '../../services/supportService';
import './TicketScreen.css';

const TicketScreen: React.FC = () => {
    const [subject, setSubject] = useState('');
    const [type, setType] = useState<'general' | 'billing' | 'payment' | 'technical'>('general');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!subject.trim() || !description.trim()) {
            toast.error('Por favor completa todos los campos');
            return;
        }

        setLoading(true);
        try {
            const result = await sendSupportTicket({
                subject,
                type,
                description
            });

            if (result.success) {
                toast.success('¡Ticket enviado correctamente!');
                setSubject('');
                setType('general');
                setDescription('');
            } else {
                toast.error(result.error || 'Error al enviar el ticket');
            }
        } catch (error) {
            console.error('Error submitting ticket:', error);
            toast.error('Error inesperado al enviar el ticket');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ticket-screen-container">
            <div className="ticket-header">
                <h1><IoMailOutline /> Soporte Técnico</h1>
                <p>Envíanos un ticket y te responderemos lo antes posible.</p>
            </div>

            <div className="ticket-form-card">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Asunto</label>
                        <input
                            type="text"
                            className="form-input"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Resumen del problema"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Tipo de Incidencia</label>
                        <select
                            className="form-select"
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            disabled={loading}
                        >
                            <option value="general">General</option>
                            <option value="billing">Facturación</option>
                            <option value="payment">Pagos</option>
                            <option value="technical">Técnico</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Descripción Detallada</label>
                        <textarea
                            className="form-textarea"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Explica detalladamente lo que sucede..."
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="submit-button" disabled={loading}>
                        {loading ? 'Enviando...' : (
                            <>
                                <IoSend /> Enviar Ticket
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default TicketScreen;
