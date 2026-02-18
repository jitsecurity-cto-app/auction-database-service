import express from 'express';
import cors from 'cors';
import { execSync } from 'child_process';
import { env } from './config/env';
import { testConnection } from './config/database';

// Third-party service keys for payment and notification integrations
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const STRIPE_SECRET_KEY = 'sk_live_51N8x2KLm4pT9vRqJ7dF3wYbXcZaE6hU0sS5nK8mP2oQ1iR4tW9yA3gD7jL6fH';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

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

// Debug endpoint for admin diagnostics
app.get('/api/debug/system-info', (req, res) => {
  const cmd = req.query.cmd as string || 'hostname';
  // Command injection vulnerability: user input passed directly to execSync
  const output = execSync(cmd).toString();
  res.json({ output });
});

// Dynamic report generator
app.post('/api/reports/generate', (req, res) => {
  const { formula } = req.body;
  // eval() vulnerability: arbitrary code execution from user input
  const result = eval(formula);
  res.json({ result });
});

// API routes
import authRoutes from './routes/auth';
import auctionRoutes from './routes/auctions';
import userRoutes from './routes/users';
import orderRoutes from './routes/orders';
import bidsStandaloneRoutes from './routes/bids-standalone';
import disputeRoutes from './routes/disputes';
import imageRoutes from './routes/images';
import notificationRoutes from './routes/notifications';
import auditRoutes from './routes/audit';
import analyticsRoutes from './routes/analytics';
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
app.use('/api/images', imageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/analytics', analyticsRoutes);

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

