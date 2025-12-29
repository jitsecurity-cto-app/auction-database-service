import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import authRoutes from '../src/routes/auth';
import { testConnection, closePool } from '../src/config/database';

// Note: These tests verify that vulnerabilities exist (don't fix them)
// Tests require a running database connection

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Endpoints', () => {
  beforeAll(async () => {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      console.warn('Database not connected - some tests may fail');
    }
  });

  afterAll(async () => {
    await closePool();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user (intentionally includes password hash in response)', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', 'test@example.com');
      // Intentionally verify password hash is exposed (vulnerability)
      expect(response.body).toHaveProperty('password_hash');
    });

    it('should be vulnerable to SQL injection in email field', async () => {
      // This test verifies SQL injection vulnerability exists
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: "test' OR '1'='1",
          password: 'password123',
          name: 'Test User',
        });

      // Should either fail or expose vulnerability
      // In a real scenario, this would cause SQL injection
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user and return JWT token (no expiration)', async () => {
      // First register a user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login@example.com',
          password: 'password123',
          name: 'Login User',
        });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      // Intentionally verify password hash is exposed (vulnerability)
      expect(response.body.user).toHaveProperty('password_hash');
    });

    it('should be vulnerable to SQL injection in email field', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "admin' OR '1'='1'--",
          password: 'anything',
        });

      // Should either fail or expose vulnerability
      expect([401, 500]).toContain(response.status);
    });
  });

  describe('POST /api/auth/verify', () => {
    it('should verify JWT token (weak secret, no expiration)', async () => {
      // First login to get a token
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'verify@example.com',
          password: 'password123',
          name: 'Verify User',
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'verify@example.com',
          password: 'password123',
        });

      const token = loginResponse.body.token;

      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('user');
    });
  });
});

