import { Router } from 'express';
import { createDispute, listDisputes, getDisputeById } from '../controllers/disputeController';
import { verifyToken, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/disputes - List disputes (no authorization check - intentional vulnerability)
router.get('/', optionalAuth, listDisputes);

// POST /api/disputes - Create dispute (requires authentication)
router.post('/', verifyToken, createDispute);

// GET /api/disputes/:id - Get dispute by ID (no authorization check - IDOR vulnerability)
router.get('/:id', optionalAuth, getDisputeById);

export default router;
