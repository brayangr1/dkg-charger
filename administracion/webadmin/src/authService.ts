// Definir el tipo para process.env
declare const process: {
  env: {
    [key: string]: string | undefined;
  };
};

// Removed dependencies for browser environment compatibility

// Definir tipos
export interface AdminUser {
  id: number;
  username: string;
  email: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// En una implementación real, estos datos vendrían de una base de datos
// Por ahora, usamos datos simulados para demostración
const ADMIN_USERS: AdminUser[] = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@example.com'
  }
];

// Contraseñas hasheadas (admin123)


/**
 * Verifica las credenciales de un usuario administrador
 * @param credentials Credenciales del usuario
 * @returns Información del usuario si las credenciales son válidas, null en caso contrario
 */
export const verifyAdminCredentials = async (credentials: LoginCredentials): Promise<AdminUser | null> => {
  const user = ADMIN_USERS.find(u => u.username === credentials.username);
  
  if (!user) {
    return null;
  }
  
  // Simulate password comparison in browser environment
  const isValidPassword = credentials.password === 'admin123';
  
  if (!isValidPassword) {
    return null;
  }
  
  return {
    id: user.id,
    username: user.username,
    email: user.email
  };
};

/**
 * Genera un token JWT para un usuario administrador
 * @param user Información del usuario
 * @returns Token JWT
 */
export const generateAdminToken = (user: AdminUser): string => {
  // Simulate JWT token generation in browser environment
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ 
    id: user.id, 
    username: user.username,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // Expira en 24 horas
  }));
  const signature = btoa('signature'); // Firma simulada

  return `${header}.${payload}.${signature}`;
};

/**
 * Verifica un token JWT
 * @param token Token a verificar
 * @returns Información del usuario si el token es válido, null en caso contrario
 */
export const verifyAdminToken = (token: string): AdminUser | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    
    // Verificar si el token ha expirado
    if (payload.exp * 1000 < Date.now()) {
      return null;
    }
    
    const user = ADMIN_USERS.find(u => u.id === payload.id);
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      username: user.username,
      email: user.email
    };
  } catch (error) {
    return null;
  }
};