#!/bin/bash
# Local development setup script
# This script sets up the local development environment

set -e

echo "🚀 Setting up local development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose and try again."
    exit 1
fi

# Start PostgreSQL and database service
echo "📦 Starting Docker containers..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done

echo "✅ PostgreSQL is ready!"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please update it with your configuration."
    else
        echo "⚠️  .env.example not found. Creating basic .env file..."
        cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auction_db
JWT_SECRET=weak-secret-key
PORT=3001
NODE_ENV=development
EOF
        echo "✅ Created basic .env file."
    fi
fi

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Run database migrations
echo "🗄️  Running database migrations..."
npm run build
npm run migrate

echo ""
echo "✅ Local development environment is ready!"
echo ""
echo "To start the development server:"
echo "  npm run dev"
echo ""
echo "To start with Docker Compose:"
echo "  docker-compose up"
echo ""
echo "To stop the environment:"
echo "  docker-compose down"
echo ""

