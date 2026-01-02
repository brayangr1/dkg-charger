"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const offline_payments_controller_1 = require("./offline-payments.controller");
const router = (0, express_1.Router)();
router.post('/process-offline', offline_payments_controller_1.processOfflinePayment);
exports.default = router;
