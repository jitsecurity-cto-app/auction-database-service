# Terraform Infrastructure

This directory contains Terraform configuration for deploying AWS infrastructure for the database service.

## Prerequisites

1. **Terraform** (>= 1.0) - [Install Terraform](https://www.terraform.io/downloads)
2. **AWS CLI** configured with appropriate credentials
3. **AWS Account** with permissions to create:
   - RDS instances
   - Security groups
   - IAM roles
   - VPC resources (if using custom VPC)

## Quick Start

### 1. Configure Variables

Copy the example variables file and update it:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set:
- `db_password` - Strong password for the database
- `aws_region` - Your preferred AWS region
- Other variables as needed

### 2. Initialize Terraform

```bash
cd terraform
terraform init
```

### 3. Plan Deployment

```bash
terraform plan
```

### 4. Deploy Infrastructure

```bash
terraform apply
```

Or use the deployment script:

```bash
../scripts/deploy-infra.sh
```

### 5. Get Database Connection Info

After deployment, get the database connection URL:

```bash
terraform output database_url
```

Save this securely - it contains sensitive credentials.

## Configuration

### Variables

Key variables in `terraform.tfvars`:

- `db_password` - Database master password (required)
- `db_instance_class` - RDS instance size (default: `db.t3.micro` for free tier)
- `db_allocated_storage` - Initial storage in GB (default: 20)
- `db_publicly_accessible` - Set to `true` for testing, `false` for production
- `enable_deletion_protection` - Set to `true` for production

### Cost Optimization

For the lab environment:
- Use `db.t3.micro` (free tier eligible for 12 months)
- Set `enable_performance_insights = false`
- Set `enable_deletion_protection = false`
- Use minimal storage (20GB)

Estimated cost: **$0-15/month** (free tier) or **$15-30/month** (after free tier)

## Destroying Infrastructure

⚠️ **Warning**: This will delete all infrastructure and data!

```bash
terraform destroy
```

Or use the destruction script:

```bash
../scripts/destroy-infra.sh
```

## Outputs

After deployment, Terraform outputs:

- `db_endpoint` - RDS endpoint address
- `db_port` - Database port (5432)
- `db_name` - Database name
- `database_url` - Full connection URL (sensitive)

## Security Notes

1. **Never commit `terraform.tfvars`** - It contains sensitive passwords
2. **Use AWS Secrets Manager** for production passwords
3. **Enable deletion protection** in production
4. **Restrict security groups** to only necessary IPs
5. **Use private subnets** for production databases

## Troubleshooting

### Terraform State Lock

If you get a state lock error:

```bash
terraform force-unlock <LOCK_ID>
```

### Database Connection Issues

1. Check security group allows your IP
2. Verify `db_publicly_accessible` is set correctly
3. Check VPC and subnet configuration
4. Verify database is in "available" state

### Cost Alerts

Set up AWS billing alerts to monitor costs:

```bash
aws budgets create-budget \
  --account-id <your-account-id> \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

## Next Steps

After deploying infrastructure:

1. Update your `.env` file with the database URL
2. Run migrations: `npm run migrate`
3. Test connection: `npm run dev`
4. Deploy the application (see main README)

