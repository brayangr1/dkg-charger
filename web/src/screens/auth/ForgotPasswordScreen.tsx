import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { forgotPassword } from '../../services/authService';
import './ForgotPasswordScreen.css';

const ForgotPasswordScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast.error('Por favor ingresa tu correo electrónico');
            return;
        }

        setLoading(true);
        try {
            await forgotPassword(email);
            setSuccess(true);
            toast.success('Correo de recuperación enviado');
        } catch (error: any) {
            console.error('Error sending recovery email:', error);
            toast.error(error.response?.data?.error || 'Error al enviar el correo. Verifica que la dirección sea correcta.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-screen-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>Recuperar Contraseña</h1>
                    <p>Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.</p>
                </div>

                {success ? (
                    <div className="success-message">
                        <p>¡Correo enviado! Revisa tu bandeja de entrada (y spam) para encontrar el enlace de recuperación.</p>
                        <div className="auth-links">
                            <Link to="/login" className="auth-link">Volver al inicio de sesión</Link>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-group">
                            <label className="form-label">Correo Electrónico</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="ejemplo@correo.com"
                                disabled={loading}
                                required
                            />
                        </div>

                        <button type="submit" className="auth-button" disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar Enlace'}
                        </button>

                        <div className="auth-links">
                            <Link to="/login" className="auth-link">Volver al inicio de sesión</Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ForgotPasswordScreen;
