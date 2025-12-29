#!/bin/bash
# Local development teardown script
# This script tears down the local development environment

set -e

echo "🧹 Tearing down local development environment..."

# Stop and remove Docker containers
echo "🛑 Stopping Docker containers..."
docker-compose down -v

echo "✅ Local development environment has been torn down!"
echo ""
echo "To remove all data (including volumes):"
echo "  docker-compose down -v"
echo ""

