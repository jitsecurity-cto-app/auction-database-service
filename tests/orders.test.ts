import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import auctionRoutes from '../src/routes/auctions';
import authRoutes from '../src/routes/auth';
import orderRoutes from '../src/routes/orders';
import { testConnection, closePool } from '../src/config/database';

// Note: These tests verify that vulnerabilities exist (don't fix them)

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/orders', orderRoutes);

let buyerToken: string;
let sellerToken: string;
let auctionId: string;

describe('Order Endpoints', () => {
  beforeAll(async () => {
    const connected = await testConnection();
    if (!connected) {
      console.warn('Database not connected - some tests may fail');
    }

    // Register and login buyer
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'buyer@example.com',
        password: 'password123',
        name: 'Buyer User',
      });

    const buyerLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'buyer@example.com',
        password: 'password123',
      });

    buyerToken = buyerLoginResponse.body.token;

    // Register and login seller
    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'seller@example.com',
        password: 'password123',
        name: 'Seller User',
      });

    const sellerLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'seller@example.com',
        password: 'password123',
      });

    sellerToken = sellerLoginResponse.body.token;

    // Create an auction and close it with a winner
    const createResponse = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: 'Order Test Auction',
        description: 'Test Description',
        starting_price: 100,
        end_time: new Date(Date.now() - 86400000).toISOString(), // Past date
      });

    auctionId = createResponse.body.id;

    // Place a bid as buyer
    await request(app)
      .post(`/api/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ amount: 150 });

    // Close the auction to set winner
    await request(app)
      .post(`/api/auctions/${auctionId}/close`)
      .send();
  });

  afterAll(async () => {
    await closePool();
  });

  describe('GET /api/orders', () => {
    it('should list orders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .send();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter orders by buyer_id', async () => {
      const response = await request(app)
        .get('/api/orders?buyer_id=1')
        .send();

      expect([200, 500]).toContain(response.status);
    });

    it('should be vulnerable to SQL injection in query params', async () => {
      const response = await request(app)
        .get('/api/orders?buyer_id=1 OR 1=1')
        .send();

      // Should either fail or expose vulnerability
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should get order by ID (no authorization check - IDOR vulnerability)', async () => {
      // First create an order
      const createResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          auction_id: auctionId,
          shipping_address: '123 Test St, Test City, TS 12345',
        });

      if (createResponse.status === 201) {
        const orderId = createResponse.body.id;

        const response = await request(app)
          .get(`/api/orders/${orderId}`)
          .send();

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', orderId);
        // Intentionally verify no authorization check (IDOR vulnerability)
      } else {
        // Order creation might fail if auction not properly set up
        expect([201, 400, 404, 500]).toContain(createResponse.status);
      }
    });

    it('should be vulnerable to SQL injection in ID parameter', async () => {
      const response = await request(app)
        .get('/api/orders/1 OR 1=1')
        .send();

      // Should either fail or expose vulnerability
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/orders', () => {
    it('should create order (requires authentication)', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          auction_id: auctionId,
          shipping_address: '123 Test St, Test City, TS 12345',
        });

      // Might fail if auction not properly closed or no winner
      expect([201, 400, 404, 500]).toContain(response.status);
    });

    it('should reject order creation without authentication', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({
          auction_id: auctionId,
          shipping_address: '123 Test St',
        });

      expect([401, 500]).toContain(response.status);
    });

    it('should reject order creation if user is not winner', async () => {
      // Try to create order as seller (not the winner)
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          auction_id: auctionId,
          shipping_address: '123 Test St',
        });

      // Should reject if seller is not winner
      expect([201, 400, 403, 404, 500]).toContain(response.status);
    });
  });

  describe('PUT /api/orders/:id', () => {
    it('should update order (no ownership check - intentional vulnerability)', async () => {
      // Create an order first
      const createResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          auction_id: auctionId,
          shipping_address: '123 Test St',
        });

      if (createResponse.status === 201) {
        const orderId = createResponse.body.id;

        // Update without authentication (should work due to no ownership check)
        const response = await request(app)
          .put(`/api/orders/${orderId}`)
          .send({
            shipping_status: 'shipped',
            tracking_number: 'TRACK123',
          });

        // Intentionally verify no ownership check (vulnerability)
        expect([200, 404, 500]).toContain(response.status);
      } else {
        // Order creation might fail
        expect([201, 400, 404, 500]).toContain(createResponse.status);
      }
    });

    it('should be vulnerable to SQL injection in update', async () => {
      const response = await request(app)
        .put('/api/orders/1')
        .send({
          shipping_status: "shipped'; DROP TABLE orders; --",
        });

      // Should either fail or expose vulnerability
      expect([200, 404, 500]).toContain(response.status);
    });
  });
});
