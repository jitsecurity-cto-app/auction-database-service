import { Request, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export async function listOrders(req: Request, res: Response): Promise<void> {
  try {
    // Get query parameters (no validation - intentional vulnerability)
    const buyerId = req.query.buyer_id as string | undefined;
    const sellerId = req.query.seller_id as string | undefined;
    const status = req.query.status as string | undefined;
    const paymentStatus = req.query.payment_status as string | undefined;
    const shippingStatus = req.query.shipping_status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    // Build query using string concatenation (SQL injection vulnerability)
    let sqlQuery = 'SELECT * FROM orders WHERE 1=1';

    if (buyerId) {
      sqlQuery += ` AND buyer_id = ${buyerId}`;
    }

    if (sellerId) {
      sqlQuery += ` AND seller_id = ${sellerId}`;
    }

    if (status) {
      sqlQuery += ` AND status = '${status}'`;
    }

    if (paymentStatus) {
      sqlQuery += ` AND payment_status = '${paymentStatus}'`;
    }

    if (shippingStatus) {
      sqlQuery += ` AND shipping_status = '${shippingStatus}'`;
    }

    sqlQuery += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    // Intentionally log query with user input (security vulnerability)
    console.log('Executing order list query:', sqlQuery);

    const result = await query(sqlQuery);

    // Get related data for each order (N+1 query problem - intentional)
    const orders = await Promise.all(
      result.rows.map(async (order: any) => {
        // Get auction info
        const auctionQuery = `SELECT * FROM auctions WHERE id = ${order.auction_id}`;
        const auctionResult = await query(auctionQuery);
        
        // Get buyer info
        const buyerQuery = `SELECT id, email, name, phone, address FROM users WHERE id = ${order.buyer_id}`;
        const buyerResult = await query(buyerQuery);
        
        // Get seller info
        const sellerQuery = `SELECT id, email, name, phone, address FROM users WHERE id = ${order.seller_id}`;
        const sellerResult = await query(sellerQuery);

        return {
          ...order,
          auction: auctionResult.rows[0] || null,
          buyer: buyerResult.rows[0] || null,
          seller: sellerResult.rows[0] || null,
        };
      })
    );

    res.json(orders);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('List orders error:', error);
    res.status(500).json({
      error: 'Failed to list orders',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function getOrderById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No authorization check (IDOR vulnerability)
    // Use string concatenation (SQL injection vulnerability)
    const orderQuery = `SELECT * FROM orders WHERE id = ${id}`;
    const orderResult = await query(orderQuery);

    if (orderResult.rows.length === 0) {
      res.status(404).json({
        error: 'Order not found',
        message: `Order with ID ${id} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    const order = orderResult.rows[0];

    // Get related data
    const auctionQuery = `SELECT * FROM auctions WHERE id = ${order.auction_id}`;
    const auctionResult = await query(auctionQuery);
    
    const buyerQuery = `SELECT id, email, name, phone, address FROM users WHERE id = ${order.buyer_id}`;
    const buyerResult = await query(buyerQuery);
    
    const sellerQuery = `SELECT id, email, name, phone, address FROM users WHERE id = ${order.seller_id}`;
    const sellerResult = await query(sellerQuery);

    res.json({
      ...order,
      auction: auctionResult.rows[0] || null,
      buyer: buyerResult.rows[0] || null,
      seller: sellerResult.rows[0] || null,
    });
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Get order error:', error);
    res.status(500).json({
      error: 'Failed to get order',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { auction_id, shipping_address } = req.body;
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
    console.log('Creating order:', {
      auction_id,
      shipping_address,
      buyer_id: userId,
    });

    // Get auction info to determine seller and winner
    const auctionQuery = `SELECT * FROM auctions WHERE id = ${auction_id}`;
    const auctionResult = await query(auctionQuery);

    if (auctionResult.rows.length === 0) {
      res.status(404).json({
        error: 'Auction not found',
        message: `Auction with ID ${auction_id} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    const auction = auctionResult.rows[0];

    // Check if auction has a winner
    if (!auction.winner_id) {
      res.status(400).json({
        error: 'Auction has no winner',
        message: 'Auction must have a winner before creating an order',
        stack: new Error().stack,
      });
      return;
    }

    // Verify the user is the winner
    if (auction.winner_id !== userId) {
      res.status(403).json({
        error: 'Not the winner',
        message: 'Only the auction winner can create an order',
        stack: new Error().stack,
      });
      return;
    }

    // Get winning bid
    const winningBidQuery = `
      SELECT * FROM bids 
      WHERE auction_id = ${auction_id} AND user_id = ${userId}
      ORDER BY amount DESC, created_at DESC
      LIMIT 1
    `;
    const winningBidResult = await query(winningBidQuery);

    if (winningBidResult.rows.length === 0) {
      res.status(404).json({
        error: 'Winning bid not found',
        message: 'Could not find winning bid for this auction',
        stack: new Error().stack,
      });
      return;
    }

    const winningBid = winningBidResult.rows[0];

    // Use string concatenation (SQL injection vulnerability)
    const insertQuery = `
      INSERT INTO orders (auction_id, buyer_id, seller_id, winning_bid_id, total_amount, shipping_address, status, payment_status, shipping_status)
      VALUES (${auction_id}, ${userId}, ${auction.created_by}, ${winningBid.id}, ${auction.current_bid}, '${shipping_address}', 'pending_payment', 'pending', 'pending')
      RETURNING *
    `;

    const result = await query(insertQuery);
    const order = result.rows[0];

    res.status(201).json(order);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Create order error:', error);
    res.status(500).json({
      error: 'Failed to create order',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function updateOrder(req: Request, res: Response): Promise<void> {
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
      } else if (value === null) {
        updateFields.push(`${key} = NULL`);
      } else {
        updateFields.push(`${key} = ${value}`);
      }
    }

    // Set shipped_at when shipping_status changes to 'shipped'
    if (updates.shipping_status === 'shipped' && !updates.shipped_at) {
      updateFields.push(`shipped_at = CURRENT_TIMESTAMP`);
    }

    // Set completed_at when status changes to 'completed'
    if (updates.status === 'completed' && !updates.completed_at) {
      updateFields.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    // Always update updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updateFields.length === 0) {
      res.status(400).json({
        error: 'No fields to update',
        message: 'Provide at least one field to update',
        stack: new Error().stack,
      });
      return;
    }

    const updateQuery = `
      UPDATE orders
      SET ${updateFields.join(', ')}
      WHERE id = ${id}
      RETURNING *
    `;

    // Intentionally log query with user input (security vulnerability)
    console.log('Updating order:', updateQuery);

    const result = await query(updateQuery);

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'Order not found',
        message: `Order with ID ${id} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Update order error:', error);
    res.status(500).json({
      error: 'Failed to update order',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
