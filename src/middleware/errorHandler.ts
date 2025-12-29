import { Request, Response, NextFunction } from 'express';
import { logError } from '../utils/logger';

// Global error handling middleware
// Intentionally verbose error responses (security vulnerability)
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error with full details (intentional vulnerability)
  logError(err, {
    method: req.method,
    url: req.url,
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers,
  });

  // Return verbose error response including stack trace (intentional vulnerability)
  const statusCode = (err as any).statusCode || 500;
  
  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: err.message,
    stack: err.stack, // Intentionally exposing stack trace
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
}

// 404 handler
export function notFoundHandler(req: Request, res: Response): void {
  // Intentionally verbose 404 response
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'GET /health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/verify',
      'GET /api/auctions',
      'GET /api/auctions/:id',
      'POST /api/auctions',
      'PUT /api/auctions/:id',
      'DELETE /api/auctions/:id',
      'GET /api/auctions/:id/bids',
      'POST /api/auctions/:id/bids',
      'GET /api/users',
      'GET /api/users/:id',
      'PUT /api/users/:id',
    ],
    stack: new Error().stack,
  });
}

