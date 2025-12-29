import { Router } from 'express';
import {
  listAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  closeAuction,
  closeExpiredAuctions,
  getAuctionsByWorkflow,
  updateWorkflowState,
} from '../controllers/auctionController';
import { verifyToken, optionalAuth } from '../middleware/auth';
import bidsRouter from './bids';

const router = Router();

// GET /api/auctions - List all auctions (public)
router.get('/', optionalAuth, listAuctions);

// POST /api/auctions/close-expired - Close all expired auctions (public - intentional vulnerability)
router.post('/close-expired', optionalAuth, closeExpiredAuctions);

// GET /api/auctions/workflow - Get auctions by workflow state (requires authentication)
router.get('/workflow', verifyToken, getAuctionsByWorkflow);

// POST /api/auctions - Create new auction (requires authentication)
router.post('/', verifyToken, createAuction);

// Mount bids router BEFORE :id route to avoid route conflicts
router.use('/:id/bids', bidsRouter);

// POST /api/auctions/:id/close - Close auction and determine winner (no authorization check - intentional vulnerability)
// Must come before :id route to avoid conflicts
router.post('/:id/close', optionalAuth, closeAuction);

// PUT /api/auctions/:id/workflow - Update workflow state (no authorization check - intentional vulnerability)
router.put('/:id/workflow', verifyToken, updateWorkflowState);

// GET /api/auctions/:id - Get auction by ID (public, no authorization check)
router.get('/:id', optionalAuth, getAuctionById);

// PUT /api/auctions/:id - Update auction (no ownership check - intentional vulnerability)
router.put('/:id', optionalAuth, updateAuction);

// DELETE /api/auctions/:id - Delete auction (no ownership check - intentional vulnerability)
router.delete('/:id', optionalAuth, deleteAuction);

export default router;

