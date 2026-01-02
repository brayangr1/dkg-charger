import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { validateInvitationToken, acceptInvitation } from '@services/invitationService';
import LoadingScreen from '@screens/LoadingScreen';
import toast from 'react-hot-toast';
import { useAuth } from '@context/AuthContext';

const AcceptInvitationScreen: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user, isAuthChecked } = useAuth();
    const [verifying, setVerifying] = useState(true);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) {
            toast.error('Enlace de invitación inválido');
            navigate('/login');
            return;
        }

        verifyToken(token);
    }, [searchParams, navigate]);

    const verifyToken = async (token: string) => {
        try {
            const data = await validateInvitationToken(token);

            if (data.success && data.invitation) {
                // Si el usuario ya está autenticado, aceptar automáticamente
                if (user && isAuthChecked) {
                    handleAcceptInvitation(token);
                } else {
                    // Si no está autenticado, guardar datos y redirigir a register
                    sessionStorage.setItem('invitationToken', token);
                    sessionStorage.setItem('invitationData', JSON.stringify(data.invitation));

                    toast.success(`Invitación válida para ${data.invitation.charger_name || 'un cargador'}`);
                    navigate(`/register?token=${token}&email=${encodeURIComponent(data.invitation.guest_email)}`);
                }
            } else {
                toast.error('La invitación ha expirado o no es válida');
                navigate('/login');
            }
        } catch (error) {
            console.error('Error validating token:', error);
            toast.error('Error al validar la invitación');
            navigate('/login');
        } finally {
            setVerifying(false);
        }
    };

    const handleAcceptInvitation = async (token: string) => {
        setAccepting(true);
        try {
            const response = await acceptInvitation(token);
            
            if (response.success) {
                toast.success('¡Invitación aceptada! Ahora tienes acceso al cargador');
                // Limpiar datos de sesión
                sessionStorage.removeItem('invitationToken');
                sessionStorage.removeItem('invitationData');
                // Redirigir a inicio
                navigate('/');
            } else {
                toast.error(response.error || 'Error al aceptar la invitación');
                navigate('/login');
            }
        } catch (error) {
            console.error('Error accepting invitation:', error);
            toast.error('Error al aceptar la invitación');
            navigate('/login');
        } finally {
            setAccepting(false);
        }
    };

    if (verifying || accepting) {
        return <LoadingScreen />;
    }

    return null;
};

export default AcceptInvitationScreen;
