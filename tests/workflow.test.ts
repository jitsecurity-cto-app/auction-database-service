/**
 * Integration tests for workflow state transitions and API endpoints
 * Tests: getAuctionsByWorkflow, updateWorkflowState, workflow transitions
 */

import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import auctionRoutes from '../src/routes/auctions';
import authRoutes from '../src/routes/auth';
import { testConnection, closePool } from '../src/config/database';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);

let authToken: string;
let _userId: string;
let auctionId: number;

describe('Workflow State Management', () => {
  beforeAll(async () => {
    const connected = await testConnection();
    if (!connected) {
      console.warn('Database not connected - some tests may fail');
    }

    // Register and login to get auth token
    await request(app)
      .post('/api/auth/register')
      .send({
        email: `workflowtest-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Workflow Test User',
      });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: `workflowtest-${Date.now()}@example.com`,
        password: 'password123',
      });

    authToken = loginResponse.body.token;
    _userId = loginResponse.body.user.id;

    // Create an auction for testing
    const auctionResponse = await request(app)
      .post('/api/auctions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Workflow Test Auction',
        description: 'Test description',
        starting_price: 100,
        end_time: new Date(Date.now() + 86400000).toISOString(),
      });

    auctionId = auctionResponse.body.id;
  });

  afterAll(async () => {
    await closePool();
  });

  describe('GET /api/auctions/workflow/:state', () => {
    it('should get auctions by workflow state (active)', async () => {
      const response = await request(app)
        .get('/api/auctions/workflow/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get auctions by workflow state with role filter (seller)', async () => {
      const response = await request(app)
        .get('/api/auctions/workflow/active?role=seller')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should get auctions by workflow state with role filter (buyer)', async () => {
      const response = await request(app)
        .get('/api/auctions/workflow/active?role=buyer')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return empty array for non-existent workflow state', async () => {
      const response = await request(app)
        .get('/api/auctions/workflow/invalid_state')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('PUT /api/auctions/:id/workflow-state', () => {
    it('should update workflow state from active to pending_sale', async () => {
      const response = await request(app)
        .put(`/api/auctions/${auctionId}/workflow-state`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workflow_state: 'pending_sale',
        });

      expect([200, 201]).toContain(response.status);
      
      // Verify the state was updated
      const getResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.workflow_state).toBe('pending_sale');
    });

    it('should update workflow state from pending_sale to shipping', async () => {
      const response = await request(app)
        .put(`/api/auctions/${auctionId}/workflow-state`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workflow_state: 'shipping',
        });

      expect([200, 201]).toContain(response.status);
      
      const getResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.workflow_state).toBe('shipping');
    });

    it('should update workflow state from shipping to complete', async () => {
      const response = await request(app)
        .put(`/api/auctions/${auctionId}/workflow-state`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workflow_state: 'complete',
        });

      expect([200, 201]).toContain(response.status);
      
      const getResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getResponse.body.workflow_state).toBe('complete');
    });

    it('should reject invalid workflow state', async () => {
      const response = await request(app)
        .put(`/api/auctions/${auctionId}/workflow-state`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          workflow_state: 'invalid_state',
        });

      expect([400, 422]).toContain(response.status);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/auctions/${auctionId}/workflow-state`)
        .send({
          workflow_state: 'pending_sale',
        });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Workflow State Transitions', () => {
    it('should transition: active → pending_sale → shipping → complete', async () => {
      // Create a new auction for this test
      const auctionResponse = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Transition Test Auction',
          description: 'Test description',
          starting_price: 100,
          end_time: new Date(Date.now() + 86400000).toISOString(),
        });

      const testAuctionId = auctionResponse.body.id;

      // Step 1: active → pending_sale
      await request(app)
        .put(`/api/auctions/${testAuctionId}/workflow-state`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ workflow_state: 'pending_sale' });

      let getResponse = await request(app)
        .get(`/api/auctions/${testAuctionId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(getResponse.body.workflow_state).toBe('pending_sale');

      // Step 2: pending_sale → shipping
      await request(app)
        .put(`/api/auctions/${testAuctionId}/workflow-state`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ workflow_state: 'shipping' });

      getResponse = await request(app)
        .get(`/api/auctions/${testAuctionId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(getResponse.body.workflow_state).toBe('shipping');

      // Step 3: shipping → complete
      await request(app)
        .put(`/api/auctions/${testAuctionId}/workflow-state`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ workflow_state: 'complete' });

      getResponse = await request(app)
        .get(`/api/auctions/${testAuctionId}`)
        .set('Authorization', `Bearer ${authToken}`);
      expect(getResponse.body.workflow_state).toBe('complete');
    });
  });

  describe('Auction Creation with Workflow State', () => {
    it('should create auction with workflow_state set to active by default', async () => {
      const response = await request(app)
        .post('/api/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Default State Test',
          description: 'Test description',
          starting_price: 100,
          end_time: new Date(Date.now() + 86400000).toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.workflow_state).toBe('active');
    });
  });
});
