"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCPPStatus = void 0;
var OCPPStatus;
(function (OCPPStatus) {
    OCPPStatus["Available"] = "Available";
    OCPPStatus["Preparing"] = "Preparing";
    OCPPStatus["Charging"] = "Charging";
    OCPPStatus["SuspendedEV"] = "SuspendedEV";
    OCPPStatus["SuspendedEVSE"] = "SuspendedEVSE";
    OCPPStatus["Finishing"] = "Finishing";
    OCPPStatus["Reserved"] = "Reserved";
    OCPPStatus["Unavailable"] = "Unavailable";
    OCPPStatus["Faulted"] = "Faulted";
})(OCPPStatus || (exports.OCPPStatus = OCPPStatus = {}));
// Puedes agregar más tipos según los comandos OCPP que vayas implementando 
