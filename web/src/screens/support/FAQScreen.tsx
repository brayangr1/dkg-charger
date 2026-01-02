import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import Card from '@components/common/Card';
import Input from '@components/common/Input';
import { getFAQs } from '@services/authService';
import './FAQScreen.css';

const FAQScreen: React.FC = () => {
    const navigate = useNavigate();
    const [faqs, setFaqs] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        loadFAQs();
    }, []);

    const loadFAQs = async () => {
        try {
            const data = await getFAQs();
            setFaqs(data);
        } catch (error) {
            console.error('Error loading FAQs:', error);
        }
    };

    const filteredFaqs = faqs.filter(faq =>
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <MainLayout>
            <div className="faq-screen">
                <div className="screen-header">
                    <button className="back-button" onClick={() => navigate('/support')}>
                        ← Volver
                    </button>
                    <h1>Preguntas Frecuentes</h1>
                </div>

                <div className="search-container">
                    <Input
                        placeholder="Buscar preguntas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        fullWidth
                    />
                </div>

                <div className="faq-list">
                    {filteredFaqs.map((faq) => (
                        <Card key={faq.id}>
                            <div
                                className={`faq-item ${expandedId === faq.id ? 'expanded' : ''}`}
                                onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                            >
                                <div className="faq-question">
                                    <h3>{faq.question}</h3>
                                    <span className="toggle-icon">{expandedId === faq.id ? '−' : '+'}</span>
                                </div>
                                {expandedId === faq.id && (
                                    <div className="faq-answer">
                                        <p>{faq.answer}</p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    ))}

                    {filteredFaqs.length === 0 && (
                        <div className="no-results">
                            <p>No se encontraron resultados para "{searchTerm}"</p>
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
};

export default FAQScreen;
