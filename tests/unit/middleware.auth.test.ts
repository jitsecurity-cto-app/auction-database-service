import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Response } from 'express';
import { verifyToken, optionalAuth, AuthRequest } from '../../src/middleware/auth';
import * as jwt from 'jsonwebtoken';

// Mock jwt
jest.mock('jsonwebtoken');

const mockJwtVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;

describe('Auth Middleware - Unit Tests', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      headers: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('verifyToken', () => {
    it('should verify token with weak secret and no expiration check (intentional vulnerability)', () => {
      mockRequest.headers = {
        authorization: 'Bearer valid_token',
      };

      mockJwtVerify.mockReturnValueOnce({
        userId: 1,
        email: 'test@example.com',
        role: 'user',
      } as any);

      verifyToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      // Verify JWT is verified with weak secret (no expiration check)
      expect(mockJwtVerify).toHaveBeenCalledWith(
        'valid_token',
        expect.any(String) // Weak secret
      );

      expect(mockRequest.userId).toBe(1);
      expect(mockRequest.userRole).toBe('user');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should accept token from body (intentional vulnerability)', () => {
      mockRequest.body = {
        token: 'token_from_body',
      };

      mockJwtVerify.mockReturnValueOnce({
        userId: 1,
        email: 'test@example.com',
        role: 'user',
      } as any);

      verifyToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      // Verify token can come from body (less secure)
      expect(mockJwtVerify).toHaveBeenCalledWith(
        'token_from_body',
        expect.any(String)
      );
    });

    it('should return verbose error with stack trace (intentional vulnerability)', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid_token',
      };

      mockJwtVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      verifyToken(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      // Verify verbose error response with stack trace
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid token',
          stack: expect.any(String), // Stack trace exposed (intentional vulnerability)
        })
      );
    });
  });

  describe('optionalAuth', () => {
    it('should not fail if no token provided', () => {
      optionalAuth(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should set user info if valid token provided', () => {
      mockRequest.headers = {
        authorization: 'Bearer valid_token',
      };

      mockJwtVerify.mockReturnValueOnce({
        userId: 1,
        email: 'test@example.com',
        role: 'user',
      } as any);

      optionalAuth(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(mockRequest.userId).toBe(1);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});

