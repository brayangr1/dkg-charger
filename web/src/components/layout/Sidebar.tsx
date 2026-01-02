import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
//import { useTheme } from '@context/ThemeContext';
import './Sidebar.css';

const Sidebar: React.FC = () => {
    const location = useLocation();
    const { user, logout } = useAuth();
    //const { theme, toggleTheme } = useTheme();

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

    const menuItems = [
        { path: '/', icon: '🏠', label: 'Inicio' },
        { path: '/chargers/mine', icon: '🔌', label: 'Mis Cargadores' },
        { path: '/home-chargers', icon: '⚡', label: 'Cargadores Hogar' },
        ...(!user?.isGuest ? [
            { path: '/invitations/invite', icon: '📤', label: 'Invitar Usuarios' },
            { path: '/invitations/manage', icon: '👥', label: 'Gestión Invitados' },
        ] : []),
        //{ path: '/wallet', icon: '💰', label: 'Wallet' },
        { path: '/payments/methods', icon: '💳', label: 'Metodos de Pagos' },
        { path: '/payments/history', icon: '📄', label: 'Historial de Pagos' },
        //{ path: '/invoices/pending', icon: '📄', label: 'Facturas Pendientes' },
        { path: '/map', icon: '🗺️', label: 'Mapa Público' },
        { path: '/profile', icon: '👤', label: 'Perfil' },
        { path: '/support', icon: '❓', label: 'Soporte' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2>DKG Charger</h2>
                <p className="sidebar-user">Hola, {user?.firstName}</p>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`sidebar-link ${isActive(item.path) ? 'sidebar-link-active' : ''}`}
                    >
                        <span className="sidebar-icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="sidebar-footer">
                {/*<button onClick={toggleTheme} className="sidebar-theme-toggle">
                    {theme === 'light' ? '🌙' : '☀️'} {theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
                </button>*/}
                <button onClick={logout} className="sidebar-logout">
                    🚪 Cerrar Sesión
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
