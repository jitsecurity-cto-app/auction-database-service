import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';

// Mock stripe before importing controller
const mockPaymentIntentsCreate = jest.fn<any>();
const mockWebhooksConstructEvent = jest.fn<any>();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockPaymentIntentsCreate,
    },
    webhooks: {
      constructEvent: mockWebhooksConstructEvent,
    },
  }));
});

jest.mock('../../src/config/database');
jest.mock('../../src/config/env', () => ({
  env: {
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
  },
}));

import * as database from '../../src/config/database';
import { createPaymentIntent, handleWebhook } from '../../src/controllers/paymentController';
import { AuthRequest } from '../../src/middleware/auth';

const mockQuery = database.query as jest.MockedFunction<typeof database.query>;

describe('Payment Controller', () => {
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      sendStatus: jest.fn().mockReturnThis(),
    };
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent for a valid pending_payment order', async () => {
      const mockRequest = {
        userId: 1,
        body: { order_id: 1 },
      } as Partial<AuthRequest>;

      // Mock order lookup
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          buyer_id: 1,
          total_amount: 150.00,
          status: 'pending_payment',
          auction_id: 10,
          stripe_payment_intent_id: null,
        }],
      });

      // Mock update order with intent ID
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret_456',
      });

      await createPaymentIntent(mockRequest as AuthRequest, mockResponse);

      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith({
        amount: 15000, // cents
        currency: 'usd',
        metadata: { order_id: '1', auction_id: '10', buyer_id: '1' },
      });
      expect(mockResponse.json).toHaveBeenCalledWith({
        client_secret: 'pi_test_123_secret_456',
        payment_intent_id: 'pi_test_123',
      });
    });

    it('should reject if user is not the buyer', async () => {
      const mockRequest = {
        userId: 999,
        body: { order_id: 1 },
      } as Partial<AuthRequest>;

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          buyer_id: 1,
          total_amount: 150.00,
          status: 'pending_payment',
        }],
      });

      await createPaymentIntent(mockRequest as AuthRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should reject if order is not pending_payment', async () => {
      const mockRequest = {
        userId: 1,
        body: { order_id: 1 },
      } as Partial<AuthRequest>;

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          buyer_id: 1,
          total_amount: 150.00,
          status: 'paid',
        }],
      });

      await createPaymentIntent(mockRequest as AuthRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return existing intent if order already has one', async () => {
      const mockRequest = {
        userId: 1,
        body: { order_id: 1 },
      } as Partial<AuthRequest>;

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          buyer_id: 1,
          total_amount: 150.00,
          status: 'pending_payment',
          auction_id: 10,
          stripe_payment_intent_id: 'pi_existing_123',
        }],
      });

      // Mock no update needed
      mockPaymentIntentsCreate.mockResolvedValueOnce({
        id: 'pi_existing_123',
        client_secret: 'pi_existing_123_secret',
      });

      await createPaymentIntent(mockRequest as AuthRequest, mockResponse);

      // Should not create a new intent
      expect(mockPaymentIntentsCreate).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('should update order to paid on payment_intent.succeeded', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            metadata: { order_id: '1' },
          },
        },
      };

      mockWebhooksConstructEvent.mockReturnValueOnce(mockEvent);

      const mockRequest = {
        body: Buffer.from('raw-body'),
        headers: { 'stripe-signature': 'sig_test' },
      } as Partial<Request>;

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await handleWebhook(mockRequest as Request, mockResponse);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("payment_status = 'paid'")
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("status = 'paid'")
      );
      expect(mockResponse.json).toHaveBeenCalledWith({ received: true });
    });

    it('should update order on payment_intent.payment_failed', async () => {
      const mockEvent = {
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test_123',
            metadata: { order_id: '1' },
          },
        },
      };

      mockWebhooksConstructEvent.mockReturnValueOnce(mockEvent);

      const mockRequest = {
        body: Buffer.from('raw-body'),
        headers: { 'stripe-signature': 'sig_test' },
      } as Partial<Request>;

      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await handleWebhook(mockRequest as Request, mockResponse);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("payment_status = 'failed'")
      );
      expect(mockResponse.json).toHaveBeenCalledWith({ received: true });
    });
  });
});
