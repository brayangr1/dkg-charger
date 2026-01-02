import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import websocketService, {  } from '@services/websocketService';

interface ChargingData {
  chargerId: number;
  energy: number;
  power: number;
  duration: number;
  cost: number;
  ratePerKwh?: number;
  timestamp: string;
}

interface ChargingContextType {
  chargingData: Map<number, ChargingData>;
  updateChargingData: (data: ChargingData) => void;
  getChargingData: (chargerId: number) => ChargingData | undefined;
  clearChargingData: (chargerId: number) => void;
}

const ChargingContext = createContext<ChargingContextType | undefined>(undefined);

export const useCharging = () => {
  const context = useContext(ChargingContext);
  if (!context) {
    throw new Error('useCharging must be used within a ChargingProvider');
  }
  return context;
};

interface ChargingProviderProps {
  children: ReactNode;
}

export const ChargingProvider: React.FC<ChargingProviderProps> = ({ children }) => {
  const [chargingData, setChargingData] = useState<Map<number, ChargingData>>(new Map());

  // Escuchar eventos de actualización de carga desde WebSocket
  useEffect(() => {
    const handleChargingUpdate = (data: ChargingData) => {
      updateChargingData(data);
    };

    // Usar el EventEmitter del websocketService
    websocketService.onChargingUpdate(handleChargingUpdate);

    return () => {
      websocketService.offChargingUpdate(handleChargingUpdate);
    };
  }, []);

  const updateChargingData = (data: ChargingData) => {
    setChargingData(prev => {
      const newMap = new Map(prev);
      newMap.set(data.chargerId, data);
      return newMap;
    });
  };

  const getChargingData = (chargerId: number) => {
    return chargingData.get(chargerId);
  };

  const clearChargingData = (chargerId: number) => {
    setChargingData(prev => {
      const newMap = new Map(prev);
      newMap.delete(chargerId);
      return newMap;
    });
  };

  const value: ChargingContextType = {
    chargingData,
    updateChargingData,
    getChargingData,
    clearChargingData,
  };

  return (
    <ChargingContext.Provider value={value}>
      {children}
    </ChargingContext.Provider>
  );
};