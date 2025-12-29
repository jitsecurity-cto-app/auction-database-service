#!/bin/bash
# Database reset script
# This script resets the database (works with both local Docker and AWS RDS)
#
# Usage:
#   Local: ./scripts/reset-db.sh
#   CI/CD: DATABASE_URL=postgresql://... ./scripts/reset-db.sh

set -e

echo "🔄 Resetting database..."

# Check if DATABASE_URL is set (for AWS RDS/CI environments)
if [ -n "$DATABASE_URL" ]; then
    echo "🌐 Using DATABASE_URL for database connection (AWS RDS/CI mode)"
    
    # Extract database name from DATABASE_URL
    # Format: postgresql://user:pass@host:port/dbname
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    if [ -z "$DB_NAME" ]; then
        echo "❌ Could not extract database name from DATABASE_URL"
        exit 1
    fi
    
    echo "📦 Building application..."
    npm run build
    
    echo "🔄 Resetting database using TypeScript utility..."
    # Use the TypeScript reset utility (cleaner and more maintainable)
    node dist/utils/reset-db.js
    
    echo "✅ Database has been reset!"
    
else
    # Local Docker mode
    echo "🐳 Using Docker Compose for local database"
    
    # Check if PostgreSQL container is running
    if ! docker-compose ps postgres 2>/dev/null | grep -q "Up"; then
        echo "❌ PostgreSQL container is not running. Please start it first:"
        echo "   docker-compose up -d postgres"
        exit 1
    fi
    
    # Drop and recreate database
    echo "🗑️  Dropping existing database..."
    docker-compose exec -T postgres psql -U postgres -c "DROP DATABASE IF EXISTS auction_db;" || true
    
    echo "📝 Creating new database..."
    docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE auction_db;"
    
    # Run migrations
    echo "🗄️  Running migrations..."
    npm run build
    npm run migrate
    
    echo "✅ Database has been reset!"
fi

echo ""
