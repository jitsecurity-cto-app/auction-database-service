# Development Scripts

This directory contains helper scripts for local development and infrastructure management.

## Local Development Scripts

### `setup-local.sh`

Sets up the local development environment:

- Starts PostgreSQL via Docker Compose
- Creates `.env` file if it doesn't exist
- Installs npm dependencies
- Runs database migrations

**Usage:**
```bash
npm run setup:local
# or
./scripts/setup-local.sh
```

### `teardown-local.sh`

Tears down the local development environment:

- Stops and removes Docker containers
- Removes volumes (with `-v` flag)

**Usage:**
```bash
npm run teardown:local
# or
./scripts/teardown-local.sh
```

### `reset-db.sh`

Resets the database (works with both local Docker and AWS RDS):

- **Local mode**: Drops and recreates the database in Docker
- **CI/CD mode**: Drops all tables and re-runs migrations (when `DATABASE_URL` is set)
- Automatically detects environment and uses appropriate method

**Usage:**
```bash
# Local development (uses Docker)
npm run reset:db
# or
./scripts/reset-db.sh

# CI/CD or AWS RDS (requires DATABASE_URL)
DATABASE_URL=postgresql://user:pass@host:port/dbname npm run reset:db
```

**TypeScript version:**
```bash
# Uses the TypeScript reset utility (recommended for CI/CD)
npm run reset:db:ts
```

**Note**: This script will **permanently delete all data**. Use with caution!

## GitHub Actions Workflow

### Database Reset Workflow

A GitHub Actions workflow is available to reset the database in staging/production environments.

**Location**: `.github/workflows/reset-database.yml`

**Features**:
- Manual trigger via GitHub Actions UI
- Environment selection (staging/production)
- Safety confirmation required (type "RESET" to confirm)
- Automatic verification after reset
- Fetches database credentials from AWS Secrets Manager

**Usage**:
1. Go to GitHub Actions tab in the repository
2. Select "Reset Database" workflow
3. Click "Run workflow"
4. Select environment (staging/production)
5. Type "RESET" in the confirmation field
6. Click "Run workflow"

**Required Secrets**:
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region (defaults to us-east-1)
- `JWT_SECRET` - JWT secret for the application

**Required AWS Secrets Manager Secret**:
- `auction-db-staging-credentials` - JSON with database credentials for staging
- `auction-db-production-credentials` - JSON with database credentials for production

Secret format:
```json
{
  "username": "db_user",
  "password": "db_password",
  "host": "db-host.rds.amazonaws.com",
  "port": "5432",
  "dbname": "auction_db"
}
```

## Infrastructure Scripts

### `deploy-infra.sh`

Deploys AWS infrastructure using Terraform:

- Validates Terraform configuration
- Plans and applies infrastructure changes
- Outputs database connection information

**Prerequisites:**
- Terraform installed
- AWS CLI configured
- `terraform/terraform.tfvars` file created

**Usage:**
```bash
./scripts/deploy-infra.sh
```

### `destroy-infra.sh`

Destroys AWS infrastructure:

- ⚠️ **Warning**: This will delete all infrastructure and data!
- Requires confirmation before proceeding

**Usage:**
```bash
./scripts/destroy-infra.sh
```

## Quick Reference

### First Time Setup

```bash
# 1. Set up local environment
npm run setup:local

# 2. Start development server
npm run dev
```

### Daily Development

```bash
# Start services
docker-compose up -d

# Run migrations (if schema changed)
npm run build && npm run migrate

# Run tests
npm test

# Stop services
docker-compose down
```

### Reset Everything

```bash
# Reset database
npm run reset:db

# Or tear down and set up again
npm run teardown:local
npm run setup:local
```

### Deploy to AWS

```bash
# 1. Configure Terraform variables
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 2. Deploy infrastructure
../scripts/deploy-infra.sh

# 3. Update .env with database URL from Terraform output
# 4. Deploy application (see main README)
```

## Troubleshooting

### Scripts not executable

```bash
chmod +x scripts/*.sh
```

### Docker not running

```bash
# Start Docker Desktop or Docker daemon
# Then retry the script
```

### Database connection errors

1. Check if PostgreSQL container is running:
   ```bash
   docker-compose ps
   ```

2. Check database URL in `.env`:
   ```bash
   cat .env | grep DATABASE_URL
   ```

3. Test connection:
   ```bash
   docker-compose exec postgres psql -U postgres -d auction_db
   ```

### Terraform errors

1. Verify AWS credentials:
   ```bash
   aws sts get-caller-identity
   ```

2. Check Terraform version:
   ```bash
   terraform version
   ```

3. Reinitialize Terraform:
   ```bash
   cd terraform
   terraform init
   ```

