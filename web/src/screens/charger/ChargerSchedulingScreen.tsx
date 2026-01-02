import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import toast from 'react-hot-toast';
import { addChargingSchedule } from '@services/chargerService';

const ChargerSchedulingScreen: React.FC = () => {
    const { chargerId } = useParams<{ chargerId: string }>();
    const navigate = useNavigate();
    const [scheduleName, setScheduleName] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [weekDays, setWeekDays] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const toggleDay = (day: string) => {
        setWeekDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const handleAddSchedule = async () => {
        if (!scheduleName || !startTime || !endTime || weekDays.length === 0) {
            toast.error('Por favor completa todos los campos');
            return;
        }

        setLoading(true);
        try {
            const result = await addChargingSchedule(parseInt(chargerId!), {
                schedule_name: scheduleName,
                start_time: startTime,
                end_time: endTime,
                week_days: weekDays,
                action: 'charge'
            });

            if (result.success) {
                toast.success('Programación creada');
                navigate('/chargers/' + chargerId);
            } else {
                toast.error(result.error || 'Error al crear programación');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <MainLayout>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <button className="back-button" onClick={() => navigate('/chargers/' + chargerId)}>
                        ← Volver
                    </button>
                    <h1 style={{ margin: 0 }}>Programar Carga</h1>
                </div>

                <Card>
                    <h2>Nueva Programación</h2>

                    <Input
                        label="Nombre de la Programación"
                        value={scheduleName}
                        onChange={(e) => setScheduleName(e.target.value)}
                        placeholder="Ej: Carga Nocturna"
                        fullWidth
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <Input
                            label="Hora de Inicio"
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            fullWidth
                        />
                        <Input
                            label="Hora de Fin"
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            fullWidth
                        />
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                        <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                            Días de la Semana
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {days.map((day) => (
                                <button
                                    key={day}
                                    onClick={() => toggleDay(day)}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        borderRadius: '0.5rem',
                                        border: '2px solid var(--color-primary)',
                                        background: weekDays.includes(day) ? 'var(--color-primary)' : 'transparent',
                                        color: weekDays.includes(day) ? 'white' : 'var(--color-primary)',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem' }}>
                        <Button
                            fullWidth
                            variant="primary"
                            size="lg"
                            onClick={handleAddSchedule}
                            loading={loading}
                            disabled={loading}
                        >
                            📅 Crear Programación
                        </Button>
                    </div>
                </Card>
            </div>
        </MainLayout>
    );
};

export default ChargerSchedulingScreen;
