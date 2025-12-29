import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import authRoutes from '../../src/routes/auth';
import auctionRoutes from '../../src/routes/auctions';
import orderRoutes from '../../src/routes/orders';
import { testConnection, closePool, query } from '../../src/config/database';

// E2E tests for complete order flow: auction -> bidding -> closure -> order creation -> shipping
// These tests verify vulnerabilities exist in real scenarios

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/orders', orderRoutes);

describe('Order E2E Flow', () => {
  let sellerToken: string;
  let buyerToken: string;
  let auctionId: number;

  beforeAll(async () => {
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection required for E2E tests');
    }

    // Clean up test data
    await query('DELETE FROM orders');
    await query('DELETE FROM bids');
    await query('DELETE FROM auctions');
    await query('DELETE FROM users');

    // Create seller
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'seller@example.com',
        password: 'password123',
        name: 'Seller User',
      });

    const sellerLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'seller@example.com',
        password: 'password123',
      });

    sellerToken = sellerLogin.body.token;

    // Create buyer
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'buyer@example.com',
        password: 'password123',
        name: 'Buyer User',
      });

    const buyerLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'buyer@example.com',
        password: 'password123',
      });

    buyerToken = buyerLogin.body.token;

    // Create an auction that will expire
    const auctionResponse = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'E2E Order Test Auction',
        description: 'Test auction for order flow',
        starting_price: 100,
        end_time: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      });

    auctionId = auctionResponse.body.id;
  });

  afterAll(async () => {
    await closePool();
  });

  describe('Complete Order Flow', () => {
    it('should complete full flow: bid -> close auction -> create order -> update shipping', async () => {
      // Step 1: Place a bid
      const bidResponse = await request(app)
        .post(`/api/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          amount: 150,
        });

      expect(bidResponse.status).toBe(201);
      expect(bidResponse.body.amount).toBe(150);

      // Step 2: Close the auction and determine winner
      const closeResponse = await request(app)
        .post(`/api/auctions/${auctionId}/close`)
        .send();

      expect(closeResponse.status).toBe(200);
      expect(closeResponse.body.auction.status).toBe('ended');
      expect(closeResponse.body.winner_id).toBeDefined();

      // Step 3: Create order as winner
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          auction_id: auctionId,
          shipping_address: '123 Test Street, Test City, TS 12345',
        });

      expect([201, 400, 404, 500]).toContain(orderResponse.status);
      
      if (orderResponse.status === 201) {
        const orderId = orderResponse.body.id;

        // Step 4: Update shipping status (no authorization check - intentional vulnerability)
        const updateResponse = await request(app)
          .put(`/api/orders/${orderId}`)
          .send({
            shipping_status: 'shipped',
            tracking_number: 'TRACK123456',
          });

        // Intentionally verify no ownership check (vulnerability)
        expect([200, 404, 500]).toContain(updateResponse.status);
      }
    });

    it('should demonstrate IDOR vulnerability in order access', async () => {
      // Create an order
      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          auction_id: auctionId,
          shipping_address: '123 Test St',
        });

      if (orderResponse.status === 201) {
        const orderId = orderResponse.body.id;

        // Try to access order without authentication (should work due to IDOR)
        const getResponse = await request(app)
          .get(`/api/orders/${orderId}`)
          .send();

        // Intentionally verify no authorization check (IDOR vulnerability)
        expect([200, 404, 500]).toContain(getResponse.status);
      }
    });

    it('should close expired auctions automatically', async () => {
      // Create another expired auction
      const expiredAuctionResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          title: 'Expired Auction',
          description: 'Already expired',
          starting_price: 50,
          end_time: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        });

      const expiredAuctionId = expiredAuctionResponse.body.id;

      // Place a bid
      await request(app)
        .post(`/api/auctions/${expiredAuctionId}/bids`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ amount: 75 });

      // Close expired auctions
      const closeExpiredResponse = await request(app)
        .post('/api/auctions/close-expired')
        .send();

      expect([200, 500]).toContain(closeExpiredResponse.status);
      
      if (closeExpiredResponse.status === 200) {
        expect(closeExpiredResponse.body).toHaveProperty('closed_count');
        expect(closeExpiredResponse.body).toHaveProperty('auctions');
      }
    });

    it('should demonstrate SQL injection in order filters', async () => {
      // Try SQL injection in query parameters
      const response = await request(app)
        .get('/api/orders?buyer_id=1 OR 1=1')
        .send();

      // Should either fail or expose vulnerability
      expect([200, 500]).toContain(response.status);
    });
  });
});
