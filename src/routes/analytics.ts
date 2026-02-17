import { Router } from 'express';
import {
  getRevenueOverTime,
  getBidActivity,
  getDashboardStats,
  getTopAuctions,
  executeAthenaQuery,
} from '../controllers/analyticsController';
import { verifyToken, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/analytics/stats - Dashboard summary stats (no auth — intentional vulnerability)
router.get('/stats', optionalAuth, getDashboardStats);

// GET /api/analytics/revenue - Revenue over time
router.get('/revenue', optionalAuth, getRevenueOverTime);

// GET /api/analytics/bids - Bid activity over time
router.get('/bids', optionalAuth, getBidActivity);

// GET /api/analytics/top-auctions - Top auctions by activity
router.get('/top-auctions', optionalAuth, getTopAuctions);

// POST /api/analytics/query - Ad-hoc Athena SQL query (intentional SQL injection)
router.post('/query', verifyToken, executeAthenaQuery);

export default router;
