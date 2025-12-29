-- Migration 004: Add tracking URL, shipped_at timestamp, and disputes table

-- Add tracking_url to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS tracking_url VARCHAR(500);

-- Add shipped_at timestamp to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP;

-- Add completed_at timestamp to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Create disputes table
CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL,
  order_id INTEGER,
  filed_by INTEGER NOT NULL,
  filed_by_role VARCHAR(50) NOT NULL, -- 'seller' or 'buyer'
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_review', 'resolved', 'closed'
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (filed_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for disputes table
CREATE INDEX IF NOT EXISTS idx_disputes_auction_id ON disputes(auction_id);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_filed_by ON disputes(filed_by);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
