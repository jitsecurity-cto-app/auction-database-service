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

    // Get order if exists
    const orderQuery = `SELECT * FROM orders WHERE auction_id = ${id} LIMIT 1`;
    const orderResult = await query(orderQuery);
    const order = orderResult.rows[0] || null;

    res.json({
      ...auction,
      bids: bidsResult.rows,
      creator: creatorResult.rows[0] || null,
      order,
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
      INSERT INTO auctions (title, description, starting_price, current_bid, end_time, status, workflow_state, created_by)
      VALUES ('${title}', '${description}', ${starting_price}, ${starting_price}, '${end_time}', 'active', 'active', ${userId})
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


export async function closeAuction(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
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
    if (auction.status === 'ended') {
      res.json({
        message: 'Auction already closed',
        auction: auction,
      });
      return;
    }
    const bidsQuery = `SELECT * FROM bids WHERE auction_id = ${id} ORDER BY amount DESC, created_at DESC LIMIT 1`;
    const bidsResult = await query(bidsQuery);
    let winnerId = null;
    if (bidsResult.rows.length > 0) {
      winnerId = bidsResult.rows[0].user_id;
    }
      const updateQuery = `UPDATE auctions SET status = 'ended', winner_id = ${winnerId || 'NULL'}, closed_at = CURRENT_TIMESTAMP, workflow_state = 'pending_sale' WHERE id = ${id} RETURNING *`;
    const updateResult = await query(updateQuery);
    const updatedAuction = updateResult.rows[0];
    console.log('Auction closed:', { auction_id: id, winner_id: winnerId, final_bid: auction.current_bid });
    res.json({
      message: 'Auction closed successfully',
      auction: updatedAuction,
      winner_id: winnerId,
    });
  } catch (error) {
    console.error('Close auction error:', error);
    res.status(500).json({
      error: 'Failed to close auction',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function closeExpiredAuctions(_req: Request, res: Response): Promise<void> {
  try {
    const expiredQuery = `SELECT * FROM auctions WHERE status = 'active' AND end_time < CURRENT_TIMESTAMP`;
    const expiredResult = await query(expiredQuery);
    const closedAuctions = [];
    for (const auction of expiredResult.rows) {
      const bidsQuery = `SELECT * FROM bids WHERE auction_id = ${auction.id} ORDER BY amount DESC, created_at DESC LIMIT 1`;
      const bidsResult = await query(bidsQuery);
      let winnerId = null;
      if (bidsResult.rows.length > 0) {
        winnerId = bidsResult.rows[0].user_id;
      }
      // Set workflow_state to pending_sale when auction ends
      const updateQuery = `UPDATE auctions SET status = 'ended', winner_id = ${winnerId || 'NULL'}, closed_at = CURRENT_TIMESTAMP, workflow_state = 'pending_sale' WHERE id = ${auction.id} RETURNING *`;
      const updateResult = await query(updateQuery);
      closedAuctions.push(updateResult.rows[0]);
      console.log('Closed expired auction:', { auction_id: auction.id, winner_id: winnerId });
    }
    res.json({
      message: `Closed ${closedAuctions.length} expired auction(s)`,
      closed_count: closedAuctions.length,
      auctions: closedAuctions,
    });
  } catch (error) {
    console.error('Close expired auctions error:', error);
    res.status(500).json({
      error: 'Failed to close expired auctions',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Get auctions by workflow state for a user (as seller or buyer)
export async function getAuctionsByWorkflow(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    const workflowState = req.query.workflow_state as string | undefined;
    const role = req.query.role as 'seller' | 'buyer' | undefined; // 'seller' = created_by, 'buyer' = winner_id

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        stack: new Error().stack,
      });
      return;
    }

    // Build query based on role and workflow state
    let sqlQuery = 'SELECT * FROM auctions WHERE 1=1';

    if (role === 'seller') {
      sqlQuery += ` AND created_by = ${userId}`;
    } else if (role === 'buyer') {
      sqlQuery += ` AND winner_id = ${userId}`;
    } else {
      // Show both seller and buyer auctions
      sqlQuery += ` AND (created_by = ${userId} OR winner_id = ${userId})`;
    }

    if (workflowState) {
      // Check if workflow_state column exists, if not, filter by status instead
      // This handles cases where migration hasn't been run yet
      try {
        sqlQuery += ` AND workflow_state = '${workflowState}'`;
      } catch (err) {
        // Fallback: if workflow_state doesn't exist, map to status
        const statusMap: Record<string, string> = {
          'active': 'active',
          'pending_sale': 'ended',
          'shipping': 'ended',
          'complete': 'ended',
        };
        if (statusMap[workflowState]) {
          sqlQuery += ` AND status = '${statusMap[workflowState]}'`;
        }
      }
    }

    sqlQuery += ` ORDER BY created_at DESC`;

    console.log('Executing workflow query:', sqlQuery);
    let result;
    try {
      result = await query(sqlQuery);
    } catch (err: any) {
      // If workflow_state column doesn't exist, try without it
      if (err.message && err.message.includes('workflow_state')) {
        console.warn('workflow_state column not found, using status instead');
        sqlQuery = sqlQuery.replace(/AND workflow_state = '[^']+'/g, '');
        result = await query(sqlQuery);
      } else {
        throw err;
      }
    }

    // Get related data for each auction
    const auctions = await Promise.all(
      result.rows.map(async (auction: any) => {
        // Get order if exists
        const orderQuery = `SELECT * FROM orders WHERE auction_id = ${auction.id} LIMIT 1`;
        const orderResult = await query(orderQuery);
        const order = orderResult.rows[0] || null;

        // Get bids count
        const bidsQuery = `SELECT COUNT(*) as count FROM bids WHERE auction_id = ${auction.id}`;
        const bidsResult = await query(bidsQuery);

        // Ensure workflow_state exists (default to 'active' if not set)
        const workflowState = auction.workflow_state || (auction.status === 'active' ? 'active' : 'pending_sale');

        return {
          ...auction,
          workflow_state: workflowState,
          order,
          bid_count: parseInt(bidsResult.rows[0]?.count || '0', 10),
        };
      })
    );

    res.json(auctions);
  } catch (error) {
    console.error('Get auctions by workflow error:', error);
    res.status(500).json({
      error: 'Failed to get auctions by workflow',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Update workflow state of an auction
export async function updateWorkflowState(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { workflow_state } = req.body;
    const userId = (req as AuthRequest).userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        stack: new Error().stack,
      });
      return;
    }

    // Get auction to check ownership
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

    // No authorization check (intentional vulnerability - anyone can update)
    // Validate workflow_state transition
    const validStates = ['active', 'pending_sale', 'shipping', 'complete'];
    if (!workflow_state || !validStates.includes(workflow_state)) {
      res.status(400).json({
        error: 'Invalid workflow state',
        message: `Workflow state must be one of: ${validStates.join(', ')}`,
        stack: new Error().stack,
      });
      return;
    }

    // Update workflow state
    const updateQuery = `UPDATE auctions SET workflow_state = '${workflow_state}' WHERE id = ${id} RETURNING *`;
    const updateResult = await query(updateQuery);

    // If moving to shipping or complete, also update order status
    if (workflow_state === 'shipping' || workflow_state === 'complete') {
      const orderQuery = `SELECT * FROM orders WHERE auction_id = ${id} LIMIT 1`;
      const orderResult = await query(orderQuery);
      
      if (orderResult.rows.length > 0) {
        if (workflow_state === 'shipping') {
          await query(`UPDATE orders SET shipping_status = 'shipped', status = 'shipped' WHERE auction_id = ${id}`);
        } else if (workflow_state === 'complete') {
          await query(`UPDATE orders SET shipping_status = 'delivered', status = 'completed' WHERE auction_id = ${id}`);
        }
      }
    }

    res.json({
      message: 'Workflow state updated successfully',
      auction: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Update workflow state error:', error);
    res.status(500).json({
      error: 'Failed to update workflow state',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
