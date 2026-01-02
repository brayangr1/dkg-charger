import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import toast from 'react-hot-toast';
import { getUserData, getToken } from '@services/authService';
import { claimCharger } from '@services/chargerService';
import Modal from '../../components/layout/Modal';
import './AddChargerScreen.css';
import { url_global } from '@/constants/config';

function AddChargerScreen() {
    const navigate = useNavigate();
    const [serialNumber, setSerialNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Modal states
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);

    const [claimLoading, setClaimLoading] = useState(false);

    const validateSerialNumber = (serial: string): boolean => {
        const trimmed = serial.trim();
        return trimmed.length > 0 && trimmed.length <= 50;
    };

    const handleAddCharger = async () => {
        if (!serialNumber) {
            setErrorMessage('Por favor introduce el número de serie');
            setShowErrorModal(true);
            return;
        }

        if (!validateSerialNumber(serialNumber)) {
            setErrorMessage('El número de serie no es válido.');
            setShowErrorModal(true);
            return;
        }

        setIsLoading(true);
        setErrorMessage('');

        try {
            const token = await getToken();
            if (!token) {
                toast.error('No estás autenticado. Por favor, inicia sesión nuevamente.');
                navigate('/login');
                return;
            }

            // Normalizar serial: quitar espacios y convertir a mayúsculas para evitar duplicados
            const normalizedSerial = serialNumber.trim().toUpperCase();

            const response = await fetch(`${url_global}/api/chargers/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ serial: normalizedSerial })
            });

            const data = await response.json();

            if (!response.ok) {
                // Si el dispositivo no existe en la base maestra, puede ser un cargador de tercero
                if (response.status === 404 || (data && /no encontrado/i.test(data.error || ''))) {
                    // Mostrar modal para reclamar (asociar) el cargador si ya existe en chargers (registrado vía OCPP)
                    setShowClaimModal(true);
                    return;
                }
                throw new Error(data.error || 'Error al agregar cargador');
            }

            if (data.action === 'claimed') {
                setSuccessMessage('¡Cargador reclamado y asociado exitosamente!');
            } else {
                setSuccessMessage('¡Cargador agregado exitosamente!');
            }
            setShowSuccessModal(true);

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'No se pudo agregar el cargador.';
            setErrorMessage(msg);
            setShowErrorModal(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClaimConfirm = async () => {
        setClaimLoading(true);
        try {
            const user = await getUserData();
            if (!user) {
                toast.error('No estás autenticado. Por favor, inicia sesión nuevamente.');
                navigate('/login');
                return;
            }

            const normalizedSerial = serialNumber.trim().toUpperCase();
            await claimCharger(normalizedSerial);

            setShowClaimModal(false);
            setSuccessMessage('¡Cargador reclamado exitosamente!');
            setShowSuccessModal(true);

        } catch (error: any) {
            const msg = error.response?.data?.error || error.message || 'Error al reclamar cargador';

            if (msg.includes('ya está asociado')) {
                setErrorMessage('Este cargador ya tiene dueño');
            } else if (msg.includes('Ya eres el propietario')) {
                setErrorMessage('Ya eres dueño de este cargador');
            } else {
                setErrorMessage(msg);
            }
            setShowErrorModal(true);
        } finally {
            setClaimLoading(false);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        navigate('/chargers/mine');
    };

    return (
        <MainLayout>
            <div className="add-charger-screen">
                <div className="add-charger-header">
                    <button className="back-button" onClick={() => navigate(-1)}>
                        ← Volver
                    </button>
                    <h1>➕ Añadir Nuevo Cargador</h1>
                </div>

                <Card>
                    <div className="add-charger-form">
                        <div className="form-group">
                            <label htmlFor="serialNumber" className="form-label">
                                Número de Serie
                            </label>
                            <Input
                                id="serialNumber"
                                value={serialNumber}
                                onChange={(e) => setSerialNumber(e.target.value)}
                                placeholder="Ej. ABC123456"
                                disabled={isLoading}
                                autoComplete="off"
                                autoCapitalize="characters"
                                maxLength={50} />
                            <p className="help-text">
                                Ingresa el número de serie que aparece en la etiqueta del cargador
                            </p>
                        </div>

                        <Button
                            variant="primary"
                            size="lg"
                            onClick={handleAddCharger}
                            disabled={isLoading || !serialNumber || !validateSerialNumber(serialNumber)}
                            loading={isLoading}
                            fullWidth
                        >
                            {isLoading ? 'Añadiendo...' : '➕ Añadir Cargador'}
                        </Button>
                    </div>
                </Card>

                <Card>
                    <div className="instructions">
                        <h3>ℹ️ Cómo encontrar el número de serie</h3>
                        <ol>
                            <li>Localiza la etiqueta en la parte posterior del cargador</li>
                            <li>Busca el campo "Serial Number" o "Nº Serie"</li>
                            <li>Copia exactamente lo que aparece en la etiqueta</li>
                        </ol>
                        <p className="note">
                            <strong>Nota:</strong> El número de serie es único para cada cargador y
                            es necesario para registrarlo en la plataforma.
                        </p>
                    </div>
                </Card>

                {/* Modal para reclamar cargador */}
                <Modal
                    isOpen={showClaimModal}
                    onClose={() => setShowClaimModal(false)}
                    title="Cargador no encontrado en base DKG"
                >
                    <div className="claim-modal-content">
                        <p>Parece que este cargador no está en la base de fábrica. Si el cargador se conectó vía OCPP anteriormente, puedes reclamarlo y asociarlo a tu cuenta.</p>
                        <div className="modal-actions">
                            <Button
                                variant="secondary"
                                onClick={() => setShowClaimModal(false)}
                                disabled={claimLoading}
                            >
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleClaimConfirm}
                                loading={claimLoading}
                                disabled={claimLoading}
                            >
                                Reclamar cargador
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Success Modal */}
                <Modal
                    isOpen={showSuccessModal}
                    onClose={handleSuccessClose}
                    title="¡Éxito!"
                >
                    <div className="claim-modal-content">
                        <p>{successMessage}</p>
                        <div className="modal-actions">
                            <Button
                                variant="primary"
                                onClick={handleSuccessClose}
                            >
                                Aceptar
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Error Modal */}
                <Modal
                    isOpen={showErrorModal}
                    onClose={() => setShowErrorModal(false)}
                    title="Error"
                >
                    <div className="claim-modal-content">
                        <p className="error-text">{errorMessage}</p>
                        <div className="modal-actions">
                            <Button
                                variant="primary"
                                onClick={() => setShowErrorModal(false)}
                            >
                                Entendido
                            </Button>
                        </div>
                    </div>
                </Modal>
            </div>
        </MainLayout>
    );
}

export default AddChargerScreen;
