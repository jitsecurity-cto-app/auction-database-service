#!/bin/bash
# Infrastructure deployment script
# This script deploys AWS infrastructure using Terraform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

echo "🚀 Deploying AWS infrastructure..."

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform is not installed. Please install Terraform and try again."
    exit 1
fi

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' and try again."
    exit 1
fi

cd "$TERRAFORM_DIR"

# Check if terraform.tfvars exists
if [ ! -f terraform.tfvars ]; then
    echo "⚠️  terraform.tfvars not found. Creating from example..."
    if [ -f terraform.tfvars.example ]; then
        cp terraform.tfvars.example terraform.tfvars
        echo "✅ Created terraform.tfvars. Please update it with your values before continuing."
        echo "   Edit terraform.tfvars and set db_password and other required values."
        exit 1
    else
        echo "❌ terraform.tfvars.example not found. Cannot proceed."
        exit 1
    fi
fi

# Initialize Terraform
echo "📦 Initializing Terraform..."
terraform init

# Plan deployment
echo "📋 Planning deployment..."
terraform plan -out=tfplan

# Ask for confirmation
read -p "Do you want to apply these changes? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled."
    rm -f tfplan
    exit 1
fi

# Apply changes
echo "🚀 Applying Terraform changes..."
terraform apply tfplan

# Output connection information
echo ""
echo "✅ Infrastructure deployed successfully!"
echo ""
echo "Database connection information:"
terraform output -json | jq -r '
  "Database Endpoint: \(.db_endpoint.value)\n" +
  "Database Port: \(.db_port.value)\n" +
  "Database Name: \(.db_name.value)\n" +
  "Database Username: \(.db_username.value)\n" +
  "\nDatabase URL (sensitive):\n\(.database_url.value)"
'

echo ""
echo "⚠️  Save the database URL securely. It contains sensitive credentials."
echo ""

