import { Request, Response } from 'express';
import { queryAuditEvents, queryAuditByActor, logAuditEvent } from '../utils/audit';
import { query as dbQuery } from '../config/database';

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

// Get all recent audit events (no auth check - intentional vulnerability)
export async function getRecentAudit(req: Request, res: Response): Promise<void> {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const entityType = req.query.entity_type as string;
    const action = req.query.action as string;

    let sql = 'SELECT * FROM audit_events';
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(entityType);
    }

    if (action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(action);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await dbQuery(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get recent audit error:', error);
    res.status(500).json({
      error: 'Failed to get recent audit events',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Seed audit events based on existing database data
// No auth check (intentional vulnerability - anyone can seed audit data)
export async function seedAuditEvents(req: Request, res: Response): Promise<void> {
  try {
    // Check if audit_events table has data already
    const existing = await dbQuery('SELECT COUNT(*) as count FROM audit_events');
    if (parseInt(existing.rows[0].count) > 0) {
      res.json({ message: `Audit table already has ${existing.rows[0].count} events, skipping seed`, count: parseInt(existing.rows[0].count) });
      return;
    }

    const events: Array<{ entity_type: string; entity_id: string; action: string; actor_id: string; actor_email: string; new_values: Record<string, any>; timestamp_offset_hours: number }> = [];

    // Fetch existing data from PostgreSQL
    const users = await dbQuery('SELECT id, email, name, role FROM users ORDER BY id');
    const auctions = await dbQuery('SELECT id, title, starting_price, status, workflow_state, created_by, created_at FROM auctions ORDER BY id');
    const bids = await dbQuery('SELECT id, auction_id, user_id, amount, created_at FROM bids ORDER BY created_at');
    const orders = await dbQuery('SELECT id, auction_id, buyer_id, seller_id, total_amount, status, created_at FROM orders ORDER BY id');
    const disputes = await dbQuery('SELECT id, auction_id, filed_by, reason, status, created_at FROM disputes ORDER BY id');

    // Build user lookup
    const userMap = new Map<number, { email: string; name: string }>();
    for (const u of users.rows) {
      userMap.set(u.id, { email: u.email, name: u.name });
    }

    // User creation events
    for (const u of users.rows) {
      events.push({
        entity_type: 'user', entity_id: String(u.id), action: 'create',
        actor_id: String(u.id), actor_email: u.email,
        new_values: { name: u.name, email: u.email, role: u.role },
        timestamp_offset_hours: -336,
      });
    }

    // Auction creation events
    for (const a of auctions.rows) {
      const creator = userMap.get(a.created_by);
      events.push({
        entity_type: 'auction', entity_id: String(a.id), action: 'create',
        actor_id: String(a.created_by), actor_email: creator?.email || 'unknown',
        new_values: { title: a.title, starting_price: a.starting_price, status: a.status },
        timestamp_offset_hours: -336,
      });
    }

    // Bid events
    for (const b of bids.rows) {
      const bidder = userMap.get(b.user_id);
      events.push({
        entity_type: 'bid', entity_id: String(b.id), action: 'create',
        actor_id: String(b.user_id), actor_email: bidder?.email || 'unknown',
        new_values: { auction_id: b.auction_id, amount: b.amount },
        timestamp_offset_hours: -Math.random() * 288,
      });
    }

    // Auction status updates for ended auctions
    for (const a of auctions.rows) {
      if (a.status === 'ended') {
        const creator = userMap.get(a.created_by);
        events.push({
          entity_type: 'auction', entity_id: String(a.id), action: 'close',
          actor_id: 'system', actor_email: 'system@auction.lab',
          new_values: { status: 'ended', workflow_state: a.workflow_state },
          timestamp_offset_hours: -Math.random() * 48,
        });

        if (a.workflow_state === 'shipping' || a.workflow_state === 'complete') {
          events.push({
            entity_type: 'auction', entity_id: String(a.id), action: 'update',
            actor_id: String(a.created_by), actor_email: creator?.email || 'unknown',
            new_values: { workflow_state: 'pending_sale' },
            timestamp_offset_hours: -72,
          });
          events.push({
            entity_type: 'auction', entity_id: String(a.id), action: 'update',
            actor_id: String(a.created_by), actor_email: creator?.email || 'unknown',
            new_values: { workflow_state: 'shipping' },
            timestamp_offset_hours: -48,
          });
        }
        if (a.workflow_state === 'complete') {
          events.push({
            entity_type: 'auction', entity_id: String(a.id), action: 'update',
            actor_id: String(a.created_by), actor_email: creator?.email || 'unknown',
            new_values: { workflow_state: 'complete' },
            timestamp_offset_hours: -24,
          });
        }
      }
    }

    // Order events
    for (const o of orders.rows) {
      const buyer = userMap.get(o.buyer_id);
      events.push({
        entity_type: 'order', entity_id: String(o.id), action: 'create',
        actor_id: 'system', actor_email: 'system@auction.lab',
        new_values: { auction_id: o.auction_id, buyer_id: o.buyer_id, total_amount: o.total_amount, status: o.status },
        timestamp_offset_hours: -72,
      });

      if (o.status === 'shipped' || o.status === 'completed') {
        events.push({
          entity_type: 'order', entity_id: String(o.id), action: 'update',
          actor_id: String(o.seller_id), actor_email: userMap.get(o.seller_id)?.email || 'unknown',
          new_values: { status: 'shipped', shipping_status: 'shipped' },
          timestamp_offset_hours: -48,
        });
      }
      if (o.status === 'completed') {
        events.push({
          entity_type: 'order', entity_id: String(o.id), action: 'update',
          actor_id: String(o.buyer_id), actor_email: buyer?.email || 'unknown',
          new_values: { status: 'completed', shipping_status: 'delivered' },
          timestamp_offset_hours: -24,
        });
      }
    }

    // Dispute events
    for (const d of disputes.rows) {
      const filer = userMap.get(d.filed_by);
      events.push({
        entity_type: 'dispute', entity_id: String(d.id), action: 'create',
        actor_id: String(d.filed_by), actor_email: filer?.email || 'unknown',
        new_values: { auction_id: d.auction_id, reason: d.reason, status: d.status },
        timestamp_offset_hours: -24,
      });
    }

    // Write all events to PostgreSQL using batch insert
    const ips = ['192.168.1.42', '10.0.0.15', '172.16.0.100', '203.0.113.50', '198.51.100.23'];
    let written = 0;

    for (const event of events) {
      const ts = new Date(Date.now() + event.timestamp_offset_hours * 3600 * 1000).toISOString();
      await dbQuery(
        `INSERT INTO audit_events (entity_type, entity_id, action, actor_id, actor_email, new_values, ip_address, user_agent, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          event.entity_type,
          event.entity_id,
          event.action,
          event.actor_id,
          event.actor_email,
          JSON.stringify(event.new_values),
          ips[Math.floor(Math.random() * ips.length)],
          'AuctionLab-Seed/1.0',
          ts,
        ]
      );
      written++;
    }

    res.json({ message: `Seeded ${written} audit events`, count: written });
  } catch (error) {
    console.error('Seed audit error:', error);
    res.status(500).json({
      error: 'Failed to seed audit events',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
