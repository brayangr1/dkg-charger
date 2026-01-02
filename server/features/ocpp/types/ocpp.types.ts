// OCPP Message Types
export type OCPPVersion = '1.6' | '2.0.1';

export type MessageType = 2 | 3 | 4;  // 2 = Request, 3 = Response, 4 = Error

export type OCPPRequest = [MessageType, string, string, any];  // [2, uniqueId, action, payload]
export type OCPPResponse = [MessageType, string, any];        // [3, uniqueId, payload]
export type OCPPError = [MessageType, string, string, string, any]; // [4, uniqueId, errorCode, errorDescription, errorDetails]

export interface OCPPMessage {
    messageTypeId: MessageType;
    uniqueId: string;
    action?: string;
    payload: any;
    error?: {
        errorCode: string;
        errorDescription: string;
    };
}

// OCPP Actions
export enum OCPPAction {
    BootNotification = 'BootNotification',
    Heartbeat = 'Heartbeat',
    Authorize = 'Authorize',
    StartTransaction = 'StartTransaction',
    StopTransaction = 'StopTransaction',
    StatusNotification = 'StatusNotification',
    MeterValues = 'MeterValues',
    ChangeConfiguration = 'ChangeConfiguration', 
    Reset = 'Reset', 
    RemoteStartTransaction = 'RemoteStartTransaction', 
    RemoteStopTransaction = 'RemoteStopTransaction' 
}

// OCPP Response Status
export enum OCPPStatus {
    Accepted = 'Accepted',
    Rejected = 'Rejected',
    Invalid = 'Invalid'
}

// Charge Point Status
export enum ChargePointStatus {
    Available = 'Available',
    Preparing = 'Preparing',
    Charging = 'Charging',
    SuspendedEVSE = 'SuspendedEVSE',
    SuspendedEV = 'SuspendedEV',
    Finishing = 'Finishing',
    Reserved = 'Reserved',
    Unavailable = 'Unavailable',
    Faulted = 'Faulted'
}

import WebSocket from 'ws';

// Connection Status
export interface ChargePointConnection {
    wsConnection: WebSocket;
    chargePointId: string;
    lastHeartbeat: Date;
    status: ChargePointStatus;
    currentTransaction?: string;
}

// Boot Notification
export interface BootNotificationRequest {
    chargePointVendor: string;
    chargePointModel: string;
    chargePointSerialNumber?: string;
    chargeBoxSerialNumber?: string;
    firmwareVersion?: string;
    iccid?: string;
    imsi?: string;
    meterType?: string;
    meterSerialNumber?: string;
}

export interface BootNotificationResponse {
    status: OCPPStatus;
    currentTime: string;
    interval: number;
}

// Heartbeat
export interface HeartbeatRequest {}

export interface HeartbeatResponse {
    currentTime: string;
}

// Authorize
export interface AuthorizeRequest {
    idTag: string;
}

export interface AuthorizeResponse {
    idTagInfo: {
        status: OCPPStatus;
        expiryDate?: string;
        parentIdTag?: string;
    };
}

// Start Transaction
export interface StartTransactionRequest {
    connectorId: number;
    idTag: string;
    meterStart: number;
    reservationId?: number;
    timestamp: string;
}

export interface StartTransactionResponse {
    transactionId: number;
    idTagInfo: {
        status: OCPPStatus;
        expiryDate?: string;
        parentIdTag?: string;
    };
}

// Stop Transaction
export interface StopTransactionRequest {
    transactionId: number;
    idTag?: string;
    timestamp: string;
    meterStop: number;
    reason?: string;
    transactionData?: any[];
}

export interface StopTransactionResponse {
    idTagInfo?: {
        status: OCPPStatus;
        expiryDate?: string;
        parentIdTag?: string;
    };
}