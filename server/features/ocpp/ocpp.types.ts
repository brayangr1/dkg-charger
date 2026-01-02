export enum OCPPStatus {
  Available = 'Available',
  Preparing = 'Preparing',
  Charging = 'Charging',
  SuspendedEV = 'SuspendedEV',
  SuspendedEVSE = 'SuspendedEVSE',
  Finishing = 'Finishing',
  Reserved = 'Reserved',
  Unavailable = 'Unavailable',
  Faulted = 'Faulted',
}

export interface BootNotificationPayload {
  chargePointModel: string;
  chargePointVendor: string;
  firmwareVersion?: string;
}

export interface StatusNotificationPayload {
  connectorId: number;
  status: OCPPStatus;
  errorCode: string;
  info?: string;
  timestamp?: string;
}

// Puedes agregar más tipos según los comandos OCPP que vayas implementando 