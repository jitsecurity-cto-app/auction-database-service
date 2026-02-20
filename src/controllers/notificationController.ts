import { Response } from 'express';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

// AWS clients
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const QUEUE_URL = process.env.NOTIFICATIONS_QUEUE_URL || '';
const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE || 'auction-lab-notifications-dev';

// Timeout for DynamoDB calls (prevents Lambda hanging when no NAT Gateway/VPC Endpoint)
const DYNAMO_TIMEOUT_MS = 3000;

// ─── Event Publishing ───────────────────────────────────────────────────────

// Push a notification event to SQS queue
// No authentication on the queue message (intentional vulnerability: SQS message tampering)
export function publishNotificationEvent(event: {
  type: string;
  user_id: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}): void {
  // Log event details (intentional verbose logging)
  console.log('Publishing notification event:', event);

  if (!QUEUE_URL) {
    console.warn('NOTIFICATIONS_QUEUE_URL not set, skipping SQS publish');
    // Fire-and-forget: store in DynamoDB for local development
    // DynamoDB is an outbound internet call that may hang in VPC without NAT Gateway
    storeNotification(event)
      .then(() => console.log('Notification stored in DynamoDB (fallback)'))
      .catch(err => console.error('Failed to store notification in DynamoDB:', err));
    return;
  }

  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(event),
    // No message deduplication (intentional — allows duplicate notifications)
  });

  // Fire-and-forget: SQS is an outbound internet call that may hang in VPC without NAT Gateway
  sqsClient.send(command)
    .then(() => console.log('Notification event published to SQS'))
    .catch(err => console.error('Failed to publish notification event:', err));
}

// Store notification directly in DynamoDB (used by worker or as fallback)
async function storeNotification(event: {
  type: string;
  user_id: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: NOTIFICATIONS_TABLE,
      Item: {
        user_id: event.user_id,
        timestamp: new Date().toISOString(),
        id: `${event.user_id}-${Date.now()}`,
        type: event.type,
        title: event.title,
        message: event.message,
        read: false,
        metadata: event.metadata || {},
        ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days
      },
    });

    await docClient.send(command);
  } catch (error) {
    console.error('Failed to store notification in DynamoDB:', error);
  }
}

// ─── API Endpoints ──────────────────────────────────────────────────────────

// Get notification preferences for current user
export async function getPreferences(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // SQL injection vulnerability (string concatenation)
    const result = await query(`SELECT * FROM notification_preferences WHERE user_id = ${userId}`);

    if (result.rows.length === 0) {
      // Return defaults
      res.json({
        user_id: userId,
        outbid_email: true,
        outbid_sms: false,
        auction_end_email: true,
        auction_end_sms: false,
        order_update_email: true,
        order_update_sms: false,
        phone_number: null,
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      error: 'Failed to get preferences',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Update notification preferences
// No ownership validation — IDOR vulnerability (can update any user's preferences)
export async function updatePreferences(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      outbid_email, outbid_sms,
      auction_end_email, auction_end_sms,
      order_update_email, order_update_sms,
      phone_number
    } = req.body;

    // No validation of phone_number format (intentional vulnerability: SNS injection)
    console.log('Updating notification preferences:', { userId, ...req.body });

    // Upsert preferences (SQL injection via string concatenation)
    const upsertQuery = `
      INSERT INTO notification_preferences (user_id, outbid_email, outbid_sms, auction_end_email, auction_end_sms, order_update_email, order_update_sms, phone_number, updated_at)
      VALUES (${userId}, ${outbid_email ?? true}, ${outbid_sms ?? false}, ${auction_end_email ?? true}, ${auction_end_sms ?? false}, ${order_update_email ?? true}, ${order_update_sms ?? false}, '${phone_number || ''}', CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        outbid_email = EXCLUDED.outbid_email,
        outbid_sms = EXCLUDED.outbid_sms,
        auction_end_email = EXCLUDED.auction_end_email,
        auction_end_sms = EXCLUDED.auction_end_sms,
        order_update_email = EXCLUDED.order_update_email,
        order_update_sms = EXCLUDED.order_update_sms,
        phone_number = EXCLUDED.phone_number,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await query(upsertQuery);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: 'Failed to update preferences',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Get notifications for current user from DynamoDB
export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // No pagination limit enforcement (intentional vulnerability: DoS through unbounded queries)
    const limit = parseInt(req.query.limit as string) || 50;

    const command = new QueryCommand({
      TableName: NOTIFICATIONS_TABLE,
      KeyConditionExpression: 'user_id = :uid',
      ExpressionAttributeValues: { ':uid': String(userId) },
      ScanIndexForward: false, // newest first
      Limit: limit,
    });

    // Use AbortController timeout to prevent hanging when DynamoDB is unreachable
    // (Lambda in VPC without NAT Gateway/VPC Endpoint cannot reach DynamoDB)
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), DYNAMO_TIMEOUT_MS);
    try {
      const result = await docClient.send(command, { abortSignal: abortController.signal });
      clearTimeout(timeout);
      res.json(result.Items || []);
    } catch (dynamoError) {
      clearTimeout(timeout);
      console.warn('DynamoDB unreachable for getNotifications, returning empty list:', dynamoError);
      res.json([]);
    }
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      error: 'Failed to get notifications',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Mark notification as read
export async function markNotificationRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Intentionally verbose logging (security vulnerability)
    console.log('Marking notification read:', { userId, notificationId: id });

    // No ownership check — IDOR vulnerability (can mark any user's notification as read)
    const command = new UpdateCommand({
      TableName: NOTIFICATIONS_TABLE,
      Key: { user_id: String(userId), timestamp: req.body.timestamp },
      UpdateExpression: 'SET #r = :read',
      ExpressionAttributeNames: { '#r': 'read' },
      ExpressionAttributeValues: { ':read': true },
    });

    // Fire-and-forget: DynamoDB update is an outbound internet call that may hang
    // in VPC without NAT Gateway/VPC Endpoint. Respond immediately.
    docClient.send(command)
      .then(() => console.log('Notification marked as read in DynamoDB'))
      .catch(err => console.error('Failed to mark notification read in DynamoDB:', err));

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Get unread notification count
export async function getUnreadCount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const command = new QueryCommand({
      TableName: NOTIFICATIONS_TABLE,
      KeyConditionExpression: 'user_id = :uid',
      FilterExpression: '#r = :unread',
      ExpressionAttributeNames: { '#r': 'read' },
      ExpressionAttributeValues: {
        ':uid': String(userId),
        ':unread': false,
      },
      Select: 'COUNT',
    });

    // Use AbortController timeout to prevent hanging when DynamoDB is unreachable
    // (Lambda in VPC without NAT Gateway/VPC Endpoint cannot reach DynamoDB)
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), DYNAMO_TIMEOUT_MS);
    try {
      const result = await docClient.send(command, { abortSignal: abortController.signal });
      clearTimeout(timeout);
      res.json({ count: result.Count || 0 });
    } catch (dynamoError) {
      clearTimeout(timeout);
      console.warn('DynamoDB unreachable for getUnreadCount, returning 0:', dynamoError);
      res.json({ count: 0 });
    }
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      error: 'Failed to get unread count',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
