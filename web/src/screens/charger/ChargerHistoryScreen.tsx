import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import toast from 'react-hot-toast';
import { getChargingHistory } from '@services/chargerService';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import './ChargerHistoryScreen.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ChargerHistoryScreen: React.FC = () => {
    const { chargerId } = useParams<{ chargerId: string }>();
    const navigate = useNavigate();
    const [range, setRange] = useState<'week' | 'month' | 'year'>('week');
    const [history, setHistory] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [validSessions, setValidSessions] = useState<any[]>([]);

    useEffect(() => {
        if (chargerId) {
            loadHistory();
        }
    }, [chargerId, range]);

    const parseNumber = (value: any): number => {
        if (typeof value === 'number') return isFinite(value) ? value : 0;
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isFinite(parsed) ? parsed : 0;
        }
        return 0;
    };

    const loadHistory = async () => {
        try {
            setLoading(true);
            const data = await getChargingHistory(parseInt(chargerId!), range);
            
            // Asegurarnos de que los datos tengan la estructura esperada
            const sessions = data?.sessions || [];
            
            // Filtrar sesiones válidas (igual que en mobile)
            const filteredSessions = sessions.filter((session: any) => {
                const startTime = new Date(session.start_time);
                return startTime instanceof Date && 
                       !isNaN(startTime.getTime()) && 
                       isFinite(parseNumber(session.total_energy)) &&
                       session.total_energy !== null &&
                       session.total_energy !== undefined;
            });

            // Transformar datos al formato esperado por el frontend web
            const transformedSessions = filteredSessions.map((session: any) => ({
                ...session,
                energy: parseNumber(session.max_power_used || session.total_energy), // Mapear max_power_used a energy
                cost: parseNumber(session.estimated_cost), // Mapear estimated_cost a cost
                duration: Math.round(parseNumber(session.duration_seconds) / 60) // Convertir a minutos
            }));

            // Calcular totales
            const totalEnergy = transformedSessions.reduce((sum: number, session: any) => 
                sum + parseNumber(session.total_energy || session.energy), 0);
            
            const totalCost = transformedSessions.reduce((sum: number, session: any) => 
                sum + parseNumber(session.estimated_cost || session.cost), 0);

            setValidSessions(transformedSessions);
            setHistory({
                totalEnergy,
                totalCost,
                totalSessions: transformedSessions.length,
                sessions: transformedSessions
            });
            
        } catch (error) {
            console.error('Error loading history:', error);
            toast.error('Error al cargar historial');
        } finally {
            setLoading(false);
        }
    };

    // Preparar datos para el gráfico
    const chartData = {
        labels: validSessions.map(s => {
            const date = new Date(s.start_time);
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        }),
        datasets: [
            {
                label: 'Potencia máxima (kW)',
                data: validSessions.map(s => parseNumber(s.max_power_used || s.energy)),
                borderColor: 'rgba(17, 68, 85, 1)',
                backgroundColor: 'rgba(17, 68, 85, 0.1)',
                tension: 0.4,
                fill: true,
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                display: true,
                position: 'top' as const,
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)} kW`
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'kWh'
                }
            },
            x: {
                ticks: {
                    maxRotation: 45,
                    minRotation: 45
                }
            }
        }
    };

    return (
        <MainLayout>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <button 
                        className="back-button" 
                        onClick={() => navigate('/chargers/' + chargerId)}
                        style={{
                            background: 'none',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            padding: '0.5rem 1rem',
                            cursor: 'pointer',
                            fontSize: '16px'
                        }}
                    >
                        ← Volver
                    </button>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>Historial de Carga</h1>
                </div>

                <Card style={{ padding: '2rem' }}>
                    <div style={{ 
                        display: 'flex', 
                        gap: '1rem', 
                        marginBottom: '2rem',
                        flexWrap: 'wrap'
                    }}>
                        {(['week', 'month', 'year'] as const).map((timeRange) => (
                            <button
                                key={timeRange}
                                className={`btn ${range === timeRange ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => setRange(timeRange)}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '6px',
                                    border: `2px solid ${range === timeRange ? '#114455' : '#ddd'}`,
                                    background: range === timeRange ? '#114455' : 'transparent',
                                    color: range === timeRange ? 'white' : '#114455',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    fontWeight: '500',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {timeRange === 'week' ? 'Semana' : 
                                 timeRange === 'month' ? 'Mes' : 'Año'}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div className="spinner" style={{
                                border: '4px solid #f3f3f3',
                                borderTop: '4px solid #114455',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                animation: 'spin 1s linear infinite',
                                margin: '0 auto'
                            }}></div>
                            <p style={{ marginTop: '1rem', color: '#666' }}>Cargando historial...</p>
                        </div>
                    ) : (
                        <div>
                            {/* Estadísticas */}
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                                gap: '1.5rem', 
                                marginBottom: '2.5rem' 
                            }}>
                                <div style={{ 
                                    padding: '1.5rem', 
                                    background: 'var(--color-gray-50)', 
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                                        Energía Total
                                    </div>
                                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#114455' }}>
                                        {history?.totalEnergy?.toFixed(2) || '0.00'} kWh
                                    </div>
                                </div>
                                <div style={{ 
                                    padding: '1.5rem', 
                                    background: 'var(--color-gray-50)', 
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                                        Costo Total
                                    </div>
                                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#114455' }}>
                                        ${history?.totalCost?.toFixed(2) || '0.00'}
                                    </div>
                                </div>
                                <div style={{ 
                                    padding: '1.5rem', 
                                    background: 'var(--color-gray-50)', 
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                                        Sesiones
                                    </div>
                                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#114455' }}>
                                        {history?.totalSessions || 0}
                                    </div>
                                </div>
                            </div>

                            {/* Gráfico */}
                            {validSessions.length > 0 && (
                                <div style={{ 
                                    marginBottom: '3rem',
                                    padding: '1.5rem',
                                    background: '#fff',
                                    borderRadius: '12px',
                                    border: '1px solid #eee'
                                }}>
                                    <h3 style={{ marginBottom: '1rem', color: '#333' }}>
                                        Potencia máxima por sesión (kW)
                                    </h3>
                                    <div style={{ height: '300px' }}>
                                        <Line data={chartData} options={chartOptions} />
                                    </div>
                                    <div style={{ 
                                        display: 'flex', 
                                        gap: '2rem', 
                                        marginTop: '1.5rem',
                                        paddingTop: '1.5rem',
                                        borderTop: '1px solid #eee'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '14px', color: '#666' }}>
                                                Sesiones totales:
                                            </div>
                                            <div style={{ fontSize: '18px', fontWeight: '600' }}>
                                                {validSessions.length}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '14px', color: '#666' }}>
                                                Potencia máxima promedio:
                                            </div>
                                            <div style={{ fontSize: '18px', fontWeight: '600', color: '#114455' }}>
                                                {(validSessions.reduce((sum: number, s: any) => sum + parseNumber(s.max_power_used || s.energy), 0) / validSessions.length).toFixed(2)} kW
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Lista de sesiones */}
                            <div style={{ 
                                marginTop: '2rem',
                                borderTop: '1px solid #eee',
                                paddingTop: '2rem'
                            }}>
                                <h3 style={{ marginBottom: '1.5rem', color: '#114455' }}>
                                    Sesiones de carga
                                </h3>
                                
                                {history?.sessions?.length > 0 ? (
                                    <div style={{ 
                                        maxHeight: '500px', 
                                        overflowY: 'auto',
                                        borderRadius: '8px',
                                        border: '1px solid #eee'
                                    }}>
                                        {history.sessions.map((session: any, index: number) => (
                                            <div 
                                                key={index} 
                                                style={{ 
                                                    padding: '1.25rem', 
                                                    borderBottom: '1px solid #f0f0f0',
                                                    background: index % 2 === 0 ? '#fafafa' : 'white'
                                                }}
                                            >
                                                <div style={{ 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between',
                                                    alignItems: 'flex-start',
                                                    marginBottom: '0.75rem' 
                                                }}>
                                                    <div>
                                                        <strong style={{ fontSize: '16px', color: '#333' }}>
                                                            {new Date(session.start_time).toLocaleDateString('es-ES', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </strong>
                                                        <div style={{ 
                                                            fontSize: '14px', 
                                                            color: '#666',
                                                            marginTop: '0.25rem'
                                                        }}>
                                                            {new Date(session.start_time).toLocaleTimeString('es-ES', {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </div>
                                                    <span style={{ 
                                                        fontSize: '18px', 
                                                        fontWeight: '600',
                                                        color: '#114455'
                                                    }}>
                                                        {parseNumber(session.max_power_used || session.energy).toFixed(2)} kW
                                                    </span>
                                                </div>
                                                <div style={{ 
                                                    display: 'flex',
                                                    gap: '1.5rem',
                                                    fontSize: '14px', 
                                                    color: '#666' 
                                                }}>
                                                    <div>
                                                        <span style={{ fontWeight: '500' }}>Duración:</span>{' '}
                                                        {session.duration || Math.round(parseNumber(session.duration_seconds) / 60)} min
                                                    </div>
                                                    <div>
                                                        <span style={{ fontWeight: '500' }}>Costo:</span>{' '}
                                                        ${parseNumber(session.cost || session.estimated_cost).toFixed(2)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ 
                                        textAlign: 'center', 
                                        padding: '3rem', 
                                        color: '#666',
                                        background: '#fafafa',
                                        borderRadius: '8px'
                                    }}>
                                        <p style={{ fontSize: '18px', marginBottom: '0.5rem' }}>
                                            No hay sesiones en este período
                                        </p>
                                        <p style={{ fontSize: '14px', color: '#888' }}>
                                            Intenta cambiar el rango de tiempo
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </MainLayout>
    );
};

export default ChargerHistoryScreen;