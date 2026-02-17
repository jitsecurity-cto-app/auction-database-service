/**
 * WebSocket API Handlers
 *
 * $connect — stores connectionId + auctionId in DynamoDB
 * $disconnect — removes connection from DynamoDB
 * sendMessage — broadcasts bid updates to all watchers
 *
 * Security vulnerabilities (intentional):
 * - Unauthenticated WebSocket connections (no JWT verification)
 * - Message injection: any client can publish fake bid updates
 * - Connection flooding: no rate limiting on connections
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CONNECTIONS_TABLE = process.env.WEBSOCKET_CONNECTIONS_TABLE || 'auction-lab-ws-connections-dev';

// ─── $connect handler ────────────────────────────────────────────────────────

export async function onConnect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId;
  const auctionId = event.queryStringParameters?.auctionId || 'global';

  // No authentication check (intentional vulnerability: unauthenticated connections)
  console.log('WebSocket connect:', { connectionId, auctionId });

  try {
    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        auction_id: auctionId,
        connection_id: connectionId!,
        connected_at: new Date().toISOString(),
        // No connection limit per user/IP (intentional: connection flooding DoS)
        ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
      },
    }));

    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('Connect error:', error);
    return { statusCode: 500, body: 'Failed to connect' };
  }
}

// ─── $disconnect handler ─────────────────────────────────────────────────────

export async function onDisconnect(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId;

  console.log('WebSocket disconnect:', { connectionId });

  try {
    // We need to find and delete the connection record
    // Since we don't know the auction_id, we scan (intentional inefficiency)
    // In production you'd use a GSI on connection_id
    // For the lab, we'll just try to delete from known auction context
    // The TTL will clean up stale connections anyway
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('Disconnect error:', error);
    return { statusCode: 500, body: 'Failed to disconnect' };
  }
}

// ─── Broadcast function (called from bid controller) ─────────────────────────

export async function broadcastToAuction(
  auctionId: string,
  message: Record<string, any>,
  apiEndpoint: string
): Promise<void> {
  try {
    // Query all connections watching this auction
    const result = await docClient.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      KeyConditionExpression: 'auction_id = :aid',
      ExpressionAttributeValues: { ':aid': auctionId },
    }));

    const connections = result.Items || [];
    console.log(`Broadcasting to ${connections.length} connections for auction ${auctionId}`);

    if (connections.length === 0) return;

    const apiClient = new ApiGatewayManagementApiClient({
      endpoint: apiEndpoint,
    });

    const messageStr = JSON.stringify(message);

    // Send to all connections (no message validation — intentional vulnerability)
    const sendPromises = connections.map(async (conn) => {
      try {
        await apiClient.send(new PostToConnectionCommand({
          ConnectionId: conn.connection_id,
          Data: Buffer.from(messageStr),
        }));
      } catch (error: any) {
        // If connection is stale, remove it
        if (error.statusCode === 410) {
          try {
            await docClient.send(new DeleteCommand({
              TableName: CONNECTIONS_TABLE,
              Key: { auction_id: auctionId, connection_id: conn.connection_id },
            }));
          } catch { /* ignore cleanup errors */ }
        }
        console.error(`Failed to send to ${conn.connection_id}:`, error);
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (error) {
    console.error('Broadcast error:', error);
  }
}

// ─── Message handler (for client-sent messages) ──────────────────────────────

export async function onMessage(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId;

  // No message validation (intentional vulnerability: message injection)
  console.log('WebSocket message from:', connectionId, 'body:', event.body);

  try {
    const body = JSON.parse(event.body || '{}');

    // Echo back (for ping/pong)
    if (body.action === 'ping') {
      const apiEndpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
      const apiClient = new ApiGatewayManagementApiClient({ endpoint: apiEndpoint });

      await apiClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId!,
        Data: Buffer.from(JSON.stringify({ action: 'pong', timestamp: new Date().toISOString() })),
      }));
    }

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('Message handler error:', error);
    return { statusCode: 500, body: 'Error' };
  }
}

// ─── Lambda handler (routes to appropriate function) ─────────────────────────

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const routeKey = event.requestContext.routeKey;

  switch (routeKey) {
    case '$connect':
      return onConnect(event);
    case '$disconnect':
      return onDisconnect(event);
    case 'sendMessage':
    default:
      return onMessage(event);
  }
};
