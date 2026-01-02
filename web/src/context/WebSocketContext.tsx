import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import websocketService, {  } from '@services/websocketService';
import { useAuth } from './AuthContext';

// Definimos el tipo para el estado de un cargador
interface ChargerState {
  status?: string;
  networkStatus?: string;
  // Aquí se pueden añadir más campos como energy, power, etc. si se necesita
}

interface WebSocketContextType {
  isConnected: boolean;
  chargerStates: Map<number, ChargerState>; // Un mapa para guardar el estado de cada cargador
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribeToCharger: (chargerId: number) => void;
  unsubscribeFromCharger: (chargerId: number) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  chargerStates: new Map(),
  connect: async () => { },
  disconnect: () => { },
  subscribeToCharger: () => { },
  unsubscribeFromCharger: () => { },
});

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [chargerStates, setChargerStates] = useState<Map<number, ChargerState>>(new Map());

  // El handler para la actualización de estado
  const handleStatusUpdate = (data: { chargerId: number; status: string; networkStatus: string }) => {
    console.log('[WebSocketContext] Received status update event. Updating context state.', data);
    setChargerStates(prevStates => {
      const newState = prevStates.get(data.chargerId);
      // Solo actualizar si hay un cambio real
      if (!newState || newState.status !== data.status || newState.networkStatus !== data.networkStatus) {
        const newStates = new Map(prevStates);
        newStates.set(data.chargerId, { 
          status: data.status, 
          networkStatus: data.networkStatus 
        });
        return newStates;
      }
      return prevStates;
    });
  };

  useEffect(() => {
    if (user) {
      // Connect to WebSocket when user is authenticated
      handleConnect();
      
      // Suscribirse a los eventos del websocket service
      websocketService.onStatusUpdate(handleStatusUpdate);
    } else {
      // Disconnect when user logs out
      websocketService.disconnect();
      setIsConnected(false);
      setChargerStates(new Map());
    }

    return () => {
      websocketService.offStatusUpdate(handleStatusUpdate);
      websocketService.disconnect();
    };
  }, [user]);

  const handleConnect = async () => {
    try {
      await websocketService.connect();
      setIsConnected(websocketService.isWebSocketConnected());
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  };

  const handleDisconnect = () => {
    websocketService.disconnect();
    setIsConnected(false);
  };

  const subscribeToCharger = (chargerId: number) => {
    websocketService.subscribeToCharger(chargerId);
  };

  const unsubscribeFromCharger = (chargerId: number) => {
    websocketService.unsubscribeFromCharger(chargerId);
  };

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        chargerStates, // Exponer el estado de los cargadores
        connect: handleConnect,
        disconnect: handleDisconnect,
        subscribeToCharger,
        unsubscribeFromCharger,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};