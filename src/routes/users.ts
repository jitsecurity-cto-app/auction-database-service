import { Router } from 'express';
import { listUsers, getUserById, updateUser, getMyBids, getMyWins, getMyAuctions, getMySales } from '../controllers/userController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/users - List all users (no admin check - intentional vulnerability)
router.get('/', optionalAuth, listUsers);

// GET /api/users/:id/my-bids - Get all bids by user (no authorization check - IDOR vulnerability)
router.get('/:id/my-bids', optionalAuth, getMyBids);

// GET /api/users/:id/my-wins - Get all winning bids by user (no authorization check - IDOR vulnerability)
router.get('/:id/my-wins', optionalAuth, getMyWins);

// GET /api/users/:id/my-auctions - Get all auctions created by user (no authorization check - IDOR vulnerability)
router.get('/:id/my-auctions', optionalAuth, getMyAuctions);

// GET /api/users/:id/my-sales - Get all completed auctions created by user (no authorization check - IDOR vulnerability)
router.get('/:id/my-sales', optionalAuth, getMySales);

// GET /api/users/:id - Get user by ID (no authorization check - IDOR vulnerability)
router.get('/:id', optionalAuth, getUserById);

// PUT /api/users/:id - Update user (no authorization check - intentional vulnerability)
router.put('/:id', optionalAuth, updateUser);

export default router;

