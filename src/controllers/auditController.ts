import { Request, Response } from 'express';
import { queryAuditEvents, queryAuditByActor } from '../utils/audit';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const AUDIT_TABLE = process.env.AUDIT_TABLE || 'auction-lab-audit-dev';

// Get audit trail for a specific entity
// No authorization check (intentional IDOR vulnerability on audit endpoint)
export async function getEntityAudit(req: Request, res: Response): Promise<void> {
  try {
    const { entity_type, entity_id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // No validation of entity_type or entity_id (intentional vulnerability)
    const events = await queryAuditEvents(entity_type, entity_id, limit);

    res.json(events);
  } catch (error) {
    console.error('Get entity audit error:', error);
    res.status(500).json({
      error: 'Failed to get audit trail',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Get audit trail for a specific actor/user
export async function getActorAudit(req: Request, res: Response): Promise<void> {
  try {
    const { actor_id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // No authorization check — any user can view any actor's audit trail (intentional vulnerability)
    const events = await queryAuditByActor(actor_id, limit);

    res.json(events);
  } catch (error) {
    console.error('Get actor audit error:', error);
    res.status(500).json({
      error: 'Failed to get actor audit trail',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Get all recent audit events (full scan — intentional DoS vulnerability)
export async function getRecentAudit(req: Request, res: Response): Promise<void> {
  try {
    // No limit enforcement on scan (intentional DoS vulnerability: unbounded queries)
    const limit = parseInt(req.query.limit as string) || 100;
    const entityType = req.query.entity_type as string;
    const action = req.query.action as string;

    let filterExpression: string | undefined;
    const expressionValues: Record<string, any> = {};

    if (entityType) {
      filterExpression = 'entity_type = :et';
      expressionValues[':et'] = entityType;
    }

    if (action) {
      filterExpression = filterExpression
        ? `${filterExpression} AND #act = :act`
        : '#act = :act';
      expressionValues[':act'] = action;
    }

    const command = new ScanCommand({
      TableName: AUDIT_TABLE,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: Object.keys(expressionValues).length > 0 ? expressionValues : undefined,
      ExpressionAttributeNames: action ? { '#act': 'action' } : undefined,
      Limit: limit,
    });

    const result = await docClient.send(command);

    // Sort by timestamp descending
    const events = (result.Items || []).sort((a: any, b: any) =>
      b.timestamp.localeCompare(a.timestamp)
    );

    res.json(events);
  } catch (error) {
    console.error('Get recent audit error:', error);
    res.status(500).json({
      error: 'Failed to get recent audit events',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
