# Database Service

REST API service providing data access for the auction platform. This service handles all database operations for auctions, bids, and users.

## Overview

The Database Service is a Node.js/Express API that serves as the backend for both the Customer App and CRM App. It provides endpoints for managing auctions, bids, and user data.

## Features

- RESTful API endpoints
- PostgreSQL database integration
- User authentication (JWT-based, intentionally weak)
- Auction and bid management
- User management
- Order and transaction management
- Automatic auction closure and winner determination
- Shipping address and status tracking
- Contact information management
- Payment status tracking for bids
- User activity tracking (my bids, wins, auctions, sales)

## Security Vulnerabilities

This service intentionally contains security vulnerabilities for educational purposes:
- SQL Injection (unparameterized queries)
- Weak JWT authentication
- Missing authorization checks
- IDOR vulnerabilities
- No input validation
- CORS misconfiguration

See `SECURITY.md` for details.

## Tech Stack

- Node.js 18+
- Express.js
- TypeScript
- PostgreSQL
- JWT (weak implementation)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or RDS)
- AWS account for deployment

### Installation

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/auction_db
JWT_SECRET=weak-secret-key-change-in-production
PORT=3001
NODE_ENV=development
AWS_REGION=us-east-1
```

### Running Locally

#### Quick Start (Recommended)

```bash
# Set up local environment (Docker Compose + migrations)
npm run setup:local

# Start development server
npm run dev
```

This will:
- Start PostgreSQL in Docker
- Create `.env` file if needed
- Install dependencies
- Run database migrations

#### Manual Setup

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d postgres

# Create .env file (copy from .env.example)
cp .env.example .env
# Edit .env with your configuration

# Install dependencies
npm install

# Run migrations
npm run build
npm run migrate

# Start development server
npm run dev
```

#### Other Useful Commands

```bash
# Reset local database
npm run reset:db

# Tear down local environment
npm run teardown:local

# Production mode
npm run build
npm start
```

### AWS Infrastructure Setup

Deploy RDS database and other AWS resources using Terraform:

```bash
# 1. Configure Terraform variables
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values (especially db_password)

# 2. Deploy infrastructure
../scripts/deploy-infra.sh

# 3. Get database connection URL
terraform output database_url

# 4. Update .env with the database URL
# 5. Run migrations
npm run build && npm run migrate
```

See `terraform/README.md` for detailed infrastructure setup instructions.

### Database Setup

```bash
# Run migrations
npm run build
npm run migrate

# Seed database (optional - if seed script exists)
npm run seed
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify` - Verify JWT token

### Auctions
- `GET /api/auctions` - List all auctions
- `GET /api/auctions/:id` - Get auction by ID
- `POST /api/auctions` - Create new auction
- `PUT /api/auctions/:id` - Update auction
- `DELETE /api/auctions/:id` - Delete auction

### Bids
- `GET /api/auctions/:id/bids` - Get bids for auction
- `POST /api/auctions/:id/bids` - Place a bid
- `PUT /api/bids/:id/payment-status` - Update payment status of a bid

### Auctions (Closure)
- `POST /api/auctions/:id/close` - Close auction and determine winner
- `POST /api/auctions/close-expired` - Close all expired auctions

### Orders
- `GET /api/orders` - List orders (with filters: buyer_id, seller_id, status, payment_status, shipping_status)
- `GET /api/orders/:id` - Get order by ID
- `POST /api/orders` - Create new order (requires authentication, winner only)
- `PUT /api/orders/:id` - Update order (shipping status, tracking number, payment status)

### Users
- `GET /api/users` - List users (admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user (including phone and address)
- `GET /api/users/:id/my-bids` - Get all bids placed by a user
- `GET /api/users/:id/my-wins` - Get all winning bids (completed auctions where user won)
- `GET /api/users/:id/my-auctions` - Get all auctions created by a user
- `GET /api/users/:id/my-sales` - Get all completed auctions created by a user (with payment status)

## Project Structure

```
database-service/
├── src/
│   ├── routes/          # API route handlers
│   ├── controllers/     # Business logic
│   ├── models/          # Data models
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions
│   ├── config/          # Configuration
│   └── index.ts         # Entry point
├── tests/               # Test files
├── .github/workflows/   # CI/CD pipelines
├── Dockerfile           # Container definition
├── docker-compose.yml   # Local development
├── .env.example         # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Code Style

- Use TypeScript
- Follow ESLint configuration
- Use async/await for async operations
- Keep functions small and focused

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Deployment

### AWS Deployment

The service is deployed to:
- **AWS Lambda** (serverless) - Recommended for cost-effective lab setup
- **API Gateway** (HTTP API) - Simple HTTP endpoint

### CI/CD

GitHub Actions automatically:
1. Runs tests and linting
2. Builds TypeScript code
3. Creates Lambda deployment package
4. Deploys infrastructure with Terraform
5. Updates Lambda function code

Push to `main` branch to trigger deployment.

### Environment Variables in AWS

Set the following in your AWS environment:
- `DATABASE_URL` - RDS connection string
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - Environment (production)

## Cost Optimization

- Use AWS Lambda for serverless deployment (pay per request, no idle costs)
- Use RDS db.t3.micro (free tier eligible, then ~$15/month)
- Enable CloudWatch basic monitoring only (7-day retention)
- Estimated cost: $0-20/month for low traffic lab usage

## License

Educational use only.

