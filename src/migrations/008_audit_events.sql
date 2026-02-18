-- Migration 008: Audit events table (PostgreSQL-based)
-- Replaces DynamoDB audit trail for VPC-compatible deployment

CREATE TABLE IF NOT EXISTS audit_events (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_id VARCHAR(50) NOT NULL,
  actor_email VARCHAR(255) DEFAULT 'unknown',
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  ip_address VARCHAR(100) DEFAULT 'unknown',
  user_agent TEXT DEFAULT 'unknown',
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for entity lookups (replaces DynamoDB pk)
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events (entity_type, entity_id);

-- Index for actor lookups (replaces DynamoDB GSI)
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events (actor_id);

-- Index for timestamp ordering
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events (timestamp DESC);
