import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { getMyBilling, upsertBilling, deleteBilling } from './billing.controller';

const router = Router();

router.get('/me', authenticate, getMyBilling);
router.post('/', authenticate, upsertBilling);
router.delete('/', authenticate, deleteBilling);

export default router;
