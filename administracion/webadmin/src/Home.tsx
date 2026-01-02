import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Verificar si el usuario está autenticado
  const isAuthenticated = () => {
    const token = localStorage.getItem('authToken');
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Verificar si el token ha expirado
      return payload.exp * 1000 > Date.now();
    } catch (e) {
      return false;
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    navigate('/login');
  };
  
  const isLoggedIn = isAuthenticated();

  return (
    <div>
      <nav className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Panel de Administración</h1>
          
          <ul className="flex space-x-4">
            {isLoggedIn ? (
              <>
                <li>
                  <Link 
                    to="/admin-set-price" 
                    className={`hover:text-gray-300 ${location.pathname.includes('admin-set-price') ? 'font-bold' : ''}`}
                  >
                    Administrar Precios
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/dashboard" 
                    className={`hover:text-gray-300 ${location.pathname.includes('dashboard') ? 'font-bold' : ''}`}
                  >
                    Panel de Control
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/ocpp-management" 
                    className={`hover:text-gray-300 ${location.pathname.includes('ocpp-management') ? 'font-bold' : ''}`}
                  >
                    Gestión OCPP
                  </Link>
                </li>
                <li>
                  <button 
                    onClick={handleLogout}
                    className="hover:text-gray-300"
                  >
                    Cerrar Sesión
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link 
                  to="/login" 
                  className={`hover:text-gray-300 ${location.pathname.includes('login') ? 'font-bold' : ''}`}
                >
                  Iniciar Sesión
                </Link>
              </li>
            )}
          </ul>
        </div>
      </nav>
      
      <div className="container mx-auto p-4">
        {isLoggedIn || location.pathname === '/login' ? (
          <Outlet />
        ) : (
          <div className="text-center py-10">
            <h2 className="text-2xl font-bold mb-4">Acceso Restringido</h2>
            <p className="mb-6">Debes iniciar sesión para acceder al panel de administración.</p>
            <Link 
              to="/login" 
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Iniciar Sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;