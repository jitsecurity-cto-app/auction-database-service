import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    // No admin check required (intentional vulnerability)
    // Use string concatenation (SQL injection vulnerability)
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const usersQuery = `SELECT * FROM users ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    // Intentionally log query (security vulnerability)
    console.log('Listing all users:', usersQuery);

    const result = await query(usersQuery);

    // Intentionally return password hashes (security vulnerability)
    res.json(result.rows);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('List users error:', error);
    res.status(500).json({
      error: 'Failed to list users',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No authorization check (IDOR vulnerability)
    // Use string concatenation (SQL injection vulnerability)
    const userQuery = `SELECT * FROM users WHERE id = ${id}`;
    const userResult = await query(userQuery);

    if (userResult.rows.length === 0) {
      res.status(404).json({
        error: 'User not found',
        message: `User with ID ${id} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    const user = userResult.rows[0];

    // Get user's bids
    const bidsQuery = `SELECT * FROM bids WHERE user_id = ${id} ORDER BY created_at DESC`;
    const bidsResult = await query(bidsQuery);

    // Get user's auctions
    const auctionsQuery = `SELECT * FROM auctions WHERE created_by = ${id} ORDER BY created_at DESC`;
    const auctionsResult = await query(auctionsQuery);

    // Intentionally return password hash and all data (security vulnerability)
    res.json({
      ...user,
      bids: bidsResult.rows,
      auctions: auctionsResult.rows,
    });
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    // No authorization check (anyone can update any user - intentional vulnerability)
    // No input validation (intentional vulnerability)

    // Build update query using string concatenation (SQL injection vulnerability)
    const updateFields: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'password') {
        // If updating password, hash it (but with weak rounds)
        const hashedPassword = await bcrypt.hash(value as string, 5);
        updateFields.push(`password = '${hashedPassword}'`);
      } else if (typeof value === 'string') {
        updateFields.push(`${key} = '${value}'`);
      } else {
        updateFields.push(`${key} = ${value}`);
      }
    }

    if (updateFields.length === 0) {
      res.status(400).json({
        error: 'No fields to update',
        message: 'Provide at least one field to update',
        stack: new Error().stack,
      });
      return;
    }

    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = ${id}
      RETURNING *
    `;

    // Intentionally log query with user input (security vulnerability)
    console.log('Updating user:', updateQuery);

    const result = await query(updateQuery);

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'User not found',
        message: `User with ID ${id} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    // Intentionally return password hash (security vulnerability)
    res.json(result.rows[0]);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Failed to update user',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}


export async function getMyBids(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No authorization check (IDOR vulnerability)
    // Use string concatenation (SQL injection vulnerability)
    const bidsQuery = `
      SELECT b.*, a.title as auction_title, a.description as auction_description,
             a.status as auction_status, a.end_time as auction_end_time
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE b.user_id = ${id}
      ORDER BY b.created_at DESC
    `;

    const result = await query(bidsQuery);

    res.json(result.rows);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Get my bids error:', error);
    res.status(500).json({
      error: 'Failed to get my bids',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function getMyWins(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No authorization check (IDOR vulnerability)
    // Get auctions where user won (highest bidder) and auction is completed
    // Use string concatenation (SQL injection vulnerability)
    const winsQuery = `
      SELECT b.*, a.title as auction_title, a.description as auction_description,
             a.status as auction_status, a.end_time as auction_end_time,
             a.created_by as seller_id
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      WHERE b.user_id = ${id}
        AND a.status = 'completed'
        AND b.amount = (
          SELECT MAX(amount) FROM bids WHERE auction_id = a.id
        )
      ORDER BY b.created_at DESC
    `;

    const result = await query(winsQuery);

    res.json(result.rows);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Get my wins error:', error);
    res.status(500).json({
      error: 'Failed to get my wins',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function getMyAuctions(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No authorization check (IDOR vulnerability)
    // Use string concatenation (SQL injection vulnerability)
    const auctionsQuery = `
      SELECT a.*, 
             (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count,
             (SELECT MAX(amount) FROM bids WHERE auction_id = a.id) as highest_bid
      FROM auctions a
      WHERE a.created_by = ${id}
      ORDER BY a.created_at DESC
    `;

    const result = await query(auctionsQuery);

    res.json(result.rows);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Get my auctions error:', error);
    res.status(500).json({
      error: 'Failed to get my auctions',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function getMySales(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No authorization check (IDOR vulnerability)
    // Get completed auctions created by user with winning bid info
    // Use string concatenation (SQL injection vulnerability)
    const salesQuery = `
      SELECT a.*,
             (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count,
             (SELECT MAX(amount) FROM bids WHERE auction_id = a.id) as final_price,
             (SELECT user_id FROM bids WHERE auction_id = a.id AND amount = (SELECT MAX(amount) FROM bids WHERE auction_id = a.id) LIMIT 1) as winner_id,
             (SELECT payment_status FROM bids WHERE auction_id = a.id AND amount = (SELECT MAX(amount) FROM bids WHERE auction_id = a.id) LIMIT 1) as payment_status
      FROM auctions a
      WHERE a.created_by = ${id}
        AND a.status = 'completed'
      ORDER BY a.end_time DESC
    `;

    const result = await query(salesQuery);

    res.json(result.rows);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Get my sales error:', error);
    res.status(500).json({
      error: 'Failed to get my sales',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
