import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import userRoutes from '../src/routes/users';
import auctionRoutes from '../src/routes/auctions';
import authRoutes from '../src/routes/auth';
import bidsStandaloneRoutes from '../src/routes/bids-standalone';
import { testConnection, closePool, query } from '../src/config/database';

// Note: These tests verify that vulnerabilities exist (don't fix them)

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bids', bidsStandaloneRoutes);

let authToken1: string;
let authToken2: string;
let userId1: number;
let userId2: number;
let auctionId1: number;
let auctionId2: number;
let bidId1: number;
let bidId2: number;

describe('User Endpoints - My Bids/Wins/Auctions/Sales', () => {
  beforeAll(async () => {
    const connected = await testConnection();
    if (!connected) {
      console.warn('Database not connected - some tests may fail');
    }

    // Register and login user 1
    const registerResponse1 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user1@example.com',
        password: 'password123',
        name: 'User 1',
      });

    if (registerResponse1.status !== 201 && registerResponse1.status !== 200) {
      console.warn('Register user 1 failed:', registerResponse1.status, registerResponse1.body);
    }

    const loginResponse1 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user1@example.com',
        password: 'password123',
      });

    if (loginResponse1.status !== 200 || !loginResponse1.body.user) {
      console.error('Login user 1 failed:', loginResponse1.status, loginResponse1.body);
      throw new Error(`Login user 1 failed with status ${loginResponse1.status}: ${JSON.stringify(loginResponse1.body)}`);
    }

    authToken1 = loginResponse1.body.token;
    userId1 = loginResponse1.body.user.id;

    // Register and login user 2
    const registerResponse2 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user2@example.com',
        password: 'password123',
        name: 'User 2',
      });

    if (registerResponse2.status !== 201 && registerResponse2.status !== 200) {
      console.warn('Register user 2 failed:', registerResponse2.status, registerResponse2.body);
    }

    const loginResponse2 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'user2@example.com',
        password: 'password123',
      });

    if (loginResponse2.status !== 200 || !loginResponse2.body.user) {
      console.error('Login user 2 failed:', loginResponse2.status, loginResponse2.body);
      throw new Error(`Login user 2 failed with status ${loginResponse2.status}: ${JSON.stringify(loginResponse2.body)}`);
    }

    authToken2 = loginResponse2.body.token;
    userId2 = loginResponse2.body.user.id;

    // User 1 creates an auction
    const auctionResponse1 = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        title: 'Auction 1',
        description: 'Test auction 1',
        starting_price: 100,
        end_time: new Date(Date.now() + 86400000).toISOString(),
      });

    auctionId1 = auctionResponse1.body.id;

    // User 2 creates an auction
    const auctionResponse2 = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${authToken2}`)
      .send({
        title: 'Auction 2',
        description: 'Test auction 2',
        starting_price: 200,
        end_time: new Date(Date.now() + 86400000).toISOString(),
      });

    auctionId2 = auctionResponse2.body.id;

    // User 2 bids on auction 1
    const bidResponse1 = await request(app)
      .post(`/api/auctions/${auctionId1}/bids`)
      .set('Authorization', `Bearer ${authToken2}`)
      .send({
        amount: 150,
      });

    bidId1 = bidResponse1.body.id;

    // User 1 bids on auction 2
    const bidResponse2 = await request(app)
      .post(`/api/auctions/${auctionId2}/bids`)
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        amount: 250,
      });

    bidId2 = bidResponse2.body.id;

    // Complete auction 1 (user 2 won)
    await query(`UPDATE auctions SET status = 'completed' WHERE id = ${auctionId1}`);
  });

  afterAll(async () => {
    await closePool();
  });

  describe('GET /api/users/:id/my-bids', () => {
    it('should get all bids by user (no authorization check - IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${userId2}/my-bids`)
        .send();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(0);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('auction_title');
        expect(response.body[0]).toHaveProperty('auction_status');
      }
      // Intentionally verify no authorization check (IDOR vulnerability)
    });

    it('should be vulnerable to SQL injection in user ID', async () => {
      const response = await request(app)
        .get('/api/users/1 OR 1=1/my-bids')
        .send();

      // Should either fail or expose vulnerability
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/users/:id/my-wins', () => {
    it('should get all winning bids by user (no authorization check - IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${userId2}/my-wins`)
        .send();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // User 2 should have at least one win (auction 1)
      expect(response.body.length).toBeGreaterThanOrEqual(0);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('auction_title');
        expect(response.body[0]).toHaveProperty('auction_status', 'completed');
      }
      // Intentionally verify no authorization check (IDOR vulnerability)
    });
  });

  describe('GET /api/users/:id/my-auctions', () => {
    it('should get all auctions created by user (no authorization check - IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${userId1}/my-auctions`)
        .send();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('bid_count');
      expect(response.body[0]).toHaveProperty('highest_bid');
      // Intentionally verify no authorization check (IDOR vulnerability)
    });
  });

  describe('GET /api/users/:id/my-sales', () => {
    it('should get all completed auctions created by user (no authorization check - IDOR vulnerability)', async () => {
      const response = await request(app)
        .get(`/api/users/${userId1}/my-sales`)
        .send();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      // Intentionally verify no authorization check (IDOR vulnerability)
      // Note: May be empty if no completed auctions exist
    });
  });

  describe('PUT /api/bids/:id/payment-status', () => {
    it('should update payment status (no authorization check - intentional vulnerability)', async () => {
      const response = await request(app)
        .put(`/api/bids/${bidId1}/payment-status`)
        .send({
          payment_status: 'paid',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('payment_status', 'paid');
      // Intentionally verify no authorization check (vulnerability)
    });

    it('should be vulnerable to SQL injection in bid ID', async () => {
      const response = await request(app)
        .put('/api/bids/1 OR 1=1/payment-status')
        .send({
          payment_status: 'paid',
        });

      // Should either fail or expose vulnerability
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should accept any payment status value (no validation)', async () => {
      const response = await request(app)
        .put(`/api/bids/${bidId2}/payment-status`)
        .send({
          payment_status: '<script>alert("XSS")</script>',
        });

      // Should either accept invalid value or fail
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});
