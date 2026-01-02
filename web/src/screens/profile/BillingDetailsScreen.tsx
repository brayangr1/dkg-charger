import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import toast from 'react-hot-toast';
import { useAuth } from '@context/AuthContext';
import './ProfileForms.css';

const BillingDetailsScreen: React.FC = () => {
    const { user, getBillingDetails, updateBillingDetails } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [mode, setMode] = useState<'view' | 'edit'>('view');

    const [formData, setFormData] = useState({
        userType: 'personal',
        companyName: '',
        firstName: '',
        lastName: '',
        cif: '',
        phone: '',
        address: '',
        postalCode: '',
    });

    const [errors, setErrors] = useState({
        firstName: '',
        phone: '',
    });

    useEffect(() => {
        if (user) loadBillingData();
    }, [user]);

    const loadBillingData = async () => {
    try {
        const data = await getBillingDetails();
        if (data) {
            const isCompany =
                data.user_type === 'empresa' ||
                data.user_type === 'Empresa' ||
                !!data.company_name;

            setFormData({
                userType: isCompany ? 'empresa' : 'personal',
                companyName: data.company_name || '',
                firstName: data.first_name || '',
                lastName: data.last_name || '',
                cif: data.cif || '',
                phone: data.phone || '',
                address: data.address || '',
                postalCode: data.postal_code || '',
            });
        }
    } catch (error) {
        console.error(error);
    } finally {
        setInitialLoading(false);
    }
};


    /* ================= VALIDACIÓN ORIGINAL ================= */
    const validateForm = () => {
        let valid = true;
        const newErrors = { firstName: '', phone: '' };

        if (formData.userType === 'personal' && !formData.firstName.trim()) {
            newErrors.firstName = 'Por favor, ingrese un nombre.';
            valid = false;
        }

        if (formData.userType === 'empresa' && !formData.companyName.trim()) {
            newErrors.firstName = 'Por favor, ingrese el nombre de la empresa.';
            valid = false;
        }

        if (formData.phone && !/^[0-9]{7,15}$/.test(formData.phone)) {
            newErrors.phone = 'Número de teléfono inválido.';
            valid = false;
        }

        setErrors(newErrors);
        return valid;
    };

    /* ================= SUBMIT ORIGINAL ================= */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !validateForm()) return;

        try {
            setLoading(true);

            const payload = {
                user_type: formData.userType,
                company_name: formData.userType === 'empresa' ? formData.companyName.trim() : '',
                first_name: formData.userType === 'personal' ? formData.firstName.trim() : '',
                last_name: formData.userType === 'personal' ? formData.lastName.trim() : '',
                cif: formData.userType === 'empresa' ? formData.cif.trim() : '',
                phone: formData.phone.trim(),
                address: formData.address.trim(),
                postal_code: formData.postalCode.trim(),
            };

            await updateBillingDetails(payload);
            toast.success('✅ Los datos de facturación se han actualizado correctamente.');
            setMode('view');
        } catch (error) {
            console.error(error);
            toast.error('No se pudieron actualizar los datos de facturación.');
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <MainLayout>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                    <div className="spinner" />
                </div>
            </MainLayout>
        );
    }
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
                {/* ================= HEADER ================= */}
                <div className="screen-header">
                    <button className="back-btn-modern" onClick={() => navigate('/profile')}>
                        ← Volver
                    </button>
                    <h1>Datos de Facturación</h1>

                    {mode === 'view' && (
                        <div style={{ marginLeft: 'auto' }}>
                            <button
                                className="action-btn-text"
                                onClick={() => setMode('edit')}
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
                                    Información de Facturación
                                </h2>
                                <span style={{ fontSize: 13, color: '#636e72' }}>
                                    Datos usados para facturas y pagos
                                </span>
                            </div>

                            <div
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 20,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    background:
                                        formData.userType === 'empresa'
                                            ? 'rgba(9,132,227,0.12)'
                                            : 'rgba(0,206,201,0.12)',
                                    color:
                                        formData.userType === 'empresa'
                                            ? '#0984e3'
                                            : '#00b894',
                                }}
                            >
                                {formData.userType === 'empresa' ? 'Empresa' : 'Personal'}
                            </div>
                        </div>

                        {/* Main Info */}
                        <div style={{ display: 'grid', gap: 22 }}>
                            {formData.userType === 'empresa' ? (
                                <div className="form-grid-2">
                                    <div>
                                        <span style={labelStyle}>Empresa</span>
                                        <div style={valueStrong}>{formData.companyName}</div>
                                    </div>
                                    <div>
                                        <span style={labelStyle}>CIF</span>
                                        <div style={valueNormal}>{formData.cif}</div>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <span style={labelStyle}>Nombre completo</span>
                                    <div style={valueStrong}>
                                        {formData.firstName} {formData.lastName}
                                    </div>
                                </div>
                            )}

                            <div className="form-grid-2">
                                <div>
                                    <span style={labelStyle}>Teléfono</span>
                                    <div style={valueNormal}>{formData.phone}</div>
                                </div>
                                <div>
                                    <span style={labelStyle}>Código Postal</span>
                                    <div style={valueNormal}>{formData.postalCode}</div>
                                </div>
                            </div>

                            <div>
                                <span style={labelStyle}>Dirección</span>
                                <div style={valueNormal}>{formData.address}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ================= EDICIÓN (ORIGINAL) ================= */}
                {mode === 'edit' && (
                    <div className="form-card-premium">
                        <form onSubmit={handleSubmit}>
                            {/* ======= TODO ESTE BLOQUE ES TU FORMULARIO ORIGINAL ======= */}

                            <div className="form-group-premium">
                                <label className="form-label-premium">Tipo de Usuario</label>
                                <select
                                    className="select-premium"
                                    value={formData.userType}
                                    onChange={(e) =>
                                        setFormData(prev => ({ ...prev, userType: e.target.value }))
                                    }
                                >
                                    <option value="personal">Personal</option>
                                    <option value="empresa">Empresa</option>
                                </select>
                            </div>

                            {formData.userType === 'empresa' ? (
                                <div className="form-group-premium">
                                    <label className="form-label-premium">Nombre de la Empresa</label>
                                    <input
                                        className="input-premium"
                                        value={formData.companyName}
                                        onChange={(e) => {
                                            setFormData(prev => ({ ...prev, companyName: e.target.value }));
                                            setErrors(prev => ({ ...prev, firstName: '' }));
                                        }}
                                    />
                                    {errors.firstName && (
                                        <span style={{ color: 'red', fontSize: 12 }}>
                                            {errors.firstName}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="form-grid-2">
                                    <div className="form-group-premium">
                                        <label className="form-label-premium">Nombre</label>
                                        <input
                                            className="input-premium"
                                            value={formData.firstName}
                                            onChange={(e) => {
                                                setFormData(prev => ({ ...prev, firstName: e.target.value }));
                                                setErrors(prev => ({ ...prev, firstName: '' }));
                                            }}
                                        />
                                    </div>
                                    <div className="form-group-premium">
                                        <label className="form-label-premium">Apellido</label>
                                        <input
                                            className="input-premium"
                                            value={formData.lastName}
                                            onChange={(e) =>
                                                setFormData(prev => ({ ...prev, lastName: e.target.value }))
                                            }
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="form-grid-2">
                                {formData.userType === 'empresa' && (
                                    <div className="form-group-premium">
                                        <label className="form-label-premium">NIF / CIF</label>
                                        <input
                                            className="input-premium"
                                            value={formData.cif}
                                            onChange={(e) =>
                                                setFormData(prev => ({ ...prev, cif: e.target.value }))
                                            }
                                        />
                                    </div>
                                )}
                                <div className="form-group-premium">
                                    <label className="form-label-premium">Teléfono</label>
                                    <input
                                        className="input-premium"
                                        value={formData.phone}
                                        onChange={(e) => {
                                            setFormData(prev => ({ ...prev, phone: e.target.value }));
                                            setErrors(prev => ({ ...prev, phone: '' }));
                                        }}
                                    />
                                    {errors.phone && (
                                        <span style={{ color: 'red', fontSize: 12 }}>
                                            {errors.phone}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="form-grid-2">
                                <div className="form-group-premium">
                                    <label className="form-label-premium">Dirección</label>
                                    <input
                                        className="input-premium"
                                        value={formData.address}
                                        onChange={(e) =>
                                            setFormData(prev => ({ ...prev, address: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="form-group-premium">
                                    <label className="form-label-premium">C.P.</label>
                                    <input
                                        className="input-premium"
                                        value={formData.postalCode}
                                        onChange={(e) =>
                                            setFormData(prev => ({ ...prev, postalCode: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>

                            <div style={{ marginTop: 30, display: 'flex', gap: 15 }}>
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

export default BillingDetailsScreen;
