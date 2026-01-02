import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import toast from 'react-hot-toast';
import {
    getChargerSettings,
    updateChargerSettings,
    resetCharger,
    restoreCharger,
    unlinkCharger,
    resetOcppCharger,
    // unlockOcppConnector,
    type ChargerSettings as ChargerSettingsType
} from '@services/chargerService';
import './ChargerSettingsScreen.css';
import { url_global } from '@constants/config';

const ChargerSettingsScreen: React.FC = () => {
    const { chargerId } = useParams<{ chargerId: string }>();
    const navigate = useNavigate();
    const [settings, setSettings] = useState<ChargerSettingsType | null>(null);
    const [chargerDetails, setChargerDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [maxCurrent, setMaxCurrent] = useState<number>(32);

    // WiFi states
    const [wifiSSID, setWifiSSID] = useState('');
    const [wifiPassword, /*setWifiPassword*/] = useState('');

    useEffect(() => {
        if (chargerId) {
            loadAllSettings();
        }
    }, [chargerId]);

    const loadAllSettings = async () => {
        try {
            setLoading(true);
            const [settingsData, detailsResponse] = await Promise.all([
                getChargerSettings(parseInt(chargerId!)),
                fetch(`${url_global}/api/chargers/${chargerId}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` }
                })
            ]);

            setSettings(settingsData);
            setWifiSSID(settingsData.network?.wifiSSID || '');

            if (detailsResponse.ok) {
                const details = await detailsResponse.json();
                setChargerDetails(details.charger);
                setMaxCurrent(details.charger.max_current || 32);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            toast.error('Error al cargar configuración');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!settings || !chargerId) return;

        setSaving(true);
        try {
            // Update network settings
            const updatedSettings = {
                ...settings,
                network: {
                    wifiSSID: wifiSSID,
                    wifiPassword: wifiPassword
                }
            };

            await updateChargerSettings(parseInt(chargerId), updatedSettings);
            toast.success('✅ Configuración guardada correctamente');
        } catch (error: any) {
            toast.error(error.message || 'Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleResetCharger = async () => {
        if (!confirm('⚠️ ¿Reiniciar el cargador? Esta acción no se puede deshacer.')) return;

        try {
            const result: any = await resetCharger(parseInt(chargerId!));
            toast.success(result.message || '✅ Cargador reiniciado');
            setTimeout(() => loadAllSettings(), 2000);
        } catch (error: any) {
            toast.error(error.message || 'Error al reiniciar');
        }
    };

    const handleRestoreFactory = async () => {
        if (!confirm('⚠️ ¿Restaurar a valores de fábrica? Se perderán TODAS las configuraciones personalizadas.')) return;

        try {
            const result: any = await restoreCharger(parseInt(chargerId!));
            toast.success(result.message || '✅ Restaurado a valores de fábrica');
            setTimeout(() => navigate('/'), 3000);
        } catch (error: any) {
            toast.error(error.message || 'Error al restaurar');
        }
    };

    const handleUnlinkCharger = async () => {
        if (!confirm('⚠️ ¿Desvincular el cargador? Ya no podrás gestionarlo desde tu cuenta.')) return;

        try {
            const result: any = await unlinkCharger(parseInt(chargerId!));
            toast.success(result.message || '✅ Cargador desvinculado');
            setTimeout(() => navigate('/'), 2000);
        } catch (error: any) {
            toast.error(error.message || 'Error al desvincular');
        }
    };

    const handleOcppReset = async (type: 'Hard' | 'Soft') => {
        if (!chargerDetails?.serial_number || !confirm(`¿Realizar reset ${type} OCPP?`)) return;

        try {
            await resetOcppCharger(chargerDetails.serial_number, type);
            toast.success(`✅ Reset ${type} ejecutado`);
        } catch (error: any) {
            toast.error(error.message || 'Error en reset OCPP');
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', flexDirection: 'column', gap: 20 }}>
                    <div className="spinner"></div>
                    <p style={{ color: '#636e72' }}>Cargando configuración...</p>
                </div>
            </MainLayout>
        );
    }

    if (!settings) return null;

    return (
        <MainLayout>
            <div className="charger-settings-enhanced">
                <div className="settings-header">
                    <button className="back-button" onClick={() => navigate('/chargers/' + chargerId)}>
                        ← Volver
                    </button>
                    <h1>⚙️ Ajustes del Cargador</h1>
                </div>

                {/* Charger Information */}
                <div className="settings-card">
                    <h2>📋 Información del Cargador</h2>
                    <div className="info-grid">
                        <div className="info-item">
                            <span className="label">Nombre</span>
                            <span className="value">{chargerDetails?.name || settings.name}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Modelo</span>
                            <span className="value">{chargerDetails?.model || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Serial</span>
                            <span className="value">{chargerDetails?.serial_number || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Firmware</span>
                            <span className="value">{chargerDetails?.firmware_version || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">MAC Address</span>
                            <span className="value">{chargerDetails?.mac_address || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Marca</span>
                            <span className="value">{chargerDetails?.charger_vendor || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">IP Local</span>
                            <span className="value">{chargerDetails?.charger_ip || 'N/A'}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Capacidad</span>
                            <span className="value">32A (7.4kW)</span>
                        </div>
                    </div>
                </div>

                {/* Network & WiFi Configuration 
                <div className="settings-card">
                    <h2>📡 Configuración de Red WiFi</h2>
                    <p style={{ color: '#636e72', marginBottom: 20, fontSize: '14px' }}>
                        Gestiona la conexión inalámbrica de tu cargador. Requiere reinicio para aplicar cambios.
                    </p>

                    <div className="wifi-section">
                        {chargerDetails?.wifi_ssid && (
                            <div className="connected-wifi-info">
                                <div className="wifi-icon">📶</div>
                                <div>
                                    <div className="connected-label">Red Actual</div>
                                    <div className="connected-ssid">{chargerDetails.wifi_ssid}</div>
                                </div>
                            </div>
                        )}

                        {chargerDetails?.pending_wifi_config && (
                            <div className="pending-config-warning">
                                <span>⏳</span>
                                <div>
                                    <strong>Cambio pendiente:</strong> Se aplicará "{JSON.parse(chargerDetails.pending_wifi_config).ssid}" en el próximo reinicio.
                                </div>
                            </div>
                        )}

                        <div className="wifi-inputs">
                            <div className="custom-input-group">
                                <label>SSID (Nombre de Red)</label>
                                <input
                                    className="custom-input"
                                    value={wifiSSID}
                                    onChange={(e) => setWifiSSID(e.target.value)}
                                    placeholder="Ej: MiCasa_WiFi"
                                />
                            </div>
                            <div className="custom-input-group">
                                <label>Contraseña WiFi</label>
                                <input
                                    className="custom-input"
                                    type="password"
                                    value={wifiPassword}
                                    onChange={(e) => setWifiPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>
                </div>*/}

                {/* Basic Settings */}
                <div className="settings-card">
                    <h2>⚙️ Configuración de Potencia</h2>
                    <div className="custom-input-group">
                        <label>Nombre del Dispositivo</label>
                        <input
                            className="custom-input"
                            value={settings.name}
                            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                        />
                    </div>

                    <div className="range-container">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <label style={{ fontWeight: 600, color: '#2d3436' }}>Corriente Máxima de Carga</label>
                            <span style={{ fontWeight: 800, color: '#0984e3', fontSize: '18px' }}>{maxCurrent} A</span>
                        </div>
                        <input
                            type="range"
                            min="6"
                            max="32"
                            step="1"
                            value={maxCurrent}
                            onChange={(e) => setMaxCurrent(parseInt(e.target.value))}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#636e72', marginTop: 5 }}>
                            <span>6A (Min)</span>
                            <span>32A (Max)</span>
                        </div>
                    </div>
                </div>

                {/* OCPP Operations */}
                <div className="settings-card">
                    <h2>🔌 Operaciones OCPP</h2>
                    <p style={{ color: '#636e72', marginBottom: 20 }}>Acciones avanzadas para gestión del protocolo.</p>
                    <div className="action-grid">
                        <button className="btn-settings btn-secondary" onClick={() => handleOcppReset('Soft')}>
                            🔄 Reset Suave OCPP
                        </button>
                        {/* More advanced buttons can be added here */}
                    </div>
                </div>

                {/* Factory Actions */}
                <div className="settings-card">
                    <h2>🏭 Zona de Peligro</h2>
                    <div className="warning-text">
                        ⚠️ <strong>ADVERTENCIA:</strong> Estas acciones afectan la operatividad del cargador. Procede con precaución.
                    </div>
                    <div className="action-grid">
                        <button className="btn-settings btn-danger-soft" onClick={handleResetCharger}>
                            🔄 Reiniciar Sistema
                        </button>
                        <button className="btn-settings btn-danger-soft" onClick={handleRestoreFactory}>
                            ⚙️ Restaurar Fábrica
                        </button>
                        <button className="btn-settings btn-danger-solid" onClick={handleUnlinkCharger}>
                            🔗 Desvincular Cargador
                        </button>
                    </div>
                </div>

                {/* Save Button */}
                <div style={{ marginTop: 30, marginBottom: 50 }}>
                    <button
                        className="btn-settings btn-save"
                        onClick={handleSaveSettings}
                        disabled={saving}
                    >
                        {saving ? 'Guardando...' : '💾 Guardar Toda la Configuración'}
                    </button>
                </div>
            </div>
        </MainLayout>
    );
};

export default ChargerSettingsScreen;
