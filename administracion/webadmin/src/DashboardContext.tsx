import { createContext, useState, useContext, type ReactNode } from 'react';

export interface Charger {
  [key: string]: any;
}
export interface Alert {
  id: string | number;
  chargerId: number;
  alertType: string;
  message: string;
  value?: number;
  timestamp: string;
}

interface DashboardContextType {
  chargers: Record<number, Charger>;
  alerts: Alert[];
  handleWebSocketMessage: (data: any) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [chargers, setChargers] = useState<Record<number, Charger>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const handleWebSocketMessage = (data: any) => {
    if (data.type === 'status_update' || data.type === 'charging_update') {
      setChargers((prev) => ({
        ...prev,
        [data.chargerId]: { ...prev[data.chargerId], ...data },
      }));
    }
    if (data.type === 'alert') {
      setAlerts((prev) => [
        { ...data, id: Date.now() + Math.random() },
        ...prev.slice(0, 19),
      ]);
    }
  };

  return (
    <DashboardContext.Provider value={{ chargers, alerts, handleWebSocketMessage }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within a DashboardProvider');
  return ctx;
}  