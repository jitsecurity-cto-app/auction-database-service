import { Router } from 'express';
import { createPaymentIntent } from '../controllers/paymentController';
import { verifyToken } from '../middleware/auth';
import { requireFlag } from '../middleware/featureFlag';

const router = Router();

router.post('/create-intent', verifyToken, requireFlag('enable-stripe-checkout', false), createPaymentIntent);

export default router;
