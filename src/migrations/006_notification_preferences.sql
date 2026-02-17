-- Migration 006: Add notification preferences table

CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  outbid_email BOOLEAN DEFAULT true,
  outbid_sms BOOLEAN DEFAULT false,
  auction_end_email BOOLEAN DEFAULT true,
  auction_end_sms BOOLEAN DEFAULT false,
  order_update_email BOOLEAN DEFAULT true,
  order_update_sms BOOLEAN DEFAULT false,
  phone_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for quick lookup by user
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
