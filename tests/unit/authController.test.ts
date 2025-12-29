import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { register, login, verify } from '../../src/controllers/authController';
import * as database from '../../src/config/database';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockQuery = database.query as jest.MockedFunction<typeof database.query>;
const mockBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
const mockBcryptCompare = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;
const mockJwtSign = jwt.sign as jest.MockedFunction<typeof jwt.sign>;

describe('Auth Controller - Unit Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('register', () => {
    it('should register a new user and return password hash (intentional vulnerability)', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      // Mock database query - user doesn't exist
      mockQuery.mockResolvedValueOnce({ rows: [] });
      
      // Mock database insert - return new user
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          created_at: new Date(),
        }],
      });

      // Mock bcrypt hash
      (mockBcryptHash as jest.MockedFunction<typeof bcrypt.hash>).mockResolvedValueOnce('hashed_password_123' as never);

      await register(mockRequest as Request, mockResponse as Response);

      // Verify SQL injection vulnerability exists (string concatenation)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM users WHERE email = 'test@example.com'")
      );

      // Verify password hash is returned (intentional vulnerability)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          password_hash: 'hashed_password_123',
        })
      );
    });

    it('should be vulnerable to SQL injection in email field', async () => {
      mockRequest.body = {
        email: "test' OR '1'='1",
        password: 'password123',
        name: 'Test User',
      };

      // Mock database query with SQL injection
      mockQuery.mockRejectedValueOnce(new Error('SQL syntax error'));

      await register(mockRequest as Request, mockResponse as Response);

      // Verify SQL injection vulnerability (no parameterization)
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM users WHERE email = 'test' OR '1'='1'")
      );
    });
  });

  describe('login', () => {
    it('should login user and return JWT token with no expiration (intentional vulnerability)', async () => {
      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Mock database query - user exists
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          password: 'hashed_password_123',
          name: 'Test User',
          role: 'user',
          created_at: new Date(),
        }],
      });

      // Mock bcrypt compare
      (mockBcryptCompare as jest.MockedFunction<typeof bcrypt.compare>).mockResolvedValueOnce(true as never);

      // Mock JWT sign (no expiration - intentional vulnerability)
      (mockJwtSign as jest.Mock).mockReturnValueOnce('mock_jwt_token');

      await login(mockRequest as Request, mockResponse as Response);

      // Verify JWT is created without expiration
      expect(mockJwtSign as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          email: 'test@example.com',
          role: 'user',
        }),
        expect.any(String),
        {} // No expiration options (intentional vulnerability)
      );

      // Verify password hash is returned (intentional vulnerability)
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'mock_jwt_token',
          user: expect.objectContaining({
            password_hash: 'hashed_password_123',
          }),
        })
      );
    });

    it('should log password in console (intentional vulnerability)', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      mockRequest.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await login(mockRequest as Request, mockResponse as Response);

      // Verify password is logged (intentional vulnerability)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Login attempt'),
        expect.objectContaining({
          password: 'password123',
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('verify', () => {
    it('should verify token and return user info', async () => {
      mockRequest = {
        body: {},
      };
      (mockRequest as any).userId = 1;

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          role: 'user',
          created_at: new Date(),
        }],
      });

      await verify(mockRequest as any, mockResponse as Response);

      // Verify SQL injection vulnerability exists
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, email, name, role, created_at FROM users WHERE id = 1')
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          user: expect.any(Object),
        })
      );
    });
  });
});

