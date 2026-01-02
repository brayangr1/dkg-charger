import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import toast from 'react-hot-toast';
import { useAuth } from '@context/AuthContext';
import { changePassword } from '@services/authService';
import './ProfileForms.css';

const ChangePasswordScreen: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (formData.newPassword !== formData.confirmPassword) {
            toast.error('Las contraseñas no coinciden');
            return;
        }

        if (formData.newPassword.length < 6) {
            toast.error('La nueva contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        try {
            await changePassword(user.id, formData.currentPassword, formData.newPassword);
            toast.success('Contraseña actualizada correctamente');
            navigate('/profile');
        } catch (error: any) {
            toast.error(error.message || 'Error al cambiar la contraseña');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout>
            <div className="profile-form-container">
                <div className="screen-header">
                    <button className="back-btn-modern" onClick={() => navigate('/profile')}>
                        <span>←</span> Volver
                    </button>
                    <h1>Cambiar Contraseña</h1>
                </div>

                <div className="form-card-premium">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group-premium">
                            <label className="form-label-premium">Contraseña Actual</label>
                            <input
                                className="input-premium"
                                name="currentPassword"
                                type="password"
                                value={formData.currentPassword}
                                onChange={handleChange}
                                placeholder="••••••"
                            />
                        </div>

                        <div className="form-group-premium">
                            <label className="form-label-premium">Nueva Contraseña</label>
                            <input
                                className="input-premium"
                                name="newPassword"
                                type="password"
                                value={formData.newPassword}
                                onChange={handleChange}
                                placeholder="••••••"
                            />
                        </div>

                        <div className="form-group-premium">
                            <label className="form-label-premium">Confirmar Nueva Contraseña</label>
                            <input
                                className="input-premium"
                                name="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="••••••"
                            />
                        </div>

                        <div style={{ marginTop: '30px' }}>
                            <button
                                className="btn-premium-primary"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? 'Actualizando...' : '🔒 Actualizar Contraseña'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </MainLayout>
    );
};

export default ChangePasswordScreen;