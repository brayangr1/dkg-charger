import React from 'react';
import './LoadingScreen.css';

const LoadingScreen: React.FC = () => {
    return (
        <div className="loading-screen">
            <div className="loading-content">
                <div className="spinner"></div>
                <h2>Cargando...</h2>
                <p>DKG Charger</p>
            </div>
        </div>
    );
};

export default LoadingScreen;
