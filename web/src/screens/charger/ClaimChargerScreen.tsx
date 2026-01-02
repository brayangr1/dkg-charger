import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { associateCharger } from '../../services/chargerService';
import './ClaimChargerScreen.css';

const ClaimChargerScreen: React.FC = () => {
    const [serial, setSerial] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleClaim = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serial.trim()) {
            toast.error('Por favor introduce el número de serie');
            return;
        }

        setLoading(true);
        try {
            await associateCharger(serial);
            toast.success('Cargador asociado correctamente');
            navigate('/chargers'); // Redirect to My Chargers list
        } catch (error: any) {
            console.error('Error claiming charger:', error);
            const msg = error.response?.data?.error || error.response?.data?.message || 'Error al reclamar cargador';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="claim-charger-container">
            <div className="claim-charger-card">
                <div className="claim-charger-header">
                    <h1>Reclamar / Asociar Cargador</h1>
                    <p>Introduce el número de serie de tu cargador para asociarlo a tu cuenta.</p>
                </div>

                <form className="claim-form" onSubmit={handleClaim}>
                    <div className="form-group">
                        <label htmlFor="serial">Número de serie</label>
                        <input
                            id="serial"
                            type="text"
                            value={serial}
                            onChange={(e) => setSerial(e.target.value)}
                            placeholder="Ej. 788857"
                            disabled={loading}
                        />
                    </div>

                    <div className="claim-actions">
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={() => navigate(-1)}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="claim-button"
                            disabled={loading}
                        >
                            {loading ? 'Procesando...' : 'Reclamar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClaimChargerScreen;
