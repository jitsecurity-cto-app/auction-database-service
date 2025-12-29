# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the database service.

## Available Workflows

### `reset-database.yml` (AWS Secrets Manager)

Resets the database in staging or production environments using AWS Secrets Manager for credentials.

**Use this if**: You're using AWS Secrets Manager to store database credentials.

**Useful for**:
- Resetting the database after vulnerability testing
- Cleaning up test data
- Restoring database to a clean state

### `reset-database-simple.yml` (GitHub Secrets)

Simpler version that uses GitHub Secrets directly for the DATABASE_URL.

**Use this if**: You prefer storing DATABASE_URL directly in GitHub Secrets (simpler setup).

**Required Secrets**:
- `DATABASE_URL_STAGING` - Full PostgreSQL connection string for staging
- `DATABASE_URL_PRODUCTION` - Full PostgreSQL connection string for production
- `JWT_SECRET` - JWT secret (optional, defaults to 'weak-secret-key')

**Trigger Methods**:

1. **Manual Trigger (Recommended)**
   - Go to Actions tab → Reset Database → Run workflow
   - Select environment (staging/production)
   - Type "RESET" to confirm
   - Click "Run workflow"

2. **Repository Dispatch** (for automation)
   ```bash
   curl -X POST \
     -H "Authorization: token YOUR_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     https://api.github.com/repos/OWNER/REPO/dispatches \
     -d '{"event_type":"reset-database"}'
   ```

**Safety Features**:
- Requires explicit confirmation ("RESET")
- Verifies database schema after reset
- Only runs when explicitly triggered

**Prerequisites for `reset-database.yml`**:
- AWS credentials configured in GitHub Secrets
- Database credentials stored in AWS Secrets Manager
- Proper IAM permissions for Secrets Manager access

**Prerequisites for `reset-database-simple.yml`**:
- `DATABASE_URL_STAGING` secret in GitHub
- `DATABASE_URL_PRODUCTION` secret in GitHub
- `JWT_SECRET` secret in GitHub (optional)

**What It Does**:
1. Fetches database credentials from AWS Secrets Manager
2. Drops all tables (orders, bids, auctions, users, schema_migrations)
3. Runs migrations to recreate schema
4. Verifies all expected tables exist
5. Reports success/failure

**⚠️ Warning**: This workflow will **permanently delete all data** in the selected environment. Use with extreme caution!
