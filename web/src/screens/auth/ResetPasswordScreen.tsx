import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { resetPassword } from '../../services/authService';
import './ForgotPasswordScreen.css'; // Reusing styles

const ResetPasswordScreen: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!token) {
            toast.error('Token inválido o faltante');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        try {
            await resetPassword(token, password);
            toast.success('¡Contraseña restablecida exitosamente!');
            setTimeout(() => navigate('/login'), 2000);
        } catch (error: any) {
            console.error('Error resetting password:', error);
            toast.error(error.response?.data?.error || 'Error al restablecer la contraseña. El enlace puede haber expirado.');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="auth-screen-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <h1>Enlace Inválido</h1>
                        <p>El enlace de recuperación no es válido o ha expirado.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-screen-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>Restablecer Contraseña</h1>
                    <p>Ingresa tu nueva contraseña a continuación.</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label className="form-label">Nueva Contraseña</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            disabled={loading}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Confirmar Contraseña</label>
                        <input
                            type="password"
                            className="form-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repite la contraseña"
                            disabled={loading}
                            required
                        />
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Restableciendo...' : 'Cambiar Contraseña'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPasswordScreen;
