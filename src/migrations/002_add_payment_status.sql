-- Add payment status tracking to bids table
-- This allows tracking whether winning bids have been paid

ALTER TABLE bids ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

-- Add index for payment status queries
CREATE INDEX IF NOT EXISTS idx_bids_payment_status ON bids(payment_status);

-- Update existing bids to have 'pending' status (if column was just added)
UPDATE bids SET payment_status = 'pending' WHERE payment_status IS NULL;
