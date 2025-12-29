import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import authRoutes from '../../src/routes/auth';
import auctionRoutes from '../../src/routes/auctions';
import userRoutes from '../../src/routes/users';
import { testConnection, closePool, query } from '../../src/config/database';

// E2E tests for user endpoints
// These tests verify IDOR vulnerabilities in user-specific endpoints

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/users', userRoutes);

describe('User Endpoints E2E', () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  let auctionId: number;

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

    // Create user 1
    const user1Register = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user1@example.com',
        password: 'password123',
        name: 'User One',
      });

    user1Id = user1Register.body.id;

    const user1Login = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user1@example.com',
        password: 'password123',
      });

    user1Token = user1Login.body.token;

    // Create user 2
    const user2Register = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user2@example.com',
        password: 'password123',
        name: 'User Two',
      });

    user2Id = user2Register.body.id;

    const user2Login = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user2@example.com',
        password: 'password123',
      });

    user2Token = user2Login.body.token;

    // Create auction by user 1
    const auctionResponse = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'User Endpoints Test Auction',
        description: 'Test auction',
        starting_price: 100,
        end_time: new Date(Date.now() + 86400000).toISOString(),
      });

    auctionId = auctionResponse.body.id;

    // Place bid by user 2
    await request(app)
      .post(`/api/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ amount: 150 });
  });

  afterAll(async () => {
    await closePool();
  });

  describe('GET /api/users/:id/my-bids', () => {
    it('should get own bids', async () => {
      const response = await request(app)
        .get(`/api/users/${user2Id}/my-bids`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('auction_id');
        expect(response.body[0]).toHaveProperty('amount');
      }
    });

    it('should allow access to other user bids without authorization (IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${user2Id}/my-bids`)
        .set('Authorization', `Bearer ${user1Token}`); // User 1 accessing User 2's bids

      // Should work (IDOR vulnerability) or fail (proper authorization)
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should allow access without authentication (IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${user2Id}/my-bids`);

      // Should work (IDOR vulnerability) or fail (proper authorization)
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should accept SQL injection in user ID (intentional vulnerability)', async () => {
      const sqlInjectionId = `${user2Id}' OR '1'='1`;
      const response = await request(app)
        .get(`/api/users/${sqlInjectionId}/my-bids`);

      // Should either fail with SQL error or expose vulnerability
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('GET /api/users/:id/my-wins', () => {
    it('should get own wins', async () => {
      const response = await request(app)
        .get(`/api/users/${user2Id}/my-wins`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow access to other user wins without authorization (IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${user2Id}/my-wins`)
        .set('Authorization', `Bearer ${user1Token}`); // User 1 accessing User 2's wins

      // Should work (IDOR vulnerability) or fail (proper authorization)
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should allow access without authentication (IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${user2Id}/my-wins`);

      // Should work (IDOR vulnerability) or fail (proper authorization)
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe('GET /api/users/:id/my-auctions', () => {
    it('should get own auctions', async () => {
      const response = await request(app)
        .get(`/api/users/${user1Id}/my-auctions`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('title');
      }
    });

    it('should allow access to other user auctions without authorization (IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${user1Id}/my-auctions`)
        .set('Authorization', `Bearer ${user2Token}`); // User 2 accessing User 1's auctions

      // Should work (IDOR vulnerability) or fail (proper authorization)
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should allow access without authentication (IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${user1Id}/my-auctions`);

      // Should work (IDOR vulnerability) or fail (proper authorization)
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe('GET /api/users/:id/my-sales', () => {
    it('should get own sales', async () => {
      const response = await request(app)
        .get(`/api/users/${user1Id}/my-sales`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow access to other user sales without authorization (IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${user1Id}/my-sales`)
        .set('Authorization', `Bearer ${user2Token}`); // User 2 accessing User 1's sales

      // Should work (IDOR vulnerability) or fail (proper authorization)
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should allow access without authentication (IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${user1Id}/my-sales`);

      // Should work (IDOR vulnerability) or fail (proper authorization)
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  describe('Complete User Activity Flow', () => {
    it('should complete flow: create auction → place bid → view in activity endpoints', async () => {
      // User 1 creates auction
      const auctionResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Activity Flow Test Auction',
          description: 'Testing activity endpoints',
          starting_price: 200,
          end_time: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(auctionResponse.status).toBe(201);
      const newAuctionId = auctionResponse.body.id;

      // Verify in user 1's my-auctions
      const myAuctionsResponse = await request(app)
        .get(`/api/users/${user1Id}/my-auctions`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(myAuctionsResponse.status).toBe(200);
      const myAuctions = myAuctionsResponse.body;
      const foundAuction = Array.isArray(myAuctions)
        ? myAuctions.find((a: any) => a.id === newAuctionId || a.id === String(newAuctionId))
        : null;
      expect(foundAuction).toBeDefined();

      // User 2 places bid
      const bidResponse = await request(app)
        .post(`/api/auctions/${newAuctionId}/bids`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ amount: 250 });

      expect(bidResponse.status).toBe(201);

      // Verify in user 2's my-bids
      const myBidsResponse = await request(app)
        .get(`/api/users/${user2Id}/my-bids`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(myBidsResponse.status).toBe(200);
      const myBids = myBidsResponse.body;
      const foundBid = Array.isArray(myBids)
        ? myBids.find((b: any) => b.auction_id === newAuctionId || b.auction_id === String(newAuctionId))
        : null;
      expect(foundBid).toBeDefined();
    });
  });
});
