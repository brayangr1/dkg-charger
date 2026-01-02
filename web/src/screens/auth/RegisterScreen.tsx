import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import './LoginScreen.css';

const RegisterScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [invitationToken, setInvitationToken] = useState<string | null>(null);
    const { register } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        // Capturar parámetros de la invitación
        const token = searchParams.get('token');
        const emailParam = searchParams.get('email');
        
        if (token) {
            setInvitationToken(token);
            sessionStorage.setItem('invitationToken', token);
        }
        
        if (emailParam) {
            setEmail(decodeURIComponent(emailParam));
        }
    }, [searchParams]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Obtener el token de invitación (desde state o sessionStorage)
            const finalToken = invitationToken || sessionStorage.getItem('invitationToken');
            
            console.log('[RegisterScreen] Iniciando registro con:', {
                email,
                name,
                invitationToken: finalToken ? 'presente' : 'ausente'
            });
            
            await register(email, password, name, finalToken);
            navigate('/');
        } catch (error) {
            console.error('Registration failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen">
            <div className="login-container">
                <div className="login-card">
                    <h1>Crear Cuenta</h1>
                    <p className="subtitle">DKG Charger</p>

                    {invitationToken && (
                        <div className="invitation-alert">
                            🎉 Completa tu registro para aceptar la invitación al cargador
                        </div>
                    )}

                    <form onSubmit={handleRegister}>
                        <div className="form-group">
                            <label htmlFor="name">Nombre</label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Tu nombre"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                required
                                disabled={loading || !!invitationToken}
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
                                minLength={6}
                                disabled={loading}
                            />
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Creando cuenta...' : 'Registrarse'}
                        </button>
                    </form>

                    <p className="register-link">
                        ¿Ya tienes cuenta? <a href="/login">Inicia sesión aquí</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterScreen;
