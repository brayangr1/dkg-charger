# Servidor (Backend)

Este es el componente de backend del proyecto Charger App, desarrollado con Node.js y TypeScript. Proporciona la API RESTful para la aplicación móvil, gestiona la lógica de negocio, la interacción con la base de datos, la autenticación, los pagos y la comunicación en tiempo real a través de WebSockets.

## Tecnologías Utilizadas

*   **Node.js**: Entorno de ejecución de JavaScript del lado del servidor.
*   **Express.js**: Framework web para Node.js.
*   **TypeScript**: Lenguaje de programación que añade tipado estático a JavaScript.
*   **MySQL2**: Cliente MySQL para Node.js.
*   **WebSockets (ws)**: Para comunicación bidireccional en tiempo real.
*   **Firebase Admin SDK**: Para interactuar con los servicios de Firebase (ej. notificaciones).
*   **Stripe**: Para el procesamiento de pagos.
*   **JWT (jsonwebtoken)**: Para la autenticación basada en tokens.
*   **Bcrypt**: Para el hashing de contraseñas.
*   **Dotenv**: Para la gestión de variables de entorno.
*   **Nodemailer**: Para el envío de correos electrónicos.
*   **Node-cron**: Para la programación de tareas.
*   **OCPP-JS**: Para la integración con el protocolo OCPP (Open Charge Point Protocol).

## Instalación

Asegúrate de tener Node.js y npm (o yarn) instalados en tu sistema.

1.  **Clonar el repositorio** (si aún no lo has hecho):
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd charger-app/server
    ```
2.  **Instalar dependencias**:
    ```bash
    npm install
    # o
    yarn install
    ```

## Variables de Entorno

El servidor utiliza variables de entorno para la configuración sensible (ej. credenciales de base de datos, claves API). Debes crear un archivo `.env` en la raíz de la carpeta `server` con las siguientes variables (ejemplo):

```dotenv
DB_HOST=localhost
DB_USER=appdkg
DB_PASSWORD=your_password
DB_NAME=charger_app_db
PORT=3000
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/your/firebase-adminsdk.json
# Otras variables necesarias...
```

## Ejecución del Servidor

### Modo Desarrollo

Para iniciar el servidor en modo desarrollo con `nodemon` (que reinicia automáticamente el servidor al detectar cambios en los archivos):

```bash
npm run dev
```

### Modo Producción

1.  **Compilar el código TypeScript a JavaScript**:
    ```bash
    npm run build
    ```
2.  **Iniciar el servidor compilado**:
    ```bash
    npm start
    ```

## Estructura del Proyecto

*   `src/`: Código fuente principal de la aplicación.
    *   `app.ts`: Punto de entrada principal del servidor.
    *   `config/`: Archivos de configuración (base de datos, Firebase, etc.).
    *   `features/`: Módulos o características específicas de la aplicación (ej. autenticación, usuarios, cargadores).
    *   `middlewares/`: Funciones middleware de Express.
    *   `services/`: Lógica de negocio y servicios (interacción con DB, APIs externas).
    *   `websocket/`: Lógica relacionada con la comunicación WebSocket.
*   `cron/`: Tareas programadas.
*   `docs/`: Documentación de la API (si existe).
*   `emulador/`: Archivos relacionados con la emulación.
*   `types/`: Definiciones de tipos de TypeScript.

## Endpoints de la API

Esta sección debe ser expandida con la documentación detallada de los endpoints de la API (rutas, métodos HTTP, parámetros de solicitud, respuestas de ejemplo, etc.). Puedes usar herramientas como Swagger/OpenAPI para generar esta documentación automáticamente o describirla manualmente aquí.

## Base de Datos

El servidor se conecta a una base de datos MySQL. Las configuraciones de conexión se encuentran en las variables de entorno y en los archivos de configuración dentro de `src/config/`.
