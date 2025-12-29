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

Resets the local database:

- Drops and recreates the database
- Runs migrations to set up schema

**Usage:**
```bash
npm run reset:db
# or
./scripts/reset-db.sh
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

