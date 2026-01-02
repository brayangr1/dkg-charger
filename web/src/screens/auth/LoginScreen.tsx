import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import './LoginScreen.css';
import toast from 'react-hot-toast';

const LoginScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, googleLogin } = useAuth();
    const navigate = useNavigate();


    useEffect(() => {
        // Check for invitation context
        const invitationData = sessionStorage.getItem('invitationData');
        if (invitationData) {
            try {
                const parsed = JSON.parse(invitationData);
                if (parsed.guest_email && !email) {
                    setEmail(parsed.guest_email);
                }
            } catch (e) {
                console.error('Error parsing invitation data', e);
            }
        }
    }, []);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Retrieve invitation token if exists
            const invitationToken = sessionStorage.getItem('invitationToken');

            await login(email, password, invitationToken);

            // Clear invitation data after successful login
            if (invitationToken) {
                sessionStorage.removeItem('invitationToken');
                sessionStorage.removeItem('invitationData');
                toast.success('¡Invitación aceptada correctamente!');
            }

            navigate('/');
        } catch (error: any) {
            console.error('Login failed:', error);
            // Error handling depends on AuthContext, assuming it throws or we handle it here
            toast.error('Error al iniciar sesión. Verifica tus credenciales.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const invitationToken = sessionStorage.getItem('invitationToken');
            await googleLogin(invitationToken);

            if (invitationToken) {
                sessionStorage.removeItem('invitationToken');
                sessionStorage.removeItem('invitationData');
                toast.success('¡Invitación aceptada correctamente!');
            }

            navigate('/');
        } catch (error) {
            console.error('Google login failed:', error);
            toast.error('Error al iniciar sesión con Google.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen">
            <div className="login-container">
                <div className="login-card">
                    <h1>DKG Charger</h1>
                    <p className="subtitle">Gestión de Carga EV</p>

                    {sessionStorage.getItem('invitationToken') && (
                        <div className="invitation-alert">
                            🎉 Tienes una invitación pendiente. Inicia sesión para aceptarla.
                        </div>
                    )}

                    <form onSubmit={handleEmailLogin}>
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Contraseña</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-options">
                            <a href="/forgot-password">¿Olvidaste tu contraseña?</a>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                        </button>
                    </form>

                    <div className="divider">
                        <span>o</span>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        className="btn-google"
                        disabled={loading}
                    >
                        <span>🔐</span> Continuar con Google
                    </button>

                    <p className="register-link">
                        ¿No tienes cuenta? <a href="/register">Regístrate aquí</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
