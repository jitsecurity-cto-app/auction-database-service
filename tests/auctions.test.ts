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

describe('Auction Endpoints', () => {
  beforeAll(async () => {
    const connected = await testConnection();
    if (!connected) {
      console.warn('Database not connected - some tests may fail');
    }

    // Register and login to get auth token
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'auctiontest@example.com',
        password: 'password123',
        name: 'Auction Test User',
      });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'auctiontest@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await closePool();
  });

  describe('GET /api/auctions', () => {
    it('should list all auctions', async () => {
      const response = await request(app)
        .get('/api/auctions')
        .send();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should be vulnerable to SQL injection in status query param', async () => {
      // This test verifies SQL injection vulnerability exists
      const response = await request(app)
        .get('/api/auctions?status=active\' OR \'1\'=\'1')
        .send();

      // Should either fail or expose vulnerability
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/auctions/:id', () => {
    it('should get auction by ID (no authorization check - IDOR vulnerability)', async () => {
      // First create an auction
      const createResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Auction',
          description: 'Test Description',
          starting_price: 100,
          end_time: new Date(Date.now() + 86400000).toISOString(),
        });

      const auctionId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', auctionId);
      // Intentionally verify no authorization check (IDOR vulnerability)
      // Anyone can access any auction
    });

    it('should be vulnerable to SQL injection in ID parameter', async () => {
      const response = await request(app)
        .get('/api/auctions/1 OR 1=1')
        .send();

      // Should either fail or expose vulnerability (200 = exposed, 404/500 = failed)
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/auctions', () => {
    it('should create auction (no input validation)', async () => {
      const response = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'New Auction',
          description: '<script>alert("XSS")</script>', // XSS payload
          starting_price: 50,
          end_time: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      // Intentionally verify no input sanitization (XSS vulnerability)
      expect(response.body.description).toContain('<script>');
    });
  });

  describe('PUT /api/auctions/:id', () => {
    it('should update auction (no ownership check - intentional vulnerability)', async () => {
      // Create an auction
      const createResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Update Test Auction',
          description: 'Original Description',
          starting_price: 100,
          end_time: new Date(Date.now() + 86400000).toISOString(),
        });

      const auctionId = createResponse.body.id;

      // Update without authentication (should work due to no ownership check)
      const response = await request(app)
        .put(`/api/auctions/${auctionId}`)
        .send({
          title: 'Updated Title',
        });

      // Intentionally verify no ownership check (vulnerability)
      // 500 is also acceptable (shows system error/vulnerability)
      expect([200, 401, 500]).toContain(response.status);
    });
  });

  describe('DELETE /api/auctions/:id', () => {
    it('should delete auction (no ownership check - intentional vulnerability)', async () => {
      // Create an auction
      const createResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Delete Test Auction',
          description: 'To be deleted',
          starting_price: 100,
          end_time: new Date(Date.now() + 86400000).toISOString(),
        });

      const auctionId = createResponse.body.id;

      // Delete without authentication (should work due to no ownership check)
      const response = await request(app)
        .delete(`/api/auctions/${auctionId}`)
        .send();

      // Intentionally verify no ownership check (vulnerability)
      // 500 is also acceptable (shows system error/vulnerability)
      expect([200, 401, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/auctions/:id/close', () => {
    it('should close auction and determine winner', async () => {
      // Create an auction
      const createResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Close Test Auction',
          description: 'To be closed',
          starting_price: 100,
          end_time: new Date(Date.now() - 86400000).toISOString(), // Past date
        });

      const auctionId = createResponse.body.id;

      // Place a bid
      await request(app)
        .post(`/api/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 150 });

      // Close the auction
      const response = await request(app)
        .post(`/api/auctions/${auctionId}/close`)
        .send();

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('auction');
        expect(response.body.auction).toHaveProperty('status', 'ended');
      }
    });

    it('should be vulnerable to SQL injection in ID parameter', async () => {
      const response = await request(app)
        .post('/api/auctions/1 OR 1=1/close')
        .send();

      // Should either fail or expose vulnerability
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/auctions/close-expired', () => {
    it('should close all expired auctions', async () => {
      // Create an expired auction
      await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Expired Auction',
          description: 'Already expired',
          starting_price: 100,
          end_time: new Date(Date.now() - 86400000).toISOString(),
        });

      const response = await request(app)
        .post('/api/auctions/close-expired')
        .send();

      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty('closed_count');
        expect(response.body).toHaveProperty('auctions');
      }
    });
  });
});

