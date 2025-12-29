import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// Extend Express Request to include user info
export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

// Weak JWT verification middleware (intentional security vulnerability)
export function verifyToken(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    // Get token from Authorization header or body
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.body?.token) {
      token = req.body.token;
    }

    if (!token) {
      // Intentionally verbose error (security vulnerability)
      res.status(401).json({
        error: 'No token provided',
        message: 'Authentication token is required',
        stack: new Error().stack,
      });
      return;
    }

    // Verify token with weak secret (intentional)
    // No expiration check (intentional vulnerability)
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;

    // Intentionally verbose logging (security vulnerability)
    console.log('Token verified:', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      token: token.substring(0, 20) + '...',
    });

    // Attach user info to request
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Token verification failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
      });
    }

    res.status(401).json({
      error: 'Invalid token',
      message: error instanceof Error ? error.message : 'Token verification failed',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Optional middleware - doesn't fail if no token (for public endpoints)
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.body?.token) {
      token = req.body.token;
    }

    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      req.userId = decoded.userId;
      req.userRole = decoded.role;
    }
  } catch (error) {
    // Silently fail for optional auth
    console.log('Optional auth failed, continuing without authentication');
  }

  next();
}

