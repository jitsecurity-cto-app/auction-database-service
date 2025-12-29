#!/bin/bash
# Database reset script
# This script resets the local database

set -e

echo "🔄 Resetting local database..."

# Check if PostgreSQL container is running
if ! docker-compose ps postgres | grep -q "Up"; then
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
echo ""

