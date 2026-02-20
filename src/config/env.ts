import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface EnvConfig {
  DATABASE_URL: string;
  JWT_SECRET: string;
  PORT: number;
  NODE_ENV: string;
  AWS_REGION?: string;
  // Feature 1: Image uploads
  IMAGES_S3_BUCKET?: string;
  IMAGES_CDN_URL?: string;
  // Feature 2: Notifications
  NOTIFICATIONS_QUEUE_URL?: string;
  NOTIFICATIONS_TOPIC_ARN?: string;
  NOTIFICATIONS_TABLE?: string;
  // Feature 4: Audit Trail
  AUDIT_TABLE?: string;
  // Feature 5: WebSocket
  WEBSOCKET_API_URL?: string;
  WEBSOCKET_CONNECTIONS_TABLE?: string;
  // Feature 6: Analytics
  ANALYTICS_BUCKET?: string;
  ATHENA_DATABASE?: string;
  ATHENA_RESULTS_BUCKET?: string;
  // Stripe
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  // Sentry
  SENTRY_DSN?: string;
  // LaunchDarkly
  LAUNCHDARKLY_SDK_KEY?: string;
}

// Validate required environment variables
function validateEnv(): EnvConfig {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET || 'weak-secret-key',
    PORT: parseInt(process.env.PORT || '3001', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    AWS_REGION: process.env.AWS_REGION,
    IMAGES_S3_BUCKET: process.env.IMAGES_S3_BUCKET,
    IMAGES_CDN_URL: process.env.IMAGES_CDN_URL,
    NOTIFICATIONS_QUEUE_URL: process.env.NOTIFICATIONS_QUEUE_URL,
    NOTIFICATIONS_TOPIC_ARN: process.env.NOTIFICATIONS_TOPIC_ARN,
    NOTIFICATIONS_TABLE: process.env.NOTIFICATIONS_TABLE,
    AUDIT_TABLE: process.env.AUDIT_TABLE,
    WEBSOCKET_API_URL: process.env.WEBSOCKET_API_URL,
    WEBSOCKET_CONNECTIONS_TABLE: process.env.WEBSOCKET_CONNECTIONS_TABLE,
    ANALYTICS_BUCKET: process.env.ANALYTICS_BUCKET,
    ATHENA_DATABASE: process.env.ATHENA_DATABASE,
    ATHENA_RESULTS_BUCKET: process.env.ATHENA_RESULTS_BUCKET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
    LAUNCHDARKLY_SDK_KEY: process.env.LAUNCHDARKLY_SDK_KEY,
  };
}

export const env = validateEnv();

