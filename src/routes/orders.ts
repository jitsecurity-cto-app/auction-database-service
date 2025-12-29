import { Router } from 'express';
import {
  listOrders,
  getOrderById,
  createOrder,
  updateOrder,
} from '../controllers/orderController';
import { verifyToken, optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/orders - List orders (with filters)
router.get('/', optionalAuth, listOrders);

// GET /api/orders/:id - Get order by ID (no authorization check - intentional vulnerability)
router.get('/:id', optionalAuth, getOrderById);

// POST /api/orders - Create new order (requires authentication)
router.post('/', verifyToken, createOrder);

// PUT /api/orders/:id - Update order (no ownership check - intentional vulnerability)
router.put('/:id', optionalAuth, updateOrder);

export default router;
