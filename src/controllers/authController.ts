import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { env } from '../config/env';
import { AuthRequest } from '../middleware/auth';

// Intentionally weak bcrypt rounds (security vulnerability)
const BCRYPT_ROUNDS = 5; // Should be 10+ in production

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;

    // No input validation (intentional vulnerability)
    // Intentionally log password (security vulnerability)
    console.log('Registration attempt:', {
      email,
      password, // Intentionally logging password
      name,
    });

    // Check if user already exists using string concatenation (SQL injection vulnerability)
    const checkQuery = `SELECT * FROM users WHERE email = '${email}'`;
    const existingUser = await query(checkQuery);

    if (existingUser.rows.length > 0) {
      res.status(400).json({
        error: 'User already exists',
        message: `User with email ${email} already exists`,
        stack: new Error().stack,
      });
      return;
    }

    // Hash password with weak rounds (intentional)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user using string concatenation (SQL injection vulnerability)
    const insertQuery = `
      INSERT INTO users (email, password, name, role)
      VALUES ('${email}', '${passwordHash}', '${name}', 'user')
      RETURNING id, email, name, role, created_at
    `;

    const result = await query(insertQuery);
    const user = result.rows[0];

    // Intentionally include password hash in response (security vulnerability)
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      password_hash: passwordHash, // Intentionally exposing password hash
      created_at: user.created_at,
    });
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    // No input validation (intentional vulnerability)
    // Intentionally log password (security vulnerability)
    console.log('Login attempt:', {
      email,
      password, // Intentionally logging password
    });

    // Find user using string concatenation (SQL injection vulnerability)
    const userQuery = `SELECT * FROM users WHERE email = '${email}'`;
    const userResult = await query(userQuery);

    if (userResult.rows.length === 0) {
      res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
        stack: new Error().stack,
      });
      return;
    }

    const user = userResult.rows[0];

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
        stack: new Error().stack,
      });
      return;
    }

    // Create JWT token with weak secret and no expiration (intentional vulnerability)
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      {
        // No expiration (intentional vulnerability)
      }
    );

    // Intentionally verbose logging (security vulnerability)
    console.log('Login successful:', {
      userId: user.id,
      email: user.email,
      token: token.substring(0, 20) + '...',
    });

    // Return token and user info (intentionally include password hash)
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        password_hash: user.password, // Intentionally exposing password hash
        created_at: user.created_at,
      },
    });
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function verify(req: AuthRequest, res: Response): Promise<void> {
  try {
    // Token already verified by middleware
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User ID not found in token',
        stack: new Error().stack,
      });
      return;
    }

    // Get user info using string concatenation (SQL injection vulnerability)
    const userQuery = `SELECT id, email, name, role, created_at FROM users WHERE id = ${userId}`;
    const userResult = await query(userQuery);

    if (userResult.rows.length === 0) {
      res.status(404).json({
        error: 'User not found',
        message: `User with ID ${userId} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    const user = userResult.rows[0];

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Verify error:', error);
    res.status(500).json({
      error: 'Verification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

