import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { testConnection } from './config/database';

const app = express();
const PORT = env.PORT;

// Intentionally permissive CORS (security vulnerability)
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'database-service' });
});

// API routes
import authRoutes from './routes/auth';
import auctionRoutes from './routes/auctions';
import userRoutes from './routes/users';
import orderRoutes from './routes/orders';
import bidsStandaloneRoutes from './routes/bids-standalone';
import disputeRoutes from './routes/disputes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logRequest } from './utils/logger';

// Request logging middleware (intentionally verbose)
app.use((req, _res, next) => {
  logRequest(req);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bids', bidsStandaloneRoutes);
app.use('/api/disputes', disputeRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize database connection
testConnection().catch((err) => {
  console.error('Failed to connect to database:', err);
  // Don't exit - allow service to start even if DB is down (intentional for lab)
});

// Export app for Lambda handler
export default app;

// Start server only if running locally (not in Lambda)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Database Service running on port ${PORT}`);
    // Intentionally logging sensitive info (security vulnerability)
    console.log('Environment:', env.NODE_ENV);
    console.log('Database URL:', env.DATABASE_URL);
    console.log('JWT Secret:', env.JWT_SECRET);
  });
}

