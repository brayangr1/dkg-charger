import { Request, Response } from 'express';
import { billingService } from './billing.service';
import { AuthenticatedRequest } from '../../middlewares/auth';

export const getMyBilling = async (req: AuthenticatedRequest, res: Response) => {
  try {
  const userId = req.user!.id;
  console.log('[billing.controller] getMyBilling userId:', userId);
    const billing = await billingService.getByUserId(userId);
    res.json({ success: true, billing });
  } catch (error) {
    console.error('Error getting billing details:', error);
    res.status(500).json({ success: false, error: 'Error obteniendo datos de facturación' });
  }
};

export const upsertBilling = async (req: AuthenticatedRequest, res: Response) => {
  try {
  const userId = req.user!.id;
  const payload = req.body;
  console.log('[billing.controller] upsertBilling userId:', userId, 'payload:', payload);
    const result = await billingService.upsertForUser(userId, payload);
    res.json({ success: true, billing: result });
  } catch (error) {
    console.error('Error upserting billing details:', error);
    res.status(500).json({ success: false, error: 'Error guardando datos de facturación' });
  }
};

export const deleteBilling = async (req: AuthenticatedRequest, res: Response) => {
  try {
  const userId = req.user!.id;
  console.log('[billing.controller] deleteBilling userId:', userId);
    const deleted = await billingService.deleteByUserId(userId);
    res.json({ success: deleted });
  } catch (error) {
    console.error('Error deleting billing details:', error);
    res.status(500).json({ success: false, error: 'Error eliminando datos de facturación' });
  }
};

export default {
  getMyBilling,
  upsertBilling,
  deleteBilling,
};
