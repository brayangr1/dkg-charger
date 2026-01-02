import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import * as supportController from './support.controller';

const router = Router();

router.post('/send-ticket', authenticate, supportController.sendSupportTicket);

export default router;