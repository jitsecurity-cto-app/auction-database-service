import { Router } from 'express';
import { getBidsByAuction, createBid } from '../controllers/bidController';
import { verifyToken, optionalAuth } from '../middleware/auth';

const router = Router({ mergeParams: true }); // mergeParams to access :id from parent route

// GET /api/auctions/:id/bids - Get bids for auction (public, no authorization check)
router.get('/', optionalAuth, getBidsByAuction);

// POST /api/auctions/:id/bids - Place a bid (requires authentication)
router.post('/', verifyToken, createBid);

export default router;

