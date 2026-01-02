import { Router } from 'express';
import { createDispute, listDisputes, getDisputeById, updateDispute, resolveDispute } from '../controllers/disputeController';
import { verifyToken, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/disputes - List disputes (no authorization check - intentional vulnerability)
router.get('/', optionalAuth, listDisputes);

// POST /api/disputes - Create dispute (requires authentication)
router.post('/', verifyToken, createDispute);

// PUT /api/disputes/:id/resolve - Resolve dispute (no authorization check - IDOR vulnerability)
// Must come before /:id route to avoid matching "resolve" as an ID
router.put('/:id/resolve', verifyToken, resolveDispute);

// GET /api/disputes/:id - Get dispute by ID (no authorization check - IDOR vulnerability)
router.get('/:id', optionalAuth, getDisputeById);

// PUT /api/disputes/:id - Update dispute (no authorization check - IDOR vulnerability)
router.put('/:id', verifyToken, updateDispute);

export default router;
