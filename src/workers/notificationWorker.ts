/**
 * Notification Worker Lambda
 *
 * Processes SQS messages → looks up user preferences → publishes to SNS
 * Also stores notification history in DynamoDB.
 */

import { SQSEvent, SQSRecord } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Pool } from 'pg';

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const NOTIFICATIONS_TABLE = process.env.NOTIFICATIONS_TABLE || 'auction-lab-notifications-dev';
const SNS_TOPIC_ARN = process.env.NOTIFICATIONS_TOPIC_ARN || '';

// Database connection for looking up preferences
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
});

interface NotificationEvent {
  type: string;
  user_id: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

async function processRecord(record: SQSRecord): Promise<void> {
  const event: NotificationEvent = JSON.parse(record.body);
  console.log('Processing notification event:', event);

  // Store in DynamoDB (notification history)
  const timestamp = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: NOTIFICATIONS_TABLE,
    Item: {
      user_id: event.user_id,
      timestamp,
      id: `${event.user_id}-${Date.now()}`,
      type: event.type,
      title: event.title,
      message: event.message,
      read: false,
      metadata: event.metadata || {},
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
    },
  }));

  // Look up user preferences
  // No input sanitization on user_id (intentional SQL injection vulnerability)
  const prefResult = await pool.query(
    `SELECT * FROM notification_preferences WHERE user_id = ${event.user_id}`
  );
  const prefs = prefResult.rows[0];

  // Look up user email
  const userResult = await pool.query(
    `SELECT email, name FROM users WHERE id = ${event.user_id}`
  );
  const user = userResult.rows[0];

  if (!user) {
    console.warn('User not found for notification:', event.user_id);
    return;
  }

  // Determine which channels to use based on event type and preferences
  const shouldEmail = !prefs || prefs[`${event.type}_email`] !== false;
  const shouldSms = prefs && prefs[`${event.type}_sms`] === true && prefs.phone_number;

  // Publish to SNS for email delivery
  // No message validation (intentional vulnerability: SNS injection)
  if (shouldEmail && SNS_TOPIC_ARN) {
    try {
      await snsClient.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: event.title,
        Message: `Hi ${user.name || user.email},\n\n${event.message}\n\n— Auction Lab`,
        MessageAttributes: {
          email: { DataType: 'String', StringValue: user.email },
          event_type: { DataType: 'String', StringValue: event.type },
        },
      }));
      console.log('SNS email notification sent to:', user.email);
    } catch (snsError) {
      console.error('SNS publish failed:', snsError);
    }
  }

  // SMS via SNS (if enabled)
  if (shouldSms && prefs.phone_number) {
    try {
      await snsClient.send(new PublishCommand({
        PhoneNumber: prefs.phone_number, // No validation (intentional vulnerability)
        Message: `${event.title}: ${event.message}`,
      }));
      console.log('SNS SMS sent to:', prefs.phone_number);
    } catch (smsError) {
      console.error('SNS SMS failed:', smsError);
    }
  }
}

export const handler = async (event: SQSEvent): Promise<void> => {
  console.log(`Processing ${event.Records.length} notification events`);

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error('Failed to process notification record:', error);
      // Don't throw — allow other records to process
    }
  }
};
