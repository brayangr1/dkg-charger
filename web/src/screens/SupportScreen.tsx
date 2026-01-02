import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import { getSupportCategories } from '@services/authService';
import './SupportScreen.css';

const SupportScreen: React.FC = () => {
    const navigate = useNavigate();
    const [categories, setCategories] = useState<any[]>([]);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const data = await getSupportCategories();
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    return (
        <MainLayout>
            <div className="support-screen">
                <div className="support-header">
                    <h1>Centro de Ayuda</h1>
                    <p>¿En qué podemos ayudarte hoy?</p>
                </div>

                <div className="support-grid">
                    <Card>
                        <div className="support-option" onClick={() => navigate('/support/faq')}>
                            <div className="option-icon">❓</div>
                            <h3>Preguntas Frecuentes</h3>
                            <p>Encuentra respuestas rápidas a las dudas más comunes.</p>
                        </div>
                    </Card>

                    {/*<Card>
                        <div className="support-option" onClick={() => navigate('/support/contact')}>
                            <div className="option-icon">✉️</div>
                            <h3>Contáctanos</h3>
                            <p>Envíanos un mensaje y te responderemos lo antes posible.</p>
                        </div>
                    </Card>*/}

                    

                    <Card>
                        <div className="support-option" onClick={() => navigate('/support/report')}>
                            <div className="option-icon">⚠️</div>
                            <h3>Reportar Problema</h3>
                            <p>Avísanos si encuentras algún problema con un cargador o la app.</p>
                        </div>
                    </Card>
                </div>

                <div className="categories-section">
                    <h2>Explorar por Categoría</h2>
                    <div className="categories-list">
                        {categories.map((cat) => (
                            <Card key={cat.id}>
                                <div className="category-item" onClick={() => navigate(`/support/faq?cat=${cat.id}`)}>
                                    <span className="category-icon">{cat.icon}</span>
                                    <span className="category-name">{cat.name}</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                <div className="contact-info">
                    <p>También puedes llamarnos al:</p>
                    <a href="tel:+34000000000" className="phone-link">000 000 000</a>
                    <p className="hours">Lunes a Viernes, 9:00 - 18:00</p>
                </div>
            </div>
        </MainLayout>
    );
};

export default SupportScreen;
