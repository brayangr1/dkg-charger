export type ChargerStatus = 'standby' | 'charging' | 'locked' | 'error' | 'offline' | 'powered_off';
export type ChargerNetworkStatus = 'online' | 'offline' | 'unstable';

export interface Charger {
  id: number;
  name: string;
  status: ChargerStatus;
  network_status: ChargerNetworkStatus;
  max_power: number;
  serial_number: string;
  created_at: Date;
  updated_at: Date;
  
}


export interface StatusUpdatePayload {
  chargerId: number;
  status: ChargerStatus;
  networkStatus: ChargerNetworkStatus;
  timestamp?: string;
  ratePerKwh?: number;
  // Puedes añadir más campos según necesites
}