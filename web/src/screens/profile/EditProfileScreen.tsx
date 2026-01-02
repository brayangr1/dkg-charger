import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import toast from 'react-hot-toast';
import { useAuth } from '@context/AuthContext';
import { updateProfile } from '@services/authService';
import './ProfileForms.css';

const EditProfileScreen: React.FC = () => {
    const { user, updateUser } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'view' | 'edit'>('view');

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                firstName: user.firstName || user.name?.split(' ')[0] || '',
                lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
                email: user.email || '',
                phone: user.phone || ''
            });
        }
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            setLoading(true);

            // Payload must match backend expectation { firstName, lastName, phone }
            await updateProfile(parseInt(user.id), formData);

            // Update local context
            if (updateUser) {
                updateUser({
                    ...user,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    phone: formData.phone,
                    name: `${formData.firstName} ${formData.lastName}`.trim()
                });
            } else {
                // Fallback if updateUser is not available in context
                const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
                const newUser = {
                    ...currentUser,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    phone: formData.phone,
                    name: `${formData.firstName} ${formData.lastName}`.trim()
                };
                localStorage.setItem('userData', JSON.stringify(newUser));
                window.location.reload();
            }

            toast.success('✅ Perfil actualizado correctamente');
            setMode('view');
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Error al actualizar perfil');
        } finally {
            setLoading(false);
        }
    };

    const labelStyle = {
        fontSize: 12,
        color: '#636e72',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.6px',
    };

    const valueStrong = {
        fontSize: 16,
        fontWeight: 800,
        color: '#2d3436',
    };

    const valueNormal = {
        fontSize: 15,
        color: '#2d3436',
    };

    return (
        <MainLayout>
            <div className="profile-form-container">
                <div className="screen-header">
                    <button className="back-btn-modern" onClick={() => navigate('/profile')}>
                        <span>←</span> Volver
                    </button>
                    <h1>Editar Perfil</h1>

                    {mode === 'view' && (
                        <div style={{ marginLeft: 'auto' }}>
                            <button
                                onClick={() => setMode('edit')}
                                className="action-btn-text"
                            >
                                ✎ Editar
                            </button>
                        </div>
                    )}
                </div>

                {/* ================= VISTA ================= */}
                {mode === 'view' && (
                    <div className="form-card-premium">
                        {/* Header Card */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 25,
                                paddingBottom: 20,
                                borderBottom: '1px solid #f1f2f6',
                            }}
                        >
                            <div>
                                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
                                    Información Personal
                                </h2>
                                <span style={{ fontSize: 13, color: '#636e72' }}>
                                    Detalles de tu cuenta de usuario
                                </span>
                            </div>
                        </div>

                        {/* Main Info */}
                        <div style={{ display: 'grid', gap: 22 }}>
                            <div className="form-grid-2">
                                <div>
                                    <span style={labelStyle}>Nombre</span>
                                    <div style={valueStrong}>{formData.firstName}</div>
                                </div>
                                <div>
                                    <span style={labelStyle}>Apellido</span>
                                    <div style={valueStrong}>{formData.lastName}</div>
                                </div>
                            </div>

                            <div className="form-grid-2">
                                <div>
                                    <span style={labelStyle}>Correo Electrónico</span>
                                    <div style={valueNormal}>{formData.email}</div>
                                </div>
                                <div>
                                    <span style={labelStyle}>Teléfono</span>
                                    <div style={valueNormal}>{formData.phone || '-'}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ================= EDICIÓN ================= */}
                {mode === 'edit' && (
                    <div className="form-card-premium">
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid-2">
                                <div className="form-group-premium">
                                    <label className="form-label-premium">Nombre</label>
                                    <input
                                        className="input-premium"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        placeholder="Nombre"
                                    />
                                </div>
                                <div className="form-group-premium">
                                    <label className="form-label-premium">Apellido</label>
                                    <input
                                        className="input-premium"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        placeholder="Apellido"
                                    />
                                </div>
                            </div>

                            <div className="form-group-premium">
                                <label className="form-label-premium">Correo Electrónico</label>
                                <input
                                    className="input-premium"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="correo@ejemplo.com"
                                    disabled={true}
                                    style={{ opacity: 0.7, cursor: 'not-allowed' }}
                                />
                                <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
                                    El correo electrónico no se puede cambiar.
                                </small>
                            </div>

                            <div className="form-group-premium">
                                <label className="form-label-premium">Teléfono</label>
                                <input
                                    className="input-premium"
                                    name="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="+34 600 000 000"
                                />
                            </div>

                            <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
                                <button
                                    className="btn-premium-primary"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? 'Guardando...' : '💾 Guardar Cambios'}
                                </button>

                                <button
                                    className="btn-premium-outline"
                                    type="button"
                                    onClick={() => setMode('view')}
                                    disabled={loading}
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default EditProfileScreen;
