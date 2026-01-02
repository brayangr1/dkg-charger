import React, { useState, useEffect } from 'react';
import { useDashboard, type Alert } from './DashboardContext';
import { useChargerWebSocket } from './useChargerWebSocket';
import { 
  getChargers, 
  resetCharger, 
  changeChargerAvailability, 
  clearChargerCache,
  remoteStartTransaction,
  remoteStopTransaction,
  unlockConnector
} from './api';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  if (!message) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '10px 20px',
    borderRadius: '5px',
    color: 'white',
    backgroundColor: type === 'success' ? 'green' : 'red',
    zIndex: 1000,
  };

  return (
    <div style={style}>
      {message}
      <button onClick={onClose} style={{ marginLeft: '10px', color: 'white', background: 'none', border: 'none' }}>X</button>
    </div>
  );
};

export default function Dashboard() {
  const { chargers: wsChargers, alerts, handleWebSocketMessage } = useDashboard();
  const [chargers, setChargers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  const [userId, setUserId] = useState<number>(1); // Valor por defecto para pruebas
  const [transactionId, setTransactionId] = useState<number>(1); // Valor por defecto para pruebas
  const [authError, setAuthError] = useState(false);

  const fetchChargers = async () => {
    try {
      setLoading(true);
      const response = await getChargers();
      setChargers(response.chargers || []);
      setAuthError(false);
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message && error.message.includes('401')) {
          setAuthError(true);
          showNotification('Error de autenticación. Por favor, inicia sesión primero.', 'error');
        } else {
          showNotification(`Error fetching chargers: ${error.message}`, 'error');
        }
      } else {
        showNotification(`An unknown error occurred while fetching chargers.`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChargers();
  }, []);

  const chargerIds = chargers.map(c => c.id);

  // Obtener token de autenticación
  const getAuthToken = () => {
    return localStorage.getItem('authToken');
  };

  useChargerWebSocket({
    token: getAuthToken() || '',
    chargerIds,
    onMessage: handleWebSocketMessage,
  });

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification({ message: '', type: '' });
    }, 5000);
  };

  const handleReset = async (serial: string) => {
    try {
      await resetCharger(serial, 'Soft');
      showNotification(`Charger ${serial} reset command sent.`, 'success');
    } catch (error: unknown) {
      if (error instanceof Error) {
        showNotification(`Error resetting charger: ${error.message}`, 'error');
      } else {
        showNotification(`An unknown error occurred while resetting charger.`, 'error');
      }
    }
  };

  const handleAvailability = async (serial: string, type: 'Inoperative' | 'Operative') => {
    try {
      await changeChargerAvailability(serial, 1, type);
      showNotification(`Charger ${serial} availability changed to ${type}.`, 'success');
    } catch (error: unknown) {
      if (error instanceof Error) {
        showNotification(`Error changing availability: ${error.message}`, 'error');
      } else {
        showNotification(`An unknown error occurred while changing availability.`, 'error');
      }
    }
  };

  const handleClearCache = async (serial: string) => {
    try {
      await clearChargerCache(serial);
      showNotification(`Charger ${serial} cache cleared.`, 'success');
    } catch (error: unknown) {
      if (error instanceof Error) {
        showNotification(`Error clearing cache: ${error.message}`, 'error');
      } else {
        showNotification(`An unknown error occurred while clearing cache.`, 'error');
      }
    }
  };

  const handleRemoteStart = async (serial: string) => {
    try {
      await remoteStartTransaction(serial, userId);
      showNotification(`Remote start command sent to charger ${serial}.`, 'success');
    } catch (error: unknown) {
      if (error instanceof Error) {
        showNotification(`Error sending remote start: ${error.message}`, 'error');
      } else {
        showNotification(`An unknown error occurred while sending remote start.`, 'error');
      }
    }
  };

  const handleRemoteStop = async (serial: string) => {
    try {
      await remoteStopTransaction(serial, transactionId);
      showNotification(`Remote stop command sent to charger ${serial}.`, 'success');
    } catch (error: unknown) {
      if (error instanceof Error) {
        showNotification(`Error sending remote stop: ${error.message}`, 'error');
      } else {
        showNotification(`An unknown error occurred while sending remote stop.`, 'error');
      }
    }
  };

  const handleUnlockConnector = async (serial: string) => {
    try {
      await unlockConnector(serial, 1);
      showNotification(`Unlock connector command sent to charger ${serial}.`, 'success');
    } catch (error: unknown) {
      if (error instanceof Error) {
        showNotification(`Error unlocking connector: ${error.message}`, 'error');
      } else {
        showNotification(`An unknown error occurred while unlocking connector.`, 'error');
      }
    }
  };

  if (loading) {
    return <div>Loading chargers...</div>;
  }

  return (
    <div>
      <Notification message={notification.message} type={notification.type as 'success' | 'error'} onClose={() => setNotification({ message: '', type: '' })} />
      <h1>Dashboard en Tiempo Real</h1>
      
      {authError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error de Autenticación:</strong> Para usar esta funcionalidad, necesitas iniciar sesión en la aplicación principal primero.
        </div>
      )}
      
      <div className="mb-4 p-4 bg-gray-100 rounded">
        <h2 className="text-lg font-semibold mb-2">Valores para comandos</h2>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium">User ID para RemoteStart:</label>
            <input
              type="number"
              value={userId}
              onChange={(e) => setUserId(Number(e.target.value))}
              className="border rounded px-2 py-1"
              disabled={authError}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Transaction ID para RemoteStop:</label>
            <input
              type="number"
              value={transactionId}
              onChange={(e) => setTransactionId(Number(e.target.value))}
              className="border rounded px-2 py-1"
              disabled={authError}
            />
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {chargers.map((charger: any) => (
          <div key={charger.id} style={{ border: '1px solid #ccc', padding: 16, minWidth: '300px' }}>
            <h2>{charger.name}</h2>
            <p>Serial: {charger.serial_number}</p>
            <p>Estado: {wsChargers[charger.id]?.status || charger.status}</p>
            <p>Network: {charger.network_status}</p>
            <p>Potencia: {wsChargers[charger.id]?.power || 0} kW</p>
            <p>Energía: {wsChargers[charger.id]?.energy || 0} kWh</p>
            <p>Usuario: {wsChargers[charger.id]?.user || '-'}</p>
            <p>Temp: {wsChargers[charger.id]?.temperature || '-'} °C</p>
            
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => handleReset(charger.serial_number)} disabled={authError}>Reset (Soft)</button>
              <button onClick={() => handleClearCache(charger.serial_number)} disabled={authError}>Clear Cache</button>
              <button onClick={() => handleAvailability(charger.serial_number, 'Operative')} disabled={authError}>Set Operative</button>
              <button onClick={() => handleAvailability(charger.serial_number, 'Inoperative')} disabled={authError}>Set Inoperative</button>
              <button onClick={() => handleRemoteStart(charger.serial_number)} disabled={authError}>Remote Start</button>
              <button onClick={() => handleRemoteStop(charger.serial_number)} disabled={authError}>Remote Stop</button>
              <button onClick={() => handleUnlockConnector(charger.serial_number)} disabled={authError}>Unlock Connector</button>
            </div>
          </div>
        ))}
      </div>
      <h2>Alertas recientes</h2>
      <ul>
        {alerts.map((alert: Alert) => (
          <li key={alert.id} style={{ color: alert.alertType === 'overheat' ? 'red' : 'orange' }}>
            [{new Date(alert.timestamp).toLocaleTimeString()}] Cargador #{alert.chargerId}: {alert.message} ({alert.value})
          </li>
        ))}
      </ul>
    </div>
  );
}