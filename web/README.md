# DKG Charger - Web Application

Aplicación web para la gestión de cargadores de vehículos eléctricos, desarrollada con React y Vite.

## Características

- ✅ **Autenticación**: Google OAuth y Firebase
- ✅ **Gestión de Cargadores**: Administración completa de cargadores via OCPP
- ✅ **Wallet Prepagado**: Sistema de saldo y bonos
- ✅ **Pagos**: Integración con Stripe
- ✅ **Modo Offline**: Funcionalidad offline con IndexedDB
- ✅ **Mapas**: Visualización de cargadores públicos
- ✅ **WebSocket**: Comunicación en tiempo real con cargadores
- ✅ **Soporte**: Sistema de tickets

## Requisitos

- Node.js 18+ 
- npm o yarn

## Instalación

1. **Clonar el repositorio**:
   ```bash
   cd c:\app\dkg\revision\app\web
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   ```bash
   cp .env.example .env
   ```
   
   Editar `.env` con tus credenciales de Firebase y Stripe.

## Desarrollo

Para iniciar el servidor de desarrollo:

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## Build de Producción

```bash
npm run build
```

Los archivos se generarán en la carpeta `dist/`.

Para previsualizar el build:

```bash
npm run preview
```

## Estructura del Proyecto

```
web/
├── public/          # Archivos estáticos
├── src/
│   ├── components/  # Componentes reutilizables
│   ├── screens/     # Pantallas/páginas
│   ├── services/    # Servicios (API, WebSocket, etc.)
│   ├── context/     # Contextos de React
│   ├── hooks/       # Custom hooks
│   ├── router/      # Configuración de rutas
│   ├── config/      # Configuración (Firebase, Stripe)
│   ├── constants/   # Constantes
│   ├── types/       # Tipos TypeScript
│   ├── utils/       # Utilidades
│   └── styles/      # Estilos globales
├── index.html       # Punto de entrada HTML
├── vite.config.ts   # Configuración de Vite
└── package.json     # Dependencias
```

## Tecnologías Utilizadas

- **React 18**: Framework UI
- **Vite**: Build tool y dev server
- **TypeScript**: Tipado estático
- **React Router**: Navegación
- **Firebase**: Autenticación
- **Stripe**: Pagos
- **Socket.io**: WebSocket
- **Leaflet**: Mapas
- **IndexedDB**: Almacenamiento offline
- **Axios**: Cliente HTTP

## Diferencias con la App Móvil

Esta aplicación web NO incluye las siguientes funcionalidades específicas de móvil:

- ❌ **Bluetooth**: Conexión BLE con cargadores
- ❌ **NFC**: Lectura de tags NFC
- ❌ **WiFi**: Configuración de redes WiFi
- ❌ **Cámara**: Escaneo de QR codes

Los cargadores se gestionan completamente via OCPP y API HTTP.

## API Backend

La aplicación se conecta al backend en: `https://server.dkgsolutions.es`

## Licencia

Privado
