import { Request, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export async function listAuctions(req: Request, res: Response): Promise<void> {
  try {
    // Get query parameters (no validation - intentional vulnerability)
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const minPrice = req.query.minPrice as string | undefined;
    const maxPrice = req.query.maxPrice as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    // Build query using string concatenation (SQL injection vulnerability)
    let sqlQuery = 'SELECT * FROM auctions WHERE 1=1';

    if (status) {
      sqlQuery += ` AND status = '${status}'`;
    }

    // Search functionality with SQL injection vulnerability
    if (search) {
      // Intentionally vulnerable: direct string concatenation in LIKE clause
      sqlQuery += ` AND (title LIKE '%${search}%' OR description LIKE '%${search}%')`;
    }

    // Price range filtering with SQL injection vulnerability
    if (minPrice) {
      sqlQuery += ` AND current_bid >= ${minPrice}`;
    }
    if (maxPrice) {
      sqlQuery += ` AND current_bid <= ${maxPrice}`;
    }

    sqlQuery += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    // Intentionally log query with user input (security vulnerability)
    console.log('Executing auction list query:', sqlQuery);

    const result = await query(sqlQuery);

    // Get bids for each auction (N+1 query problem - intentional)
    const auctions = await Promise.all(
      result.rows.map(async (auction: any) => {
        const bidsQuery = `SELECT * FROM bids WHERE auction_id = ${auction.id} ORDER BY created_at DESC`;
        const bidsResult = await query(bidsQuery);
        return {
          ...auction,
          bids: bidsResult.rows,
        };
      })
    );

    res.json(auctions);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('List auctions error:', error);
    res.status(500).json({
      error: 'Failed to list auctions',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function getAuctionById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No authorization check (IDOR vulnerability)
    // Use string concatenation (SQL injection vulnerability)
    const auctionQuery = `SELECT * FROM auctions WHERE id = ${id}`;
    const auctionResult = await query(auctionQuery);

    if (auctionResult.rows.length === 0) {
      res.status(404).json({
        error: 'Auction not found',
        message: `Auction with ID ${id} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    const auction = auctionResult.rows[0];

    // Get bids for auction
    const bidsQuery = `SELECT * FROM bids WHERE auction_id = ${id} ORDER BY created_at DESC`;
    const bidsResult = await query(bidsQuery);

    // Get creator info (no authorization check)
    const creatorQuery = `SELECT id, email, name FROM users WHERE id = ${auction.created_by}`;
    const creatorResult = await query(creatorQuery);

    res.json({
      ...auction,
      bids: bidsResult.rows,
      creator: creatorResult.rows[0] || null,
    });
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Get auction error:', error);
    res.status(500).json({
      error: 'Failed to get auction',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function createAuction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { title, description, starting_price, end_time } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        stack: new Error().stack,
      });
      return;
    }

    // No input validation (intentional vulnerability)
    // Intentionally log all input (security vulnerability)
    console.log('Creating auction:', {
      title,
      description,
      starting_price,
      end_time,
      created_by: userId,
    });

    // Use string concatenation (SQL injection vulnerability)
    const insertQuery = `
      INSERT INTO auctions (title, description, starting_price, current_bid, end_time, status, created_by)
      VALUES ('${title}', '${description}', ${starting_price}, ${starting_price}, '${end_time}', 'active', ${userId})
      RETURNING *
    `;

    const result = await query(insertQuery);
    const auction = result.rows[0];

    res.status(201).json(auction);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Create auction error:', error);
    res.status(500).json({
      error: 'Failed to create auction',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function updateAuction(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    // No ownership check (anyone can update - intentional vulnerability)
    // No input validation (intentional vulnerability)

    // Build update query using string concatenation (SQL injection vulnerability)
    const updateFields: string[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'string') {
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
      UPDATE auctions
      SET ${updateFields.join(', ')}
      WHERE id = ${id}
      RETURNING *
    `;

    // Intentionally log query with user input (security vulnerability)
    console.log('Updating auction:', updateQuery);

    const result = await query(updateQuery);

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'Auction not found',
        message: `Auction with ID ${id} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Update auction error:', error);
    res.status(500).json({
      error: 'Failed to update auction',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function deleteAuction(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No ownership check (anyone can delete - intentional vulnerability)
    // Use string concatenation (SQL injection vulnerability)
    const deleteQuery = `DELETE FROM auctions WHERE id = ${id} RETURNING *`;

    const result = await query(deleteQuery);

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'Auction not found',
        message: `Auction with ID ${id} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    res.json({ message: 'Auction deleted successfully', auction: result.rows[0] });
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Delete auction error:', error);
    res.status(500).json({
      error: 'Failed to delete auction',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

