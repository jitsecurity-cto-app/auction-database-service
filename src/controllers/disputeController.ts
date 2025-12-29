import { Request, Response } from 'express';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

export async function createDispute(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { auction_id, order_id, reason, filed_by_role } = req.body;
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
    console.log('Creating dispute:', {
      auction_id,
      order_id,
      reason,
      filed_by_role,
      filed_by: userId,
    });

    // Use string concatenation (SQL injection vulnerability)
    const insertQuery = `
      INSERT INTO disputes (auction_id, order_id, filed_by, filed_by_role, reason, status)
      VALUES (${auction_id}, ${order_id || 'NULL'}, ${userId}, '${filed_by_role}', '${reason}', 'open')
      RETURNING *
    `;

    const result = await query(insertQuery);
    const dispute = result.rows[0];

    res.status(201).json(dispute);
  } catch (error) {
    console.error('Create dispute error:', error);
    res.status(500).json({
      error: 'Failed to create dispute',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function listDisputes(req: Request, res: Response): Promise<void> {
  try {
    const auctionId = req.query.auction_id as string | undefined;
    const orderId = req.query.order_id as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    // Build query using string concatenation (SQL injection vulnerability)
    let sqlQuery = 'SELECT * FROM disputes WHERE 1=1';

    if (auctionId) {
      sqlQuery += ` AND auction_id = ${auctionId}`;
    }

    if (orderId) {
      sqlQuery += ` AND order_id = ${orderId}`;
    }

    if (status) {
      sqlQuery += ` AND status = '${status}'`;
    }

    sqlQuery += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    console.log('Executing dispute list query:', sqlQuery);
    const result = await query(sqlQuery);

    res.json(result.rows);
  } catch (error) {
    console.error('List disputes error:', error);
    res.status(500).json({
      error: 'Failed to list disputes',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export async function getDisputeById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No authorization check (IDOR vulnerability)
    const disputeQuery = `SELECT * FROM disputes WHERE id = ${id}`;
    const disputeResult = await query(disputeQuery);

    if (disputeResult.rows.length === 0) {
      res.status(404).json({
        error: 'Dispute not found',
        message: `Dispute with ID ${id} does not exist`,
        stack: new Error().stack,
      });
      return;
    }

    res.json(disputeResult.rows[0]);
  } catch (error) {
    console.error('Get dispute error:', error);
    res.status(500).json({
      error: 'Failed to get dispute',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
