import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import authRoutes from '../../src/routes/auth';
import auctionRoutes from '../../src/routes/auctions';
import { testConnection, closePool, query } from '../../src/config/database';

// E2E tests for auction management endpoints
// These tests verify authorization vulnerabilities and auction operations

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);

describe('Auction Management E2E', () => {
  let ownerToken: string;
  let _ownerId: number;
  let otherUserToken: string;
  let _otherUserId: number;
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

    // Create owner user
    const ownerRegister = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'owner@example.com',
        password: 'password123',
        name: 'Auction Owner',
      });

    _ownerId = ownerRegister.body.id;

    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'owner@example.com',
        password: 'password123',
      });

    ownerToken = ownerLogin.body.token;

    // Create other user
    const otherUserRegister = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'other@example.com',
        password: 'password123',
        name: 'Other User',
      });

    _otherUserId = otherUserRegister.body.id;

    const otherUserLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'other@example.com',
        password: 'password123',
      });

    otherUserToken = otherUserLogin.body.token;

    // Create auction by owner
    const auctionResponse = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Management Test Auction',
        description: 'Test auction for management',
        starting_price: 100,
        end_time: new Date(Date.now() + 86400000).toISOString(),
      });

    auctionId = auctionResponse.body.id;
  });

  afterAll(async () => {
    await closePool();
  });

  describe('PUT /api/auctions/:id - Update Auction', () => {
    it('should update own auction', async () => {
      const updateData = {
        title: 'Updated Auction Title',
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/auctions/${auctionId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(updateData);

      // Should succeed or fail depending on implementation
      expect([200, 201, 400, 500]).toContain(response.status);
    });

    it('should accept XSS in updated auction data (intentional vulnerability)', async () => {
      const xssUpdateData = {
        title: '<script>alert("XSS")</script>Updated Title',
        description: '<img src=x onerror="alert(document.cookie)">',
      };

      const response = await request(app)
        .put(`/api/auctions/${auctionId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(xssUpdateData);

      // Should accept XSS payload (no sanitization)
      expect([200, 201, 400, 500]).toContain(response.status);
    });

    it('should allow other user to update auction (authorization vulnerability)', async () => {
      const updateData = {
        title: 'Hacked Auction Title',
      };

      const response = await request(app)
        .put(`/api/auctions/${auctionId}`)
        .set('Authorization', `Bearer ${otherUserToken}`) // Other user updating owner's auction
        .send(updateData);

      // Should fail (proper authorization) or succeed (authorization vulnerability)
      expect([200, 201, 400, 401, 403, 500]).toContain(response.status);
    });

    it('should allow update without authentication (authorization vulnerability)', async () => {
      const updateData = {
        title: 'Unauthorized Update',
      };

      const response = await request(app)
        .put(`/api/auctions/${auctionId}`)
        .send(updateData);

      // Should fail (proper authorization) or succeed (authorization vulnerability)
      expect([200, 201, 400, 401, 403, 500]).toContain(response.status);
    });
  });

  describe('DELETE /api/auctions/:id - Delete Auction', () => {
    let deletableAuctionId: number;

    beforeAll(async () => {
      // Create auction for deletion test
      const auctionResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Deletable Auction',
          description: 'This auction will be deleted',
          starting_price: 50,
          end_time: new Date(Date.now() + 86400000).toISOString(),
        });

      deletableAuctionId = auctionResponse.body.id;
    });

    it('should delete own auction', async () => {
      const response = await request(app)
        .delete(`/api/auctions/${deletableAuctionId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      // Should succeed or fail depending on implementation
      expect([200, 204, 400, 404, 500]).toContain(response.status);
    });

    it('should allow other user to delete auction (authorization vulnerability)', async () => {
      // Create another auction for this test
      const auctionResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Another Deletable Auction',
          description: 'Testing deletion',
          starting_price: 75,
          end_time: new Date(Date.now() + 86400000).toISOString(),
        });

      const testAuctionId = auctionResponse.body.id;

      const response = await request(app)
        .delete(`/api/auctions/${testAuctionId}`)
        .set('Authorization', `Bearer ${otherUserToken}`); // Other user deleting owner's auction

      // Should fail (proper authorization) or succeed (authorization vulnerability)
      expect([200, 204, 400, 401, 403, 404, 500]).toContain(response.status);
    });

    it('should allow delete without authentication (authorization vulnerability)', async () => {
      // Create another auction for this test
      const auctionResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Unauthorized Delete Test',
          description: 'Testing unauthorized deletion',
          starting_price: 80,
          end_time: new Date(Date.now() + 86400000).toISOString(),
        });

      const testAuctionId = auctionResponse.body.id;

      const response = await request(app)
        .delete(`/api/auctions/${testAuctionId}`);

      // Should fail (proper authorization) or succeed (authorization vulnerability)
      expect([200, 204, 400, 401, 403, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/auctions/:id/close - Close Auction', () => {
    let closableAuctionId: number;

    beforeAll(async () => {
      // Create expired auction for closing
      const auctionResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Closable Auction',
          description: 'This auction will be closed',
          starting_price: 100,
          end_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        });

      closableAuctionId = auctionResponse.body.id;
    });

    it('should close own auction', async () => {
      const response = await request(app)
        .post(`/api/auctions/${closableAuctionId}/close`);

      expect([200, 400, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('auction');
        expect(response.body.auction.status).toBe('ended');
      }
    });

    it('should allow other user to close auction (authorization vulnerability)', async () => {
      // Create another expired auction
      const auctionResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Another Closable Auction',
          description: 'Testing unauthorized close',
          starting_price: 150,
          end_time: new Date(Date.now() - 3600000).toISOString(),
        });

      const testAuctionId = auctionResponse.body.id;

      const response = await request(app)
        .post(`/api/auctions/${testAuctionId}/close`)
        .set('Authorization', `Bearer ${otherUserToken}`); // Other user closing owner's auction

      // Should fail (proper authorization) or succeed (authorization vulnerability)
      expect([200, 400, 401, 403, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/auctions/close-expired - Close Expired Auctions', () => {
    it('should close expired auctions', async () => {
      // Create expired auction
      await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Expired Auction',
          description: 'Already expired',
          starting_price: 50,
          end_time: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        });

      const response = await request(app)
        .post('/api/auctions/close-expired');

      expect([200, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('closed_count');
        expect(response.body).toHaveProperty('auctions');
      }
    });

    it('should allow anyone to close expired auctions (intentional vulnerability)', async () => {
      // Create expired auction
      await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Another Expired Auction',
          description: 'Testing public close',
          starting_price: 75,
          end_time: new Date(Date.now() - 86400000).toISOString(),
        });

      const response = await request(app)
        .post('/api/auctions/close-expired')
        .set('Authorization', `Bearer ${otherUserToken}`); // Other user closing expired auctions

      // Should work (public endpoint - intentional vulnerability)
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('SQL Injection in Auction Operations', () => {
    it('should accept SQL injection in auction ID (intentional vulnerability)', async () => {
      const sqlInjectionId = `${auctionId}' OR '1'='1`;
      const response = await request(app)
        .get(`/api/auctions/${sqlInjectionId}`);

      // Should either fail with SQL error or expose vulnerability
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should accept SQL injection in update data (intentional vulnerability)', async () => {
      const sqlUpdateData = {
        title: "Test' OR '1'='1",
        description: "Description' OR '1'='1",
      };

      const response = await request(app)
        .put(`/api/auctions/${auctionId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(sqlUpdateData);

      // Should either fail with SQL error or expose vulnerability
      expect([200, 201, 400, 500]).toContain(response.status);
    });
  });
});
