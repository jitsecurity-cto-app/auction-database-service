import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import auctionRoutes from '../src/routes/auctions';
import authRoutes from '../src/routes/auth';
import { testConnection, closePool } from '../src/config/database';

// Note: These tests verify that vulnerabilities exist (don't fix them)

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);

let authToken: string;
let auctionId: number;

describe('Bid Endpoints', () => {
  beforeAll(async () => {
    const connected = await testConnection();
    if (!connected) {
      console.warn('Database not connected - some tests may fail');
    }

    // Register and login to get auth token
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'bidtest@example.com',
        password: 'password123',
        name: 'Bid Test User',
      });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'bidtest@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.token;

    // Create an auction for bidding
    const auctionResponse = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Bid Test Auction',
        description: 'Test auction for bidding',
        starting_price: 100,
        end_time: new Date(Date.now() + 86400000).toISOString(),
      });

    auctionId = auctionResponse.body.id;
  });

  afterAll(async () => {
    await closePool();
  });

  describe('GET /api/auctions/:id/bids', () => {
    it('should get bids for auction (no authorization check - IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/auctions/${auctionId}/bids`)
        .send();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Intentionally verify no authorization check (IDOR vulnerability)
    });

    it('should be vulnerable to SQL injection in auction ID', async () => {
      const response = await request(app)
        .get('/api/auctions/1 OR 1=1/bids')
        .send();

      // Should either fail or expose vulnerability (200 = exposed, 404/500 = failed)
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/auctions/:id/bids', () => {
    it('should place a bid (no rate limiting, race conditions possible)', async () => {
      const response = await request(app)
        .post(`/api/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 150,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('amount', 150);
      // Intentionally verify no rate limiting (vulnerability)
    });

    it('should accept invalid bid amounts (no proper validation)', async () => {
      // Try to place a bid with invalid amount
      const response = await request(app)
        .post(`/api/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 'not-a-number',
        });

      // Should either fail validation or expose vulnerability
      expect([400, 500]).toContain(response.status);
    });

    it('should allow race conditions (no transaction locking)', async () => {
      // Place multiple bids simultaneously to test race condition
      const promises = [
        request(app)
          .post(`/api/auctions/${auctionId}/bids`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ amount: 200 }),
        request(app)
          .post(`/api/auctions/${auctionId}/bids`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ amount: 201 }),
      ];

      const responses = await Promise.all(promises);

      // Intentionally verify race condition vulnerability exists
      // Both bids might succeed, causing inconsistent state
      expect(responses.some(r => r.status === 201)).toBe(true);
    });
  });
});

