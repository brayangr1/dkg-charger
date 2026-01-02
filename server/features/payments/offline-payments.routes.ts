import { Router } from 'express';
import { processOfflinePayment } from './offline-payments.controller';

const router = Router();

router.post('/process-offline', processOfflinePayment);

export default router;
