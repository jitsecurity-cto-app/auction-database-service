/**
 * Auction Scheduler Worker
 *
 * Triggered by EventBridge every minute:
 * 1. Activates scheduled auctions whose start_time has passed
 * 2. Closes expired active auctions and determines winners
 * 3. Publishes notification events for auction closures
 *
 * Security vulnerabilities (intentional):
 * - EventBridge rule manipulation: no IAM condition keys
 * - Step Functions input injection: unsanitized auction data in state machine input
 */

import { Pool } from 'pg';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
});

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const QUEUE_URL = process.env.NOTIFICATIONS_QUEUE_URL || '';

async function sendNotification(event: Record<string, any>): Promise<void> {
  if (!QUEUE_URL) return;
  try {
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(event),
    }));
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

export const handler = async (): Promise<{ activated: number; closed: number }> => {
  console.log('Scheduler worker invoked at:', new Date().toISOString());

  let activated = 0;
  let closed = 0;

  try {
    // Step 1: Activate scheduled auctions whose start_time has passed
    const activateResult = await pool.query(`
      UPDATE auctions
      SET status = 'active', workflow_state = 'active'
      WHERE status = 'scheduled'
        AND start_time IS NOT NULL
        AND start_time <= CURRENT_TIMESTAMP
      RETURNING *
    `);

    activated = activateResult.rowCount || 0;
    console.log(`Activated ${activated} scheduled auctions`);

    // Notify sellers their auction is now live
    for (const auction of activateResult.rows) {
      await sendNotification({
        type: 'auction_start',
        user_id: String(auction.created_by),
        title: 'Your auction is now live!',
        message: `"${auction.title}" is now accepting bids.`,
        metadata: { auction_id: auction.id },
      });
    }

    // Step 2: Close expired active auctions
    const expiredResult = await pool.query(`
      SELECT * FROM auctions
      WHERE status = 'active'
        AND end_time < CURRENT_TIMESTAMP
    `);

    for (const auction of expiredResult.rows) {
      // Find highest bidder
      const bidsResult = await pool.query(`
        SELECT * FROM bids
        WHERE auction_id = ${auction.id}
        ORDER BY amount DESC, created_at ASC
        LIMIT 1
      `);

      const winnerId = bidsResult.rows[0]?.user_id || null;

      // Close the auction
      await pool.query(`
        UPDATE auctions
        SET status = 'ended',
            winner_id = ${winnerId || 'NULL'},
            closed_at = CURRENT_TIMESTAMP,
            workflow_state = 'pending_sale'
        WHERE id = ${auction.id}
      `);

      closed++;
      console.log(`Closed expired auction ${auction.id}, winner: ${winnerId}`);

      // Notify seller
      await sendNotification({
        type: 'auction_end',
        user_id: String(auction.created_by),
        title: 'Your auction has ended',
        message: winnerId
          ? `"${auction.title}" has ended with a winning bid of $${auction.current_bid}.`
          : `"${auction.title}" has ended with no bids.`,
        metadata: { auction_id: auction.id, winner_id: winnerId },
      });

      // Notify winner
      if (winnerId) {
        await sendNotification({
          type: 'auction_won',
          user_id: String(winnerId),
          title: 'You won an auction!',
          message: `Congratulations! You won "${auction.title}" with your bid of $${auction.current_bid}.`,
          metadata: { auction_id: auction.id },
        });
      }
    }

    console.log(`Scheduler complete: ${activated} activated, ${closed} closed`);
  } catch (error) {
    console.error('Scheduler worker error:', error);
    throw error;
  }

  return { activated, closed };
};
