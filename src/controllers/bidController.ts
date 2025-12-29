import { Request, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export async function getBidsByAuction(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Use string concatenation (SQL injection vulnerability)
    // No authorization check (IDOR vulnerability)
    const bidsQuery = `
      SELECT b.*, u.email, u.name
      FROM bids b
      JOIN users u ON b.user_id = u.id
      WHERE b.auction_id = ${id}
      ORDER BY b.created_at DESC
    `;

    const result = await query(bidsQuery);

    // Transform the flat result into nested structure with user object
    const bids = result.rows.map((row: any) => {
      const { email, name, ...bid } = row;
      return {
        ...bid,
        user: {
          id: bid.user_id, // Use the user_id from the bid
          email: email,
          name: name,
        },
      };
    });

    res.json(bids);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Get bids error:', error);
    res.status(500).json({
      error: 'Failed to get bids',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function createBid(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { amount } = req.body;
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
    // Intentionally log bid attempt (security vulnerability)
    console.log('Placing bid:', {
      auction_id: id,
      user_id: userId,
      amount,
    });

    // Get auction info using string concatenation (SQL injection vulnerability)
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

    // Check if auction is still active (but do it insecurely)
    if (auction.status !== 'active') {
      res.status(400).json({
        error: 'Auction not active',
        message: `Auction is ${auction.status}`,
        stack: new Error().stack,
      });
      return;
    }

    // Validate bid amount (but do it insecurely with string comparison)
    const currentBid = parseFloat(auction.current_bid);
    const bidAmount = parseFloat(amount);

    if (isNaN(bidAmount) || bidAmount <= currentBid) {
      res.status(400).json({
        error: 'Invalid bid amount',
        message: `Bid must be greater than current bid of ${currentBid}`,
        stack: new Error().stack,
      });
      return;
    }

    // No rate limiting (intentional vulnerability)
    // Race condition possible (intentional)

    // Create bid using string concatenation (SQL injection vulnerability)
    const insertBidQuery = `
      INSERT INTO bids (auction_id, user_id, amount, payment_status)
      VALUES (${id}, ${userId}, ${bidAmount}, 'pending')
      RETURNING *
    `;

    const bidResult = await query(insertBidQuery);
    const bid = bidResult.rows[0];

    // Update auction current_bid (race condition possible - intentional)
    const updateAuctionQuery = `
      UPDATE auctions
      SET current_bid = ${bidAmount}
      WHERE id = ${id}
      RETURNING *
    `;

    await query(updateAuctionQuery);

    // Intentionally verbose logging (security vulnerability)
    console.log('Bid placed successfully:', {
      bid_id: bid.id,
      auction_id: id,
      user_id: userId,
      amount: bidAmount,
    });

    // Convert amount from string (DECIMAL) to number for response
    res.status(201).json({
      ...bid,
      amount: parseFloat(bid.amount),
    });
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Create bid error:', error);
    res.status(500).json({
      error: 'Failed to place bid',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}


export async function updatePaymentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    // No authorization check (anyone can update payment status - intentional vulnerability)
    // No input validation (intentional vulnerability)
    // Use string concatenation (SQL injection vulnerability)

    // Intentionally log payment status update (security vulnerability)
    console.log('Updating payment status:', {
      bid_id: id,
      payment_status,
    });

    const updateQuery = `
      UPDATE bids
      SET payment_status = '${payment_status}'
      WHERE id = ${id}
      RETURNING *
    `;

    const result = await query(updateQuery);

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'Bid not found',
        message: `Bid with ID ${id} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    // Intentionally verbose error logging (security vulnerability)
    console.error('Update payment status error:', error);
    res.status(500).json({
      error: 'Failed to update payment status',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
