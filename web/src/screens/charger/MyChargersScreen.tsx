import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import {
    IoFlash,
    //IoTrash,
    IoAdd,
    IoFlashOff,
} from 'react-icons/io5';
import { toast } from 'react-hot-toast';
import {
    getMyChargers,
    // deleteCharger, unlinkCharger 
} from '../../services/chargerService';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import './MyChargersScreen.css';


interface Charger {
    id: number;
    name: string;
    status: string;
    serial_number: string;
    max_power: number;
    charger_type: string;
    charger_vendor: string;
    owner_id: number;
    charger_box_serial_number: string;
    model: string;
    charger_ip: string;
    device_status: string;
    network_status: string;
}

const MyChargersScreen: React.FC = () => {
    const [chargers, setChargers] = useState<Charger[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        fetchChargers();
    }, []);

    const fetchChargers = async () => {
        try {
            const data: any = await getMyChargers();
            const allChargers = data.chargers || [];
            // Filter duplicates based on charger ID
            const uniqueChargers = allChargers.filter((charger: Charger, index: number, self: Charger[]) =>
                index === self.findIndex((c: Charger) => c.id === charger.id)
            );
            setChargers(uniqueChargers);
        } catch (error) {
            console.error('Error fetching chargers:', error);
            toast.error('Error al cargar los cargadores');
        } finally {
            setLoading(false);
        }
    };


    {/* const handleUnlinkCharger = async () => {
        if (!confirm('⚠️ ¿Desvincular el cargador? Ya no podrás gestionarlo desde tu cuenta.')) return;

        try {
            const result: any = await unlinkCharger(parseInt(chargerId!));
            toast.success(result.message || '✅ Cargador desvinculado');
            setTimeout(() => navigate('/'), 2000);
        } catch (error: any) {
            toast.error(error.message || 'Error al desvincular');
        }
    };

    
    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!window.confirm('¿Estás seguro que deseas eliminar este cargador?')) return;

        try {
            await deleteCharger(id);
            toast.success('Cargador eliminado correctamente');
            fetchChargers();
        } catch (error) {
            console.error('Error deleting charger:', error);
            toast.error('Error al eliminar el cargador');
        }
    };*/}

    const getStatusColor = (network_status: string) => {
        switch (network_status) {
            case 'charging': return '#4CAF50';
            case 'standby': return '#2196F3';
            case 'locked': return '#FFC107';
            case 'error': return '#F44336';
            case 'offline': return '#757575';
            case 'available': return '#00BCD4';
            case 'online': return '#8BC34A';
            default: return '#9E9E9E';
        }
    };

    /* const translateStatus = (status: string) => {
         switch (status) {
             case 'charging': return 'Cargando';
             case 'standby': return 'Listo';
             case 'locked': return 'Bloqueado';
             case 'error': return 'Error';
             default: return status;
         }
     };*/

    if (loading) {
        return (
            <MainLayout>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando cargadores...</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="my-chargers-container">
                <div className="my-chargers-header">
                    <h1>Mis Cargadores</h1>
                    {!user?.isGuest && (
                        <Button variant="primary" size="md" onClick={() => navigate('/chargers/claim')}>
                            <IoAdd size={20} />
                            Asociar Nuevo Cargador
                        </Button>
                    )}
                </div>

                {chargers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">⚡</div>
                        <h2>No tienes cargadores asociados</h2>
                        <p>Puedes asociar un nuevo cargador haciendo clic en el botón de arriba</p>
                    </div>
                ) : (
                    <div className="chargers-grid">
                        {chargers.map((charger) => (
                            <Card
                                key={charger.id}
                                className="charger-card modern-card"
                                onClick={() => navigate(`/chargers/${charger.id}`)}
                            >
                                <div className="card-status-indicator" style={{ background: getStatusColor(charger.network_status) }} />

                                <div className="card-top">
                                    {charger.network_status === 'online' ? (
                                        <IoFlash
                                            className="charger-icon-big"
                                            style={{ color: getStatusColor(charger.network_status) }}
                                        />
                                    ) : (
                                        <IoFlashOff
                                            className="charger-icon-big"
                                            style={{ color: getStatusColor(charger.network_status) }}
                                        />
                                    )}

                                    <div>
                                        <h3 className="charger-name-modern">{charger.name}</h3>
                                        <p className="charger-model-modern">Modelo: {charger.charger_type}</p>
                                        <p className="charger-status-modern">Serial: {charger.serial_number}</p>
                                        <p className="charger-status-modern">Marca: {charger.charger_vendor}</p>
                                        <p className="charger-status-modern">IP: {charger.charger_ip}</p>
                                        <p className="charger-status-modern">Potencia Máxima: {charger.max_power} kW</p>


                                    </div>
                                </div>


                            </Card>
                        ))}
                    </div>

                )}
            </div>
        </MainLayout>
    );
};

export default MyChargersScreen;