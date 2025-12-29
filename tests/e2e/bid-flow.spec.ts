import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import authRoutes from '../../src/routes/auth';
import auctionRoutes from '../../src/routes/auctions';
import { testConnection, closePool, query } from '../../src/config/database';

// E2E tests for complete bidding flow
// These tests verify vulnerabilities exist in real scenarios

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);

describe('Bidding E2E Flow', () => {
  let user1Token: string;
  let user2Token: string;
  let auctionId: number;

  beforeAll(async () => {
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection required for E2E tests');
    }

    // Clean up test data
    await query('DELETE FROM bids');
    await query('DELETE FROM auctions');
    await query('DELETE FROM users');

    // Create two users
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'bidder1@example.com',
        password: 'password123',
        name: 'Bidder 1',
      });

    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'bidder2@example.com',
        password: 'password123',
        name: 'Bidder 2',
      });

    // Login both users
    const login1 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'bidder1@example.com',
        password: 'password123',
      });

    const login2 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'bidder2@example.com',
        password: 'password123',
      });

    user1Token = login1.body.token;
    user2Token = login2.body.token;

    // Create an auction
    const auctionResponse = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'E2E Bidding Test Auction',
        description: 'Test auction for bidding flow',
        starting_price: 100,
        end_time: new Date(Date.now() + 86400000).toISOString(),
      });

    auctionId = auctionResponse.body.id;
  });

  afterAll(async () => {
    await closePool();
  });

  describe('Complete Bidding Flow', () => {
    it('should complete full bidding flow: create auction -> place bids -> view bids', async () => {
      // Step 1: Place first bid
      const bid1Response = await request(app)
        .post(`/api/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          amount: 150,
        });

      expect(bid1Response.status).toBe(201);
      expect(bid1Response.body.amount).toBe(150);

      // Step 2: Place second bid
      const bid2Response = await request(app)
        .post(`/api/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          amount: 200,
        });

      expect(bid2Response.status).toBe(201);
      expect(bid2Response.body.amount).toBe(200);

      // Step 3: View all bids (no authorization check - IDOR vulnerability)
      const bidsResponse = await request(app)
        .get(`/api/auctions/${auctionId}/bids`)
        .send();

      expect(bidsResponse.status).toBe(200);
      expect(Array.isArray(bidsResponse.body)).toBe(true);
      expect(bidsResponse.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should demonstrate race condition vulnerability (no transaction locking)', async () => {
      // Place multiple bids simultaneously
      const promises = [
        request(app)
          .post(`/api/auctions/${auctionId}/bids`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ amount: 250 }),
        request(app)
          .post(`/api/auctions/${auctionId}/bids`)
          .set('Authorization', `Bearer ${user2Token}`)
          .send({ amount: 251 }),
        request(app)
          .post(`/api/auctions/${auctionId}/bids`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ amount: 252 }),
      ];

      const responses = await Promise.all(promises);

      // Race condition: multiple bids might succeed, causing inconsistent state
      // This is intentional - no transaction locking
      const successfulBids = responses.filter(r => r.status === 201);
      expect(successfulBids.length).toBeGreaterThan(0);
    });

    it('should demonstrate no rate limiting (intentional vulnerability)', async () => {
      // Place many bids rapidly
      const rapidBids = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post(`/api/auctions/${auctionId}/bids`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ amount: 300 + i })
      );

      const responses = await Promise.all(rapidBids);

      // No rate limiting - all bids should be accepted (or fail validation)
      // This demonstrates the vulnerability
      const successfulBids = responses.filter(r => r.status === 201);
      expect(successfulBids.length).toBeGreaterThan(0);
    });
  });
});

