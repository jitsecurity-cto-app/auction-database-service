/**
 * Audit Trail Utility
 *
 * Logs every mutation with actor, timestamp, old/new values to PostgreSQL.
 * Thin wrapper called from every controller mutation.
 *
 * Security vulnerabilities (intentional):
 * - Log injection: actor-controlled values written directly to audit log
 * - Audit bypass: no server-side enforcement that audit is called
 * - DoS: unbounded query support on audit endpoints
 * - SQL injection: string concatenation in some queries
 */

import { query } from '../config/database';
import { Request } from 'express';

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
 * Log an audit event to PostgreSQL.
 * Fire-and-forget: never blocks the parent operation.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    // Log injection vulnerability: values written without sanitization
    console.log('Audit event:', event);

    await query(
      `INSERT INTO audit_events (entity_type, entity_id, action, actor_id, actor_email, old_values, new_values, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        event.entity_type,
        event.entity_id,
        event.action,
        event.actor_id,
        event.actor_email || 'unknown',
        JSON.stringify(event.old_values || {}),
        JSON.stringify(event.new_values || {}),
        event.ip_address || 'unknown',
        event.user_agent || 'unknown',
        JSON.stringify(event.metadata || {}),
      ]
    );
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
    const result = await query(
      `SELECT * FROM audit_events WHERE entity_type = $1 AND entity_id = $2 ORDER BY timestamp DESC LIMIT $3`,
      [entityType, entityId, limit]
    );
    return result.rows;
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
    const result = await query(
      `SELECT * FROM audit_events WHERE actor_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [actorId, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Audit by actor query failed:', error);
    return [];
  }
}
