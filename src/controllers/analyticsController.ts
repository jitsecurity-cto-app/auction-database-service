import { Request, Response } from 'express';
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

const athenaClient = new AthenaClient({ region: process.env.AWS_REGION || 'us-east-1' });

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'auction_lab_analytics';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'auction-lab-athena-results-dev';

// ─── Direct RDS Analytics (real-time) ────────────────────────────────────────

// Revenue over time from RDS
export async function getRevenueOverTime(req: Request, res: Response): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 30;

    // SQL injection vulnerability via string concatenation
    const result = await query(`
      SELECT
        DATE(o.created_at) as date,
        SUM(o.total_amount) as revenue,
        COUNT(*) as order_count
      FROM orders o
      WHERE o.created_at >= CURRENT_DATE - INTERVAL '${days} days'
        AND o.status != 'cancelled'
      GROUP BY DATE(o.created_at)
      ORDER BY date ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({
      error: 'Failed to get revenue analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Bid activity over time
export async function getBidActivity(req: Request, res: Response): Promise<void> {
  try {
    const days = parseInt(req.query.days as string) || 30;

    const result = await query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as bid_count,
        SUM(amount) as total_volume,
        AVG(amount) as avg_bid
      FROM bids
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Bid activity error:', error);
    res.status(500).json({
      error: 'Failed to get bid activity',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Dashboard summary stats
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    // Multiple queries for stats (N+1 pattern — intentional)
    const [auctions, users, bids, orders, revenue] = await Promise.all([
      query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active FROM auctions"),
      query('SELECT COUNT(*) as total FROM users'),
      query('SELECT COUNT(*) as total FROM bids'),
      query("SELECT COUNT(*) as total FROM orders WHERE status != 'cancelled'"),
      query("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status != 'cancelled'"),
    ]);

    // Conversion rate: orders / ended auctions
    const endedResult = await query("SELECT COUNT(*) as total FROM auctions WHERE status = 'ended'");
    const endedCount = parseInt(endedResult.rows[0].total) || 1;
    const orderCount = parseInt(orders.rows[0].total) || 0;

    res.json({
      total_auctions: parseInt(auctions.rows[0].total),
      active_auctions: parseInt(auctions.rows[0].active),
      total_users: parseInt(users.rows[0].total),
      total_bids: parseInt(bids.rows[0].total),
      total_orders: orderCount,
      total_revenue: parseFloat(revenue.rows[0].total),
      conversion_rate: Math.round((orderCount / endedCount) * 100),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      error: 'Failed to get dashboard stats',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Top auctions by bid activity
export async function getTopAuctions(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await query(`
      SELECT
        a.id,
        a.title,
        a.current_bid as final_price,
        a.status,
        COUNT(b.id) as total_bids,
        MAX(b.amount) as highest_bid
      FROM auctions a
      LEFT JOIN bids b ON a.id = b.auction_id
      GROUP BY a.id, a.title, a.current_bid, a.status
      ORDER BY total_bids DESC
      LIMIT ${limit}
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Top auctions error:', error);
    res.status(500).json({
      error: 'Failed to get top auctions',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// ─── Athena Analytics (ad-hoc SQL on data lake) ──────────────────────────────

// Execute ad-hoc SQL via Athena (intentional SQL injection vulnerability)
export async function executeAthenaQuery(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { sql } = req.body;

    if (!sql) {
      res.status(400).json({ error: 'SQL query required' });
      return;
    }

    // No SQL validation or sanitization (intentional Athena SQL injection vulnerability)
    console.log('Executing Athena query:', sql);

    const startCommand = new StartQueryExecutionCommand({
      QueryString: sql,
      QueryExecutionContext: { Database: ATHENA_DATABASE },
      ResultConfiguration: {
        OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/query-results/`,
      },
    });

    const startResult = await athenaClient.send(startCommand);
    const queryExecutionId = startResult.QueryExecutionId;

    // Poll for completion (simple approach for lab)
    let status = 'RUNNING';
    let attempts = 0;
    while (status === 'RUNNING' || status === 'QUEUED') {
      if (attempts++ > 60) {
        res.status(408).json({ error: 'Query timed out' });
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      const getCommand = new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId });
      const getResult = await athenaClient.send(getCommand);
      status = getResult.QueryExecution?.Status?.State || 'FAILED';

      if (status === 'FAILED') {
        res.status(400).json({
          error: 'Query failed',
          message: getResult.QueryExecution?.Status?.StateChangeReason,
        });
        return;
      }
    }

    // Get results
    const resultsCommand = new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
      MaxResults: 1000, // No pagination limit enforcement (intentional DoS vulnerability)
    });

    const results = await athenaClient.send(resultsCommand);
    const rows = results.ResultSet?.Rows || [];

    // Transform to JSON-friendly format
    if (rows.length === 0) {
      res.json({ columns: [], rows: [] });
      return;
    }

    const columns = rows[0].Data?.map(d => d.VarCharValue || '') || [];
    const dataRows = rows.slice(1).map(row =>
      row.Data?.map(d => d.VarCharValue || '') || []
    );

    res.json({ columns, rows: dataRows });
  } catch (error) {
    console.error('Athena query error:', error);
    res.status(500).json({
      error: 'Failed to execute Athena query',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
