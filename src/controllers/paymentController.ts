import { Request, Response } from 'express';
import Stripe from 'stripe';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { env } from '../config/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
});

export async function createPaymentIntent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { order_id } = req.body;
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Look up the order
    const orderResult = await query(`SELECT * FROM orders WHERE id = ${order_id}`);

    if (orderResult.rows.length === 0) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const order = orderResult.rows[0];

    // Verify the caller is the buyer
    if (order.buyer_id !== userId) {
      res.status(403).json({ error: 'Only the buyer can pay for this order' });
      return;
    }

    // Verify order is pending payment
    if (order.status !== 'pending_payment') {
      res.status(400).json({ error: 'Order is not pending payment' });
      return;
    }

    // If order already has a payment intent, retrieve it and return the client_secret
    if (order.stripe_payment_intent_id) {
      const existingIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
      res.json({
        client_secret: existingIntent.client_secret,
        payment_intent_id: existingIntent.id,
      });
      return;
    }

    // Create a new PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total_amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        order_id: String(order.id),
        auction_id: String(order.auction_id),
        buyer_id: String(userId),
      },
    });

    // Store the payment intent ID on the order
    await query(`UPDATE orders SET stripe_payment_intent_id = '${paymentIntent.id}' WHERE id = ${order_id}`);

    res.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata.order_id;

        await query(`
          UPDATE orders
          SET payment_status = 'paid', status = 'paid', updated_at = CURRENT_TIMESTAMP
          WHERE id = ${orderId}
        `);

        console.log(`Payment succeeded for order ${orderId}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = paymentIntent.metadata.order_id;

        await query(`
          UPDATE orders
          SET payment_status = 'failed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ${orderId}
        `);

        console.log(`Payment failed for order ${orderId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}
