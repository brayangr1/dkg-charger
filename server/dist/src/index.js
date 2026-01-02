"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const payments_routes_1 = __importDefault(require("../features/payments/payments.routes"));
const app = (0, express_1.default)();
const port = process.env.PORT || 5010;
// Middleware
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: true }));
// Rutas
app.use('/api/payments', payments_routes_1.default);
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Error interno del servidor'
    });
});
// Iniciar servidor
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en https://localhost:${port}`);
});
