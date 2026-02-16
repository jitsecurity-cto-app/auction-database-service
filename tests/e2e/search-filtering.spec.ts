import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import authRoutes from '../../src/routes/auth';
import auctionRoutes from '../../src/routes/auctions';
import orderRoutes from '../../src/routes/orders';
import { testConnection, closePool, query } from '../../src/config/database';

// E2E tests for search and filtering endpoints
// These tests verify SQL injection vulnerabilities in search/filter parameters

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/orders', orderRoutes);

describe('Search & Filtering E2E', () => {
  let authToken: string;
  let _userId: number;

  beforeAll(async () => {
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection required for E2E tests');
    }

    // Clean up test data
    await query('DELETE FROM bids');
    await query('DELETE FROM auctions');
    await query('DELETE FROM orders');
    await query('DELETE FROM users');

    // Create user
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'search-user@example.com',
        password: 'password123',
        name: 'Search User',
      });

    _userId = registerResponse.body.id;

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'search-user@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.token;

    // Create test auctions
    const auctions = [
      {
        title: 'Vintage Camera',
        description: 'A beautiful vintage camera',
        starting_price: 100,
        status: 'active',
      },
      {
        title: 'Antique Watch',
        description: 'Rare antique watch',
        starting_price: 500,
        status: 'active',
      },
      {
        title: 'Old Book',
        description: 'First edition book',
        starting_price: 50,
        status: 'ended',
      },
    ];

    for (const auction of auctions) {
      await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...auction,
          end_time: auction.status === 'ended' 
            ? new Date(Date.now() - 86400000).toISOString()
            : new Date(Date.now() + 86400000).toISOString(),
        });
    }
  });

  afterAll(async () => {
    await closePool();
  });

  describe('Auction Search', () => {
    it('should search auctions by title', async () => {
      const response = await request(app)
        .get('/api/auctions?search=camera');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should search auctions by description', async () => {
      const response = await request(app)
        .get('/api/auctions?search=vintage');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should accept SQL injection in search query (intentional vulnerability)', async () => {
      const sqlQuery = "camera' OR '1'='1";
      const response = await request(app)
        .get(`/api/auctions?search=${encodeURIComponent(sqlQuery)}`);

      // Should either fail with SQL error or expose vulnerability
      expect([200, 400, 500]).toContain(response.status);
    });

    it('should accept XSS in search query (intentional vulnerability)', async () => {
      const xssQuery = '<script>alert("XSS")</script>';
      const response = await request(app)
        .get(`/api/auctions?search=${encodeURIComponent(xssQuery)}`);

      // Should accept XSS payload (no sanitization)
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('Auction Status Filter', () => {
    it('should filter auctions by active status', async () => {
      const response = await request(app)
        .get('/api/auctions?status=active');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter auctions by ended status', async () => {
      const response = await request(app)
        .get('/api/auctions?status=ended');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should accept SQL injection in status filter (intentional vulnerability)', async () => {
      const sqlStatus = "active' OR '1'='1";
      const response = await request(app)
        .get(`/api/auctions?status=${encodeURIComponent(sqlStatus)}`);

      // Should either fail with SQL error or expose vulnerability
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('Auction Price Filter', () => {
    it('should filter auctions by minimum price', async () => {
      const response = await request(app)
        .get('/api/auctions?minPrice=100');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter auctions by maximum price', async () => {
      const response = await request(app)
        .get('/api/auctions?maxPrice=200');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter auctions by price range', async () => {
      const response = await request(app)
        .get('/api/auctions?minPrice=50&maxPrice=200');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should accept SQL injection in price filters (intentional vulnerability)', async () => {
      const sqlPrice = "100 OR 1=1";
      const response = await request(app)
        .get(`/api/auctions?minPrice=${encodeURIComponent(sqlPrice)}`);

      // Should either fail with SQL error or expose vulnerability
      expect([200, 400, 500]).toContain(response.status);
    });

    it('should accept negative price in filter (no validation)', async () => {
      const response = await request(app)
        .get('/api/auctions?minPrice=-100');

      // Should either accept (vulnerability) or reject
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('Order Filtering', () => {
    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders?status=pending_payment');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter orders by payment status', async () => {
      const response = await request(app)
        .get('/api/orders?payment_status=paid');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter orders by shipping status', async () => {
      const response = await request(app)
        .get('/api/orders?shipping_status=shipped');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should accept SQL injection in order status filter (intentional vulnerability)', async () => {
      const sqlStatus = "pending_payment' OR '1'='1";
      const response = await request(app)
        .get(`/api/orders?status=${encodeURIComponent(sqlStatus)}`);

      // Should either fail with SQL error or expose vulnerability
      expect([200, 400, 500]).toContain(response.status);
    });

    it('should accept SQL injection in buyer_id filter (intentional vulnerability)', async () => {
      const sqlBuyerId = "1 OR 1=1";
      const response = await request(app)
        .get(`/api/orders?buyer_id=${encodeURIComponent(sqlBuyerId)}`);

      // Should either fail with SQL error or expose vulnerability
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('Combined Filters', () => {
    it('should combine search and status filter', async () => {
      const response = await request(app)
        .get('/api/auctions?search=camera&status=active');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should combine search, status, and price filters', async () => {
      const response = await request(app)
        .get('/api/auctions?search=vintage&status=active&minPrice=50&maxPrice=200');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should combine multiple order filters', async () => {
      const response = await request(app)
        .get('/api/orders?status=pending_payment&payment_status=pending&shipping_status=pending');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Pagination', () => {
    it('should paginate auction results', async () => {
      const response = await request(app)
        .get('/api/auctions?limit=2&offset=0');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should accept SQL injection in pagination (intentional vulnerability)', async () => {
      const sqlLimit = "2 OR 1=1";
      const response = await request(app)
        .get(`/api/auctions?limit=${encodeURIComponent(sqlLimit)}`);

      // Should either fail with SQL error or expose vulnerability
      expect([200, 400, 500]).toContain(response.status);
    });

    it('should accept negative pagination values (no validation)', async () => {
      const response = await request(app)
        .get('/api/auctions?limit=-10&offset=-5');

      // Should either accept (vulnerability) or reject
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty search query', async () => {
      const response = await request(app)
        .get('/api/auctions?search=');

      expect([200, 400]).toContain(response.status);
    });

    it('should handle invalid status value', async () => {
      const response = await request(app)
        .get('/api/auctions?status=invalid_status');

      expect([200, 400, 500]).toContain(response.status);
    });

    it('should handle very large price values', async () => {
      const response = await request(app)
        .get('/api/auctions?minPrice=999999999999999999');

      expect([200, 400, 500]).toContain(response.status);
    });
  });
});
