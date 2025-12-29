/**
 * Lambda Handler Wrapper
 * 
 * This file wraps the Express app for AWS Lambda + API Gateway.
 * Simple, cost-effective setup for lab environment.
 * 
 * Uses aws-serverless-express for compatibility with Express apps.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import awsServerlessExpress from 'aws-serverless-express';

// Cache for secrets and server instance
let server: any = null;
let secretsLoaded = false;

/**
 * Load secrets from AWS Secrets Manager
 * Secrets are cached after first load for performance
 */
async function loadSecrets(): Promise<void> {
  if (secretsLoaded) {
    return;
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  const environment = process.env.NODE_ENV || 'dev';
  const projectName = process.env.PROJECT_NAME || 'auction-lab';

  const secretsClient = new SecretsManagerClient({ region });

  try {
    // Load database URL
    const dbSecretName = `${projectName}-database-url-${environment}`;
    const dbSecretResponse = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: dbSecretName })
    );
    const dbSecret = JSON.parse(dbSecretResponse.SecretString || '{}');
    process.env.DATABASE_URL = dbSecret.DATABASE_URL;

    // Load JWT secret
    const jwtSecretName = `${projectName}-jwt-secret-${environment}`;
    const jwtSecretResponse = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: jwtSecretName })
    );
    const jwtSecret = JSON.parse(jwtSecretResponse.SecretString || '{}');
    process.env.JWT_SECRET = jwtSecret.JWT_SECRET;

    secretsLoaded = true;
  } catch (error) {
    console.error('Failed to load secrets from Secrets Manager:', error);
    // In development, allow fallback to environment variables
    if (process.env.NODE_ENV === 'development') {
      console.warn('Falling back to environment variables');
    } else {
      throw error;
    }
  }
}

/**
 * Initialize the Express app server
 * This is done lazily after secrets are loaded
 */
async function initializeServer(): Promise<any> {
  if (server) {
    return server;
  }

  // Load secrets before importing app (app uses env variables)
  await loadSecrets();

  // Import app after secrets are loaded
  const { default: app } = await import('./index');
  server = awsServerlessExpress.createServer(app);
  return server;
}

/**
 * Lambda handler function
 * This is the entry point for API Gateway requests
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Initialize server on first invocation (cold start)
  const serverInstance = await initializeServer();
  
  // Proxy the request to Express
  return awsServerlessExpress.proxy(serverInstance, event, context, 'PROMISE').promise;
};

