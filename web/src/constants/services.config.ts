// Configuración centralizada de servicios y credenciales para web

// Configuración de Firebase para Web
// NOTA: Usando el mismo appId que mobile porque el backend está configurado para ese proyecto
// Si necesitas un appId específico para web, debes agregarlo en Firebase Console
export const FIREBASE_CONFIG = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBYb5tSChhY0AmLQsdfXp9lDmSEpxFIRpk",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dkg-cargadores-17a89.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dkg-cargadores-17a89",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dkg-cargadores-17a89.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "471068698493",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:471068698493:android:f5e10d24cb66fa7ee54e14",
    databaseURL: "https://dkg-cargadores-17a89-default-rtdb.firebaseio.com"
};

// Configuración de Google OAuth
export const GOOGLE_AUTH_CONFIG = {
    // Web Client ID para autenticación de Google
    webClientId: "471068698493-1nuvbo1gd1rltjmg6mg3p0oia04p1kvm.apps.googleusercontent.com",

    // Scopes requeridos
    scopes: ["profile", "email"]
};

// Configuración de notificaciones (adaptado para web)
export const NOTIFICATION_CONFIG = {
    types: {
        CHARGING_STARTED: "charging_started",
        CHARGING_STOPPED: "charging_stopped",
        SCHEDULE_CREATED: "schedule_created",
        SCHEDULE_DELETED: "schedule_deleted",
        SCHEDULE_STARTED: "schedule_started",
        CHARGER_OFFLINE: "charger_offline",
        CHARGER_ONLINE: "charger_online",
        CHARGER_ERROR: "charger_error"
    }
};

// Estado de la configuración de servicios
export const SERVICES_STATUS = {
    isFirebaseConfigured: true
};
 