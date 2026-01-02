import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import toast from 'react-hot-toast';
import { sendSupportMessage } from '@services/authService';

const ContactScreen: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        subject: '',
        message: '',
        email: '' // Optional if user is logged in, but good to have
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.subject || !formData.message) {
            toast.error('Por favor completa todos los campos');
            return;
        }

        try {
            setLoading(true);
            await sendSupportMessage(formData);
            toast.success('✅ Mensaje enviado correctamente');
            navigate('/support');
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Error al enviar mensaje');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="contact-screen" style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div className="screen-header" style={{ marginBottom: '24px' }}>
                    <button
                        onClick={() => navigate('/support')}
                        className="back-button"
                    >
                        ← Volver
                    </button>
                    <h1>Contáctanos</h1>
                </div>

                <Card>
                    <form onSubmit={handleSubmit} className="contact-form">
                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Asunto</label>
                            <select
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    fontSize: '16px',
                                    marginBottom: '16px'
                                }}
                            >
                                <option value="">Selecciona un asunto</option>
                                <option value="technical">Problema Técnico</option>
                                <option value="billing">Facturación</option>
                                <option value="account">Cuenta</option>
                                <option value="other">Otro</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Mensaje</label>
                            <textarea
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                placeholder="Describe tu problema o consulta..."
                                rows={6}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    fontSize: '16px',
                                    marginBottom: '24px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        <Button
                            variant="primary"
                            size="lg"
                            type="submit"
                            loading={loading}
                            disabled={loading}
                            fullWidth
                        >
                            {loading ? 'Enviando...' : 'Enviar Mensaje'}
                        </Button>
                    </form>
                </Card>
            </div>
        </MainLayout>
    );
};

export default ContactScreen;
