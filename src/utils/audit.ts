/**
 * Audit Trail Utility
 *
 * Logs every mutation with actor, timestamp, old/new values to DynamoDB.
 * Thin wrapper called from every controller mutation.
 *
 * Security vulnerabilities (intentional):
 * - Log injection: actor-controlled values written directly to audit log
 * - Audit bypass: no server-side enforcement that audit is called
 * - DoS: unbounded query support on audit endpoints
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Request } from 'express';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const AUDIT_TABLE = process.env.AUDIT_TABLE || 'auction-lab-audit-dev';

export interface AuditEvent {
  entity_type: string;  // 'auction', 'bid', 'order', 'user', 'dispute'
  entity_id: string;
  action: string;       // 'create', 'update', 'delete', 'close', 'resolve'
  actor_id: string;
  actor_email?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event to DynamoDB.
 * Fire-and-forget: never blocks the parent operation.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const timestamp = new Date().toISOString();

    // Log injection vulnerability: values written without sanitization
    console.log('Audit event:', event);

    const command = new PutCommand({
      TableName: AUDIT_TABLE,
      Item: {
        // Partition key: entity_type#entity_id
        pk: `${event.entity_type}#${event.entity_id}`,
        // Sort key: timestamp
        sk: timestamp,
        // GSI key: actor_id
        actor_id: event.actor_id,
        // Data
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        action: event.action,
        actor_email: event.actor_email || 'unknown',
        old_values: event.old_values || {},
        new_values: event.new_values || {},
        ip_address: event.ip_address || 'unknown',
        user_agent: event.user_agent || 'unknown',
        metadata: event.metadata || {},
        timestamp,
        ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
      },
    });

    await docClient.send(command);
  } catch (error) {
    // Never fail the parent operation
    console.error('Audit log failed:', error);
  }
}

/**
 * Helper to extract audit context from an Express request.
 */
export function getAuditContext(req: Request): { actor_id: string; actor_email?: string; ip_address: string; user_agent: string } {
  const authReq = req as any;
  return {
    actor_id: authReq.userId ? String(authReq.userId) : 'anonymous',
    actor_email: authReq.userEmail,
    // No IP validation (intentional: SSRF/spoofing via X-Forwarded-For)
    ip_address: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
  };
}

/**
 * Query audit events for an entity.
 */
export async function queryAuditEvents(entityType: string, entityId: string, limit = 50): Promise<any[]> {
  try {
    const command = new QueryCommand({
      TableName: AUDIT_TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `${entityType}#${entityId}`,
      },
      ScanIndexForward: false, // newest first
      Limit: limit, // No enforcement of max limit (intentional DoS vulnerability)
    });

    const result = await docClient.send(command);
    return result.Items || [];
  } catch (error) {
    console.error('Audit query failed:', error);
    return [];
  }
}

/**
 * Query audit events by actor.
 */
export async function queryAuditByActor(actorId: string, limit = 50): Promise<any[]> {
  try {
    const command = new QueryCommand({
      TableName: AUDIT_TABLE,
      IndexName: 'actor-index',
      KeyConditionExpression: 'actor_id = :aid',
      ExpressionAttributeValues: {
        ':aid': actorId,
      },
      ScanIndexForward: false,
      Limit: limit,
    });

    const result = await docClient.send(command);
    return result.Items || [];
  } catch (error) {
    console.error('Audit by actor query failed:', error);
    return [];
  }
}
