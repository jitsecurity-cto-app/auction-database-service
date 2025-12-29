import { Router } from 'express';
import { updatePaymentStatus } from '../controllers/bidController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// PUT /api/bids/:id/payment-status - Update payment status (no authorization check - intentional vulnerability)
router.put('/:id/payment-status', optionalAuth, updatePaymentStatus);

export default router;
