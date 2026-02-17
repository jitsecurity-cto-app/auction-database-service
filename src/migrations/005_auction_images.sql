-- Migration 005: Add auction images support

-- Create auction_images table
CREATE TABLE IF NOT EXISTS auction_images (
  id SERIAL PRIMARY KEY,
  auction_id INTEGER NOT NULL,
  uploaded_by INTEGER NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255),
  content_type VARCHAR(100),
  file_size INTEGER,
  sort_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for auction_images table
CREATE INDEX IF NOT EXISTS idx_auction_images_auction_id ON auction_images(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_images_uploaded_by ON auction_images(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_auction_images_is_primary ON auction_images(is_primary);
