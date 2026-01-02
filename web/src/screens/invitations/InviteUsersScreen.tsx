import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import toast from 'react-hot-toast';
import { getMyChargers } from '@services/chargerService';
import { getInvitations, sendInvitation, cancelInvitation, Invitation } from '@services/invitationService';
import './InviteUsersScreen.css';

interface Charger {
    id: number;
    name: string;
}

const InviteUsersScreen: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [selectedChargerId, setSelectedChargerId] = useState<number | ''>('');
    const [accessLevel, setAccessLevel] = useState<'user' | 'admin'>('user');
    const [chargers, setChargers] = useState<Charger[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [chargersData, invitationsData] = await Promise.all([
                getMyChargers(),
                getInvitations()
            ]);

            const allChargers = chargersData.chargers || [];
            const uniqueChargers = allChargers.filter((charger: Charger, index: number, self: Charger[]) =>
                index === self.findIndex((c: Charger) => c.id === charger.id)
            );
            setChargers(uniqueChargers);
            setInvitations(invitationsData.invitations || []);
        } catch (error) {
            console.error('Error loading data:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const handleSendInvitation = async () => {
        if (!email || !selectedChargerId) {
            toast.error('Por favor completa todos los campos');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Por favor ingresa un correo electrónico válido');
            return;
        }

        setSending(true);
        try {
            await sendInvitation(email, Number(selectedChargerId), accessLevel);
            toast.success('Invitación enviada correctamente');
            setEmail('');
            loadData(); // Reload list
        } catch (error: any) {
            console.error('Error sending invitation:', error);
            toast.error(error.response?.data?.error || 'No se pudo enviar la invitación');
        } finally {
            setSending(false);
        }
    };

    const handleCancelInvitation = async (id: number) => {
        if (!window.confirm('¿Estás seguro de que deseas cancelar esta invitación?')) return;

        try {
            await cancelInvitation(id);
            toast.success('Invitación cancelada');
            loadData(); // Reload list
        } catch (error: any) {
            console.error('Error canceling invitation:', error);
            toast.error('No se pudo cancelar la invitación');
        }
    };

    return (
        <MainLayout>
            <div className="invite-users-screen-enhanced">
                {/* Header */}
                <div className="screen-header">
                    <button className="back-btn-modern" onClick={() => navigate(-1)}>
                        <span>←</span> Volver
                    </button>
                    <h1>📤 Invitar Usuarios</h1>
                </div>

                {/* Form Section */}
                <div className="form-card">
                    <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#2d3436' }}>Nueva Invitación</h2>

                    <div className="form-group-modern">
                        <label className="form-label-modern">Correo Electrónico del Invitado</label>
                        <input
                            className="input-modern"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="usuario@ejemplo.com"
                            type="email"
                        />
                    </div>

                    <div className="form-row-modern">
                        <div className="form-group-modern">
                            <label className="form-label-modern">Seleccionar Cargador</label>
                            <select
                                className="select-modern"
                                value={selectedChargerId}
                                onChange={(e) => setSelectedChargerId(Number(e.target.value))}
                            >
                                <option value="">Seleccione...</option>
                                {chargers.map(charger => (
                                    <option key={charger.id} value={charger.id}>
                                        {charger.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group-modern">
                            <label className="form-label-modern">Nivel de Acceso</label>
                            <select
                                className="select-modern"
                                value={accessLevel}
                                onChange={(e) => setAccessLevel(e.target.value as 'user' | 'admin')}
                            >
                                <option value="user">Usuario (Solo Carga)</option>
                                <option value="admin">Administrador (Total)</option>
                            </select>
                        </div>
                    </div>

                    <button
                        className="btn-invite-primary"
                        onClick={handleSendInvitation}
                        disabled={sending || !email || !selectedChargerId}
                    >
                        {sending ? 'Enviando...' : '✉️ Enviar Invitación'}
                    </button>
                </div>

                {/* List Section */}
                <div>
                    <div className="history-section-title">
                        <span>📋</span> Invitaciones Enviadas
                    </div>

                    {loading ? (
                        <div className="empty-list">Cargando...</div>
                    ) : invitations.length === 0 ? (
                        <div className="empty-list">No hay invitaciones pendientes</div>
                    ) : (
                        <div>
                            {invitations.map(invitation => (
                                <div key={invitation.id} className="invitation-card">
                                    <div>
                                        <div className="invite-email">{invitation.guest_email}</div>
                                        <div className="invite-meta">
                                            <span>🔌 Cargador #{invitation.charger_id}</span>
                                            <span className={`badge-status ${invitation.status}`}>
                                                {invitation.status === 'pending' ? 'Pendiente' :
                                                    invitation.status === 'accepted' ? 'Aceptada' : invitation.status}
                                            </span>
                                            <span>👤 {invitation.access_level === 'admin' ? 'Admin' : 'Usuario'}</span>
                                        </div>
                                    </div>

                                    {invitation.status === 'pending' && (
                                        <button
                                            className="btn-cancel"
                                            onClick={() => handleCancelInvitation(invitation.id)}
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default InviteUsersScreen;

