-- Migration 003: Add workflow_state to auctions for unified workflow management
-- Run this SQL file directly on your database

-- Add workflow_state column to auctions table
ALTER TABLE auctions 
ADD COLUMN IF NOT EXISTS workflow_state VARCHAR(50) DEFAULT 'active';

-- Set workflow_state based on existing status and order state
UPDATE auctions 
SET workflow_state = CASE
  WHEN status = 'active' THEN 'active'
  WHEN status = 'ended' AND winner_id IS NOT NULL THEN 'pending_sale'
  WHEN status = 'ended' AND winner_id IS NULL THEN 'pending_sale'
  WHEN status = 'cancelled' THEN 'cancelled'
  ELSE 'active'
END
WHERE workflow_state IS NULL OR workflow_state = 'active';

-- Update workflow_state for auctions that have orders
UPDATE auctions
SET workflow_state = CASE
  WHEN EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.auction_id = auctions.id 
    AND orders.status = 'completed'
  ) THEN 'complete'
  WHEN EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.auction_id = auctions.id 
    AND orders.shipping_status IN ('shipped', 'delivered')
  ) THEN 'shipping'
  WHEN EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.auction_id = auctions.id 
    AND orders.status IN ('paid', 'shipped', 'delivered')
  ) THEN 'shipping'
  WHEN EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.auction_id = auctions.id
  ) THEN 'pending_sale'
  ELSE workflow_state
END
WHERE status = 'ended';

-- Add index for workflow_state queries
CREATE INDEX IF NOT EXISTS idx_auctions_workflow_state ON auctions(workflow_state);

-- Mark migration as applied (if using migration tracking)
INSERT INTO schema_migrations (version) VALUES ('003_workflow_states') 
ON CONFLICT (version) DO NOTHING;
