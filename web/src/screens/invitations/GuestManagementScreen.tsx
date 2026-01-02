import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import LoadingScreen from '@screens/LoadingScreen';
import toast from 'react-hot-toast';
import {
    getGuests,
    updateGuest,
    blockGuest,
    unblockGuest,
    removeGuest,
    resetEnergyLimit,
    GuestUser
} from '@services/invitationService';
import './GuestManagementScreen.css';
import Input from '@components/common/Input';

const GuestManagementScreen: React.FC = () => {
    const navigate = useNavigate();
    const [guests, setGuests] = useState<GuestUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedGuest, setSelectedGuest] = useState<GuestUser | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<GuestUser>>({});

    useEffect(() => {
        loadGuests();
    }, []);

    const loadGuests = async () => {
        setLoading(true);
        try {
            const data = await getGuests();
            setGuests(data.guests || []);

            // Si hay uno seleccionado, actualizarlo
            if (selectedGuest) {
                const updated = (data.guests || []).find((g: GuestUser) => g.id === selectedGuest.id);
                if (updated) setSelectedGuest(updated);
            }
        } catch (error) {
            console.error('Error loading guests:', error);
            toast.error('Error al cargar la lista de invitados');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectGuest = (guest: GuestUser) => {
        setSelectedGuest(guest);
        setEditForm({
            alias: guest.alias || '',
            firstName: guest.firstName || '',
            lastName: guest.lastName || '',
            ratePerKwh: guest.ratePerKwh || 0,
            energyLimit: guest.energyLimit
        });
        setIsEditing(false);
    };

    const handleUpdateGuest = async () => {
        if (!selectedGuest) return;

        try {
            const updatedData = {
                ...editForm,
                ratePerKwh: Number(editForm.ratePerKwh),
                energyLimit: editForm.energyLimit ? Number(editForm.energyLimit) : undefined
            };

            await updateGuest(selectedGuest.serial, selectedGuest.id, updatedData);
            toast.success('Información actualizada correctamente');
            await loadGuests();
            setIsEditing(false);
        } catch (error: any) {
            console.error('Error updating guest:', error);
            toast.error(error.response?.data?.error || 'No se pudo actualizar el usuario');
        }
    };

    const handleBlockToggle = async () => {
        if (!selectedGuest) return;

        const action = selectedGuest.isBlocked ? unblockGuest : blockGuest;
        const actionName = selectedGuest.isBlocked ? 'desbloquear' : 'bloquear';

        if (!window.confirm(`¿Estás seguro de que deseas ${actionName} a este usuario?`)) return;

        try {
            await action(selectedGuest.serial, selectedGuest.id);
            toast.success(`Usuario ${selectedGuest.isBlocked ? 'desbloqueado' : 'bloqueado'} exitosamente`);
            await loadGuests();
        } catch (error: any) {
            console.error(`Error ${actionName} guest:`, error);
            toast.error(`Error al ${actionName} el usuario`);
        }
    };

    const handleRemoveGuest = async () => {
        if (!selectedGuest) return;
        if (!window.confirm('¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.')) return;

        try {
            await removeGuest(selectedGuest.serial, selectedGuest.id);
            toast.success('Usuario eliminado correctamente');
            await loadGuests();
            setSelectedGuest(null);
        } catch (error: any) {
            console.error('Error removing guest:', error);
            toast.error('No se pudo eliminar el usuario');
        }
    };

    const handleResetLimit = async () => {
        if (!selectedGuest) return;
        if (!window.confirm('¿Reiniciar el contador de energía mensual para este usuario?')) return;

        try {
            await resetEnergyLimit(selectedGuest.serial, selectedGuest.id);
            toast.success('Contador de energía mensual reiniciado');
            await loadGuests();
        } catch (error: any) {
            console.error('Error resetting limit:', error);
            toast.error('No se pudo reiniciar el contador');
        }
    };

    const renderProgressBar = (used: number, limit: number) => {
        if (!limit) return null;
        const percentage = Math.min((used / limit) * 100, 100);
        let color = '#3a7bd5';
        if (percentage >= 100) color = '#ff4757';
        else if (percentage >= 80) color = '#ffa502';

        return (
            <div className="progress-container" style={{ marginTop: 12 }}>
                <div className="progress-info" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#636e72', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>Uso del límite mensual</span>
                    <span style={{ fontWeight: 700, color: color }}>{percentage.toFixed(0)}%</span>
                </div>
                <div className="progress-bar-bg" style={{ width: '100%', height: 8, background: '#f1f2f6', borderRadius: 4, overflow: 'hidden' }}>
                    <div className="progress-bar-fill" style={{ width: `${percentage}%`, height: '100%', background: color, transition: 'width 0.4s ease-out', borderRadius: 4 }} />
                </div>
            </div>
        );
    };

    return (
        <MainLayout>
            <div className="guest-management-screen">
                <div className="guest-management-header">
                    <div className="header-left">
                        <h1>👥 Gestión de Invitados</h1>
                        <p className="header-subtitle">Administra los permisos, tarifas y límites de tus usuarios.</p>
                    </div>
                    <button className="btn-invite-new" onClick={() => navigate('/invitations/invite')}>
                        <span>+</span> Invitar Usuario
                    </button>
                </div>

                {loading && guests.length === 0 ? (
                    <LoadingScreen />
                ) : guests.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">👥</div>
                        <h2>No tienes invitados todavía</h2>
                        <p>Invita a familiares o amigos para que puedan utilizar tus cargadores con sus propios límites y estadísticas.</p>
                        <button className="btn-invite-new" style={{ margin: '20px auto' }} onClick={() => navigate('/invitations/invite')}>
                            Enviar mi primera invitación
                        </button>
                    </div>
                ) : (
                    <div className="guests-grid">
                        {guests.map(guest => {
                            const used = Number(guest.monthlyEnergyUsed || 0);
                            const limit = guest.energyLimit ? Number(guest.energyLimit) : 0;

                            return (
                                <div key={guest.id} className={`guest-card ${guest.isBlocked ? 'is-blocked' : ''}`} onClick={() => handleSelectGuest(guest)}>
                                    <div className="guest-header">
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <div className="guest-avatar">
                                                {guest.alias ? guest.alias.charAt(0).toUpperCase() : '👤'}
                                            </div>
                                            <div className="guest-info">
                                                <h3>{guest.alias || `${guest.firstName} ${guest.lastName}`}</h3>
                                                <p className="guest-email">{guest.email}</p>
                                            </div>
                                        </div>
                                        <div className="badges-row">
                                            {guest.isBlocked && <span className="status-badge blocked">Bloqueado</span>}
                                            {!guest.isBlocked && <span className="status-badge active">Activo</span>}
                                        </div>
                                    </div>

                                    <div className="guest-stats-summary">
                                        <div className="stat-pill">
                                            <span className="pill-icon">⚡</span>
                                            <span>{used.toFixed(2)} kWh / mes</span>
                                        </div>
                                        <div className="stat-pill">
                                            <span className="pill-icon">💰</span>
                                            <span>€{Number(guest.monthlyCostAccumulated || 0).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="guest-footer">
                                        <span className="charger-name">
                                            <i className="charger-icon">🔌</i> {guest.chargerName}
                                        </span>
                                    </div>

                                    {limit > 0 && renderProgressBar(used, limit)}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Modal de Detalle / Edición */}
                {selectedGuest && (
                    <div className="modal-overlay" onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setSelectedGuest(null);
                            setIsEditing(false);
                        }
                    }}>
                        <div className="guest-detail-modal">
                            <div className="modal-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                                    <div className="modal-avatar">
                                        {selectedGuest.alias ? selectedGuest.alias.charAt(0).toUpperCase() : '👤'}
                                    </div>
                                    <div>
                                        <h2>{isEditing ? 'Configurar Invitado' : selectedGuest.alias || `${selectedGuest.firstName} ${selectedGuest.lastName}`}</h2>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#636e72' }}>{selectedGuest.email}</p>
                                    </div>
                                </div>
                                <button className="close-btn" onClick={() => { setSelectedGuest(null); setIsEditing(false); }}>×</button>
                            </div>

                            <div className="modal-content">
                                <div className="edit-toggle-row">
                                    <button
                                        className={`edit-toggle-btn ${isEditing ? 'active' : ''}`}
                                        onClick={() => setIsEditing(!isEditing)}
                                    >
                                        {isEditing ? '🚫 Cancelar' : '✏️ Editar Información'}
                                    </button>
                                </div>

                                <div className="modal-form-grid">
                                    <div className="form-group">
                                        <label>Alias (Ej: Vecino, Casa...)</label>
                                        <Input
                                            value={isEditing ? editForm.alias || '' : selectedGuest.alias || ''}
                                            onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })}
                                            disabled={!isEditing}
                                            placeholder="Asigna un alias para identificarlo rápido"
                                        />
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Nombre</label>
                                            <Input
                                                value={isEditing ? editForm.firstName || '' : selectedGuest.firstName || ''}
                                                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                                                disabled={!isEditing}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Apellido</label>
                                            <Input
                                                value={isEditing ? editForm.lastName || '' : selectedGuest.lastName || ''}
                                                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                                                disabled={!isEditing}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Tarifa Personalizada (€/kWh)</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                className="custom-web-input"
                                                value={isEditing ? editForm.ratePerKwh as any : selectedGuest.ratePerKwh}
                                                onChange={(e) => setEditForm({ ...editForm, ratePerKwh: e.target.value as any })}
                                                disabled={!isEditing}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Límite Mensual de Energía (kWh)</label>
                                            <Input
                                                type="number"
                                                value={isEditing ? editForm.energyLimit as any : selectedGuest.energyLimit || ''}
                                                onChange={(e) => setEditForm({ ...editForm, energyLimit: e.target.value as any })}
                                                disabled={!isEditing}
                                                placeholder="Sin límite"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {!isEditing && (
                                    <div className="modal-stats-section">
                                        <div className="stats-header">Histórico Acumulado</div>
                                        <div className="stats-row">
                                            <div className="stat-box">
                                                <span className="stat-label">Energía Total</span>
                                                <span className="stat-val">{Number(selectedGuest.totalEnergy || 0).toFixed(2)} kWh</span>
                                            </div>
                                            <div className="stat-box">
                                                <span className="stat-label">Costo Total</span>
                                                <span className="stat-val">€{Number(selectedGuest.totalCost || 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                {isEditing ? (
                                    <button className="btn-primary" onClick={handleUpdateGuest}>💾 Guardar Cambios</button>
                                ) : (
                                    <div className="footer-actions">
                                        <button className="btn-secondary" onClick={handleResetLimit}>
                                            🔄 Reiniciar Mes
                                        </button>
                                        <button
                                            className={`btn-action ${selectedGuest.isBlocked ? 'btn-unblock' : 'btn-block'}`}
                                            onClick={handleBlockToggle}
                                        >
                                            {selectedGuest.isBlocked ? '🔓 Desbloquear Acceso' : '🔒 Bloquear Acceso'}
                                        </button>
                                        <button className="btn-danger" onClick={handleRemoveGuest}>
                                            🗑️ Eliminar Invitado
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
};

export default GuestManagementScreen;
