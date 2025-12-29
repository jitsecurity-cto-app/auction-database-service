import { Router } from 'express';
import { listUsers, getUserById, updateUser } from '../controllers/userController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/users - List all users (no admin check - intentional vulnerability)
router.get('/', optionalAuth, listUsers);

// GET /api/users/:id - Get user by ID (no authorization check - IDOR vulnerability)
router.get('/:id', optionalAuth, getUserById);

// PUT /api/users/:id - Update user (no authorization check - intentional vulnerability)
router.put('/:id', optionalAuth, updateUser);

export default router;

