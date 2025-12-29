#!/bin/bash
# Infrastructure destruction script
# This script destroys AWS infrastructure using Terraform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

echo "⚠️  WARNING: This will destroy all AWS infrastructure!"
echo "   This action cannot be undone."
echo ""

# Ask for confirmation
read -p "Are you sure you want to destroy the infrastructure? (type 'destroy' to confirm): " confirm
if [ "$confirm" != "destroy" ]; then
    echo "❌ Destruction cancelled."
    exit 1
fi

cd "$TERRAFORM_DIR"

# Check if Terraform is initialized
if [ ! -d .terraform ]; then
    echo "❌ Terraform not initialized. Run deploy-infra.sh first."
    exit 1
fi

# Destroy infrastructure
echo "🗑️  Destroying infrastructure..."
terraform destroy

echo ""
echo "✅ Infrastructure has been destroyed!"
echo ""

