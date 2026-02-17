-- Migration 007: Add auction scheduling support

-- Add start_time column for scheduled auctions
ALTER TABLE auctions
ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;

-- Add 'scheduled' status value support
-- (PostgreSQL doesn't enforce enum on VARCHAR, so no schema change needed)

-- Index for finding scheduled auctions that need activation
CREATE INDEX IF NOT EXISTS idx_auctions_start_time ON auctions(start_time)
WHERE start_time IS NOT NULL AND status = 'scheduled';

-- Index for finding expired active auctions
CREATE INDEX IF NOT EXISTS idx_auctions_expired ON auctions(end_time)
WHERE status = 'active';
