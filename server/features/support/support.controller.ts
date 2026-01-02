import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth';
import * as supportService from './support.service';

export const sendSupportTicket = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { subject, type, description } = req.body;
    const userEmail = req.user!.email; // Obtiene el email del usuario autenticado

    if (!subject || !type || !description) {
      return res.status(400).json({ success: false, error: 'Todos los campos son requeridos.' });
    }

    const success = await supportService.sendSupportTicketEmail({
      subject,
      type,
      description,
      userEmail,
    });

    if (success) {
      res.json({ success: true, message: 'Ticket de soporte enviado correctamente.' });
    } else {
      res.status(500).json({ success: false, error: 'No se pudo enviar el ticket de soporte.' });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    res.status(500).json({ success: false, error: message });
  }
};