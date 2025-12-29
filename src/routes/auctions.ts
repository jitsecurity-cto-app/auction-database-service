import { Router } from 'express';
import {
  listAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
} from '../controllers/auctionController';
import { verifyToken, optionalAuth } from '../middleware/auth';
import bidsRouter from './bids';

const router = Router();

// GET /api/auctions - List all auctions (public)
router.get('/', optionalAuth, listAuctions);

// GET /api/auctions/:id - Get auction by ID (public, no authorization check)
router.get('/:id', optionalAuth, getAuctionById);

// POST /api/auctions - Create new auction (requires authentication)
router.post('/', verifyToken, createAuction);

// PUT /api/auctions/:id - Update auction (no ownership check - intentional vulnerability)
router.put('/:id', optionalAuth, updateAuction);

// DELETE /api/auctions/:id - Delete auction (no ownership check - intentional vulnerability)
router.delete('/:id', optionalAuth, deleteAuction);

// Mount bids router
router.use('/:id/bids', bidsRouter);

export default router;

