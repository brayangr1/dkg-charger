import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
    initializeFirebase,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    signOutUser
} from '@config/firebaseConfig';
import { getToken, setToken, removeToken } from '@services/authService';
import { url_global } from '@constants/config';
import toast from 'react-hot-toast';

// Types
interface UserData {
    id: string;
    email: string;
    name?: string; // Added for compatibility
    firstName: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    isGuest: boolean;
    updateUser?:any;
}


interface AuthResponse {
    success: boolean;
    token?: string;
    user?: UserData;
    error?: string;
}

interface AuthContextType {
    user: UserData | null;
    loading: boolean;
    isAuthChecked: boolean;
    login: (email: string, password: string, invitationToken?: string | null) => Promise<boolean>;
    register: (email: string, password: string, name: string, invitationToken?: string | null) => Promise<void>;
    googleLogin: (invitationToken?: string | null) => Promise<void>;
    logout: () => Promise<void>;
    updateUserProfile: (data: Partial<UserData>) => Promise<void>;
    getBillingDetails: () => Promise<any>;
    updateUser?:any;
    updateBillingDetails: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isAuthChecked: false,
    login: async () => false,
    register: async () => { },
    logout: async () => { },
    googleLogin: async () => { },
    updateUserProfile: async () => { },
    getBillingDetails: async () => null,
    updateBillingDetails: async () => { },
    updateUser: async () => { },
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthChecked, setIsAuthChecked] = useState(false);

    // Initialize Firebase on mount
    useEffect(() => {
        initializeFirebase();
        checkAuthState();

        // Listen for  unauthorized events from API client
        const handleUnauthorized = () => {
            logout();
        };

        window.addEventListener('unauthorized', handleUnauthorized);
        return () => window.removeEventListener('unauthorized', handleUnauthorized);
    }, []);

    const checkAuthState = async () => {
        try {
            const storedUserData = localStorage.getItem('userData');
            const storedToken = await getToken();

            if (storedUserData && storedToken) {
                setUser(JSON.parse(storedUserData));
            }
        } catch (error) {
            console.error('Error checking auth state:', error);
        } finally {
            setLoading(false);
            setIsAuthChecked(true);
        }
    };

    const login = async (email: string, password: string, invitationToken?: string | null): Promise<boolean> => {
        try {
            console.log('[AuthContext] Iniciando login...');
            const firebaseUser = await signInWithEmail(email, password);
            const token = await firebaseUser.getIdToken();
            console.log('[AuthContext] Token de Firebase obtenido');

            const requestBody = { token, invitationToken };
            console.log('[AuthContext] Enviando verificación a:', `${url_global}/api/users/verify`);

            const response = await fetch(`${url_global}/api/users/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            console.log('[AuthContext] Respuesta del servidor:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[AuthContext] Error del servidor:', errorText);
                throw new Error(response.status === 401 ? 'Credenciales inválidas' : `Verificación fallida: ${response.status}`);
            }

            const data: AuthResponse = await response.json();
            console.log('[AuthContext] Datos recibidos:', data);

            if (data.user && data.token) {
                setUser(data.user);
                await setToken(data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                toast.success('Sesión iniciada correctamente');
                return true;
            }
            return false;
        } catch (error: any) {
            console.error('Error en login:', error);
            toast.error(error.message || 'Error al iniciar sesión');
            throw error;
        }
    };

    const register = async (email: string, password: string, name: string, invitationToken?: string | null): Promise<void> => {
        try {
            console.log('[AuthContext] Registrando usuario...');
            const firebaseUser = await registerWithEmail(email, password);
            const token = await firebaseUser.getIdToken();
            console.log('[AuthContext] Usuario creado en Firebase');

            const requestBody = { token, name, invitationToken };
            console.log('[AuthContext] Enviando verificación a:', `${url_global}/api/users/verify`);

            const response = await fetch(`${url_global}/api/users/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            console.log('[AuthContext] Respuesta del servidor:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[AuthContext] Error del servidor:', errorText);
                throw new Error(`Error en registro: ${response.status} - ${errorText}`);
            }

            const data: AuthResponse = await response.json();
            console.log('[AuthContext] Registro exitoso:', data);

            if (data.user && data.token) {
                setUser(data.user);
                await setToken(data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                toast.success('Cuenta creada exitosamente');
            }
        } catch (error: any) {
            console.error('Error al registrar:', error);
            toast.error(error.message || 'Error al registrarse');
            throw error;
        }
    };

    const googleLogin = async (invitationToken?: string | null): Promise<void> => {
        try {
            const firebaseUser = await signInWithGoogle();
            const token = await firebaseUser.getIdToken();

            const response = await fetch(`${url_global}/api/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, invitationToken }),
            });

            if (!response.ok) {
                throw new Error(`Error en autenticación con Google: ${response.status}, Response: ${await response.text()}`);
            }

            const data: AuthResponse = await response.json();
            if (data.user && data.token) {
                setUser(data.user);
                await setToken(data.token);
                localStorage.setItem('userData', JSON.stringify(data.user));
                toast.success('Sesión iniciada con Google');
            }
        } catch (error: any) {
            console.error('Error en autenticación con Google:', error);
            toast.error(error.message || 'Error al iniciar sesión con Google');
            throw error;
        }
    };

    const logout = async (): Promise<void> => {
        try {
            await signOutUser();
            setUser(null);
            await removeToken();
            localStorage.removeItem('userData');
            toast.success('Sesión cerrada');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            toast.error('Error al cerrar sesión');
            throw error;
        }
    };

    const updateUserProfile = async (data: Partial<UserData>): Promise<void> => {
        try {
            const token = await getToken();
            if (!token) throw new Error('No autenticado');

            const response = await fetch(`${url_global}/api/users/update-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) throw new Error('Error al actualizar perfil');
            const result = await response.json();

            if (result.user) {
                setUser(result.user);
                localStorage.setItem('userData', JSON.stringify(result.user));
                toast.success('Perfil actualizado');
            }
        } catch (error: any) {
            console.error('Error updating profile:', error);
            toast.error(error.message || 'Error al actualizar perfil');
            throw error;
        }
    };

    const getBillingDetails = async (): Promise<any> => {
        try {
            const token = await getToken();
            if (!token) {
                console.log('[AuthContext] getBillingDetails: no token found');
                return null;
            }
            
            const response = await fetch(`${url_global}/api/billing/me`, {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json', 
                    Authorization: `Bearer ${token}` 
                },
            });
            
            if (!response.ok) return null;
            const data = await response.json();
            return data.billing || null;
        } catch (error) {
            console.error('Error fetching billing details:', error);
            return null;
        }
    };

    const updateBillingDetails = async (payload: any): Promise<void> => {
        try {
            const token = await getToken();
            if (!token) throw new Error('No autenticado');
            
            const response = await fetch(`${url_global}/api/billing`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify(payload),
            });
            
            if (!response.ok) {
                throw new Error('Error al actualizar datos de facturación');
            }
            
            toast.success('✅ Los datos de facturación se han actualizado correctamente.');
        } catch (error: any) {
            console.error('Error updating billing details:', error);
            toast.error(error.message || 'No se pudieron actualizar los datos de facturación. Inténtelo de nuevo.');
            throw error;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                isAuthChecked,
                login,
                register,
                logout,
                googleLogin,
                updateUserProfile,
                getBillingDetails,
                updateBillingDetails,
                
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};


export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};