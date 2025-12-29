import { Router } from 'express';
import { register, login, verify } from '../controllers/authController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/register - Register new user
router.post('/register', register);

// POST /api/auth/login - Login user
router.post('/login', login);

// POST /api/auth/verify - Verify JWT token (requires authentication)
router.post('/verify', verifyToken, verify);

export default router;

