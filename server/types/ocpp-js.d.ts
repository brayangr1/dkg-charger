declare module 'ocpp-js' {
  export class OCPPServer {
    constructor(options: any);
    on(event: 'connection', listener: (client: any) => void): void;
  }
  export enum OCPPCommands {
    BootNotification = 'BootNotification',
    StatusNotification = 'StatusNotification',
    RemoteStartTransaction = 'RemoteStartTransaction',
    RemoteStopTransaction = 'RemoteStopTransaction',
    StartTransaction = 'StartTransaction',
    StopTransaction = 'StopTransaction',
    MeterValues = 'MeterValues',
    Reset = "Reset",
    UnlockConnector = "UnlockConnector",
    ChangeConfiguration = "ChangeConfiguration",
    UpdateFirmware = "UpdateFirmware",
    GetDiagnostics = "GetDiagnostics",
    SetChargingProfile = "SetChargingProfile",
    ChangeAvailability = "ChangeAvailability",
    ClearCache = "ClearCache",
    Heartbeat = "Heartbeat",
    DiagnosticsStatusNotification = "DiagnosticsStatusNotification",
    FirmwareStatusNotification = "FirmwareStatusNotification",
    // ...otros comandos OCPP
  }
  export enum OCPPProtocol {
    OCPP16 = 'ocpp1.6',
    OCPP201 = 'ocpp2.0.1',
  }
} 