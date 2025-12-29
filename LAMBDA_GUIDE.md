# Node.js with AWS Lambda Guide

This guide explains how the database service uses Node.js with AWS Lambda for serverless deployment.

## Overview

The database service is deployed as an AWS Lambda function that wraps an Express.js application. This provides a cost-effective, serverless solution that scales automatically.

## Architecture

```
API Gateway (HTTP API)
    ↓
Lambda Function (Node.js 20.x)
    ↓
Express.js App (wrapped with aws-serverless-express)
    ↓
PostgreSQL (RDS)
```

## Key Components

### 1. Lambda Handler (`src/lambda.ts`)

The Lambda handler is the entry point for all API Gateway requests:

```typescript
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const serverInstance = await initializeServer();
  return awsServerlessExpress.proxy(serverInstance, event, context, 'PROMISE').promise;
};
```

**Key Features:**
- **Lazy Initialization**: The Express server is initialized on the first invocation (cold start)
- **Secrets Management**: Automatically loads secrets from AWS Secrets Manager on cold start
- **Caching**: Secrets and server instance are cached for subsequent invocations (warm starts)

### 2. Secrets Management

The Lambda function fetches sensitive configuration from AWS Secrets Manager:

- **Database URL**: `{project-name}-database-url-{environment}`
- **JWT Secret**: `{project-name}-jwt-secret-{environment}`

Secrets are loaded once per cold start and cached in memory for performance.

### 3. Express App Wrapper

The Express application (`src/index.ts`) is wrapped using `aws-serverless-express`, which:
- Converts API Gateway events to Express requests
- Converts Express responses to API Gateway responses
- Maintains compatibility with existing Express middleware and routes

## How Node.js Works with Lambda

### Runtime Environment

- **Runtime**: Node.js 20.x (configured in Terraform)
- **Handler**: `lambda.handler` (points to `dist/lambda.js` export)
- **Memory**: 512 MB (configurable)
- **Timeout**: 30 seconds (max for HTTP API Gateway)

### Cold Start vs Warm Start

**Cold Start:**
1. Lambda container initializes
2. Node.js runtime starts
3. Lambda handler loads
4. Secrets are fetched from Secrets Manager
5. Express app initializes
6. Server instance is created
7. Request is processed

**Warm Start:**
1. Lambda container is reused
2. Cached server instance handles request immediately
3. Much faster response time

### Deployment Package Structure

The Lambda deployment package (`lambda-deployment.zip`) contains:

```
lambda-deployment.zip
├── lambda.js          # Compiled Lambda handler
├── index.js           # Compiled Express app
├── config/            # Configuration files
├── controllers/       # Request handlers
├── middleware/        # Express middleware
├── routes/            # API routes
├── utils/             # Utility functions
└── node_modules/      # Production dependencies
```

## Building and Deploying

### Local Build

```bash
# Build TypeScript
npm run build

# Create Lambda deployment package
npm run package:lambda
```

The `package:lambda` script:
1. Installs production dependencies
2. Copies compiled JavaScript from `dist/`
3. Includes `node_modules/` with production dependencies
4. Creates a ZIP file ready for Lambda deployment

### CI/CD Deployment

The GitHub Actions workflow (`/.github/workflows/deploy.yml`) automatically:

1. **Builds** the TypeScript code
2. **Packages** the Lambda deployment ZIP
3. **Deploys** to AWS Lambda using `aws lambda update-function-code`

### Manual Deployment

```bash
# Build and package
npm run build:lambda

# Deploy to Lambda
aws lambda update-function-code \
  --function-name auction-lab-api-dev \
  --zip-file fileb://lambda-deployment.zip \
  --region us-east-1
```

## Environment Variables

Lambda environment variables (set in Terraform):

- `NODE_ENV`: Environment name (dev, staging, prod)
- `AWS_REGION`: AWS region for Secrets Manager
- `PROJECT_NAME`: Project name for secret naming

**Note**: Sensitive values (DATABASE_URL, JWT_SECRET) are NOT set as environment variables. They are fetched from Secrets Manager at runtime.

## VPC Configuration

The Lambda function runs in a VPC to access the RDS database:

- **Subnets**: Default VPC subnets
- **Security Group**: Allows outbound to RDS (port 5432)
- **Cold Start Impact**: VPC-attached Lambdas have longer cold starts (~1-2 seconds)

## API Gateway Integration

- **Type**: HTTP API (API Gateway v2)
- **Integration**: AWS_PROXY (Lambda proxy integration)
- **Route**: `$default` (catch-all proxy to Lambda)
- **CORS**: Intentionally permissive (`*`) for lab purposes

## Performance Considerations

### Optimization Tips

1. **Keep Dependencies Small**: Minimize `node_modules` size
2. **Use Connection Pooling**: Reuse database connections across invocations
3. **Enable Provisioned Concurrency**: For consistent performance (costs more)
4. **Optimize Cold Starts**: Minimize initialization code

### Current Setup

- **Memory**: 512 MB (sufficient for Express app)
- **Timeout**: 30 seconds (max for HTTP API)
- **No Provisioned Concurrency**: Pay-per-use model

## Monitoring and Debugging

### CloudWatch Logs

All Lambda invocations are logged to:
```
/aws/lambda/{project-name}-api-{environment}
```

### Viewing Logs

```bash
# Stream logs in real-time
aws logs tail /aws/lambda/auction-lab-api-dev --follow

# View recent logs
aws logs tail /aws/lambda/auction-lab-api-dev --since 1h
```

### Common Issues

**Cold Start Timeout:**
- Increase Lambda timeout
- Reduce initialization code
- Use connection pooling

**VPC Timeout:**
- Check security group rules
- Verify subnet configuration
- Ensure RDS is accessible from Lambda subnets

**Secrets Manager Errors:**
- Verify IAM permissions
- Check secret names match Terraform configuration
- Ensure secrets exist in Secrets Manager

## Cost Optimization

Lambda pricing is based on:
- **Requests**: $0.20 per 1M requests
- **Compute**: $0.0000166667 per GB-second

For this lab setup:
- **Free Tier**: 1M requests/month, 400,000 GB-seconds/month
- **Estimated Cost**: < $5/month for light usage

## Local Development

For local development, the Express app runs normally:

```bash
npm run dev
```

The app detects it's not running in Lambda and:
- Uses environment variables from `.env` file
- Starts an HTTP server on port 3001
- Skips Secrets Manager lookup

## Differences from ECS/Docker

| Aspect | Lambda | ECS/Docker |
|--------|--------|------------|
| **Scaling** | Automatic | Manual/Auto-scaling groups |
| **Cost** | Pay per request | Pay for running containers |
| **Cold Start** | ~1-2 seconds | N/A (always running) |
| **Deployment** | ZIP package | Docker image |
| **Memory** | 128 MB - 10 GB | Configurable |
| **Timeout** | 15 min (max) | No limit |

## Troubleshooting

### Handler Not Found

**Error**: `Cannot find module 'lambda'`

**Solution**: Ensure handler is set to `lambda.handler` in Terraform and the file is compiled to `dist/lambda.js`

### Module Not Found

**Error**: `Cannot find module 'express'`

**Solution**: Ensure `node_modules` is included in the deployment package. Check `package:lambda` script.

### Secrets Not Loading

**Error**: `Failed to load secrets from Secrets Manager`

**Solution**: 
- Verify IAM role has `secretsmanager:GetSecretValue` permission
- Check secret names match Terraform configuration
- Ensure secrets exist in Secrets Manager

### Database Connection Timeout

**Error**: `Connection timeout to RDS`

**Solution**:
- Verify Lambda is in VPC with correct subnets
- Check security group allows Lambda → RDS (port 5432)
- Ensure RDS is in same VPC as Lambda

## Next Steps

1. **Monitor Performance**: Set up CloudWatch dashboards
2. **Optimize Cold Starts**: Consider provisioned concurrency for production
3. **Add Caching**: Use ElastiCache for frequently accessed data
4. **Implement Health Checks**: Add Lambda health check endpoint

## References

- [AWS Lambda Node.js Runtime](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html)
- [aws-serverless-express](https://github.com/awslabs/aws-serverless-express)
- [API Gateway Lambda Integration](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

