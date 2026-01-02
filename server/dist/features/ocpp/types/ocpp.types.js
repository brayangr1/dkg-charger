"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChargePointStatus = exports.OCPPStatus = exports.OCPPAction = void 0;
// OCPP Actions
var OCPPAction;
(function (OCPPAction) {
    OCPPAction["BootNotification"] = "BootNotification";
    OCPPAction["Heartbeat"] = "Heartbeat";
    OCPPAction["Authorize"] = "Authorize";
    OCPPAction["StartTransaction"] = "StartTransaction";
    OCPPAction["StopTransaction"] = "StopTransaction";
    OCPPAction["StatusNotification"] = "StatusNotification";
    OCPPAction["MeterValues"] = "MeterValues";
    OCPPAction["ChangeConfiguration"] = "ChangeConfiguration";
    OCPPAction["Reset"] = "Reset";
    OCPPAction["RemoteStartTransaction"] = "RemoteStartTransaction";
    OCPPAction["RemoteStopTransaction"] = "RemoteStopTransaction";
})(OCPPAction || (exports.OCPPAction = OCPPAction = {}));
// OCPP Response Status
var OCPPStatus;
(function (OCPPStatus) {
    OCPPStatus["Accepted"] = "Accepted";
    OCPPStatus["Rejected"] = "Rejected";
    OCPPStatus["Invalid"] = "Invalid";
})(OCPPStatus || (exports.OCPPStatus = OCPPStatus = {}));
// Charge Point Status
var ChargePointStatus;
(function (ChargePointStatus) {
    ChargePointStatus["Available"] = "Available";
    ChargePointStatus["Preparing"] = "Preparing";
    ChargePointStatus["Charging"] = "Charging";
    ChargePointStatus["SuspendedEVSE"] = "SuspendedEVSE";
    ChargePointStatus["SuspendedEV"] = "SuspendedEV";
    ChargePointStatus["Finishing"] = "Finishing";
    ChargePointStatus["Reserved"] = "Reserved";
    ChargePointStatus["Unavailable"] = "Unavailable";
    ChargePointStatus["Faulted"] = "Faulted";
})(ChargePointStatus || (exports.ChargePointStatus = ChargePointStatus = {}));
