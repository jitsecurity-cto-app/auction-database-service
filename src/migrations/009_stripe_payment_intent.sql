-- Migration 009: Add Stripe payment intent ID to orders table
-- Stores the Stripe PaymentIntent ID for payment tracking

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

-- Index for looking up orders by payment intent (used by webhook)
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent ON orders (stripe_payment_intent_id);
