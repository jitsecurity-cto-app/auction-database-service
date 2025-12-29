-- Migration 002: Add orders, shipping, and winner tracking
-- Intentionally uses sequential integer IDs (IDOR vulnerability)

-- Add winner_id and contact fields to auctions table
ALTER TABLE auctions 
ADD COLUMN IF NOT EXISTS winner_id INTEGER;

ALTER TABLE auctions 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

-- Add foreign key for winner (intentionally no authorization check)
-- Check if constraint exists before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_auctions_winner'
  ) THEN
    ALTER TABLE auctions 
    ADD CONSTRAINT fk_auctions_winner 
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add contact information to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS address TEXT;

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL,
  buyer_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  winning_bid_id INTEGER,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending',
  shipping_address TEXT,
  shipping_status VARCHAR(50) DEFAULT 'pending',
  tracking_number VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending_payment',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign keys separately (PostgreSQL doesn't support IF NOT EXISTS for constraints in CREATE TABLE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_auction_id_fkey'
  ) THEN
    ALTER TABLE orders 
    ADD CONSTRAINT orders_auction_id_fkey 
    FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_buyer_id_fkey'
  ) THEN
    ALTER TABLE orders 
    ADD CONSTRAINT orders_buyer_id_fkey 
    FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_seller_id_fkey'
  ) THEN
    ALTER TABLE orders 
    ADD CONSTRAINT orders_seller_id_fkey 
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_winning_bid_id_fkey'
  ) THEN
    ALTER TABLE orders 
    ADD CONSTRAINT orders_winning_bid_id_fkey 
    FOREIGN KEY (winning_bid_id) REFERENCES bids(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add payment_status column to bids table (needed for bid controller)
ALTER TABLE bids
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

-- Indexes for orders table
CREATE INDEX IF NOT EXISTS idx_orders_auction_id ON orders(auction_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_status ON orders(shipping_status);
CREATE INDEX IF NOT EXISTS idx_auctions_winner_id ON auctions(winner_id);
