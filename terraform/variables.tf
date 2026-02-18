variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "auction-lab"
}

# Database Configuration
variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "auction_db"
}

variable "db_username" {
  description = "Master username for the database"
  type        = string
  default     = "auctionlab"
}

variable "db_password" {
  description = "Master password for the database"
  type        = string
  sensitive   = true
  # Should be provided via terraform.tfvars or environment variable
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro" # Free tier eligible
}

variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for autoscaling in GB"
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

variable "db_publicly_accessible" {
  description = "Whether the database should be publicly accessible"
  type        = bool
  default     = true # Public access needed for CI/CD migrations (intentional for lab)
}

variable "enable_performance_insights" {
  description = "Enable Performance Insights"
  type        = bool
  default     = false # Disable for cost savings in lab
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false # Disable for lab environment
}

# Lambda Configuration (simple, cost-effective for lab)
variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30 # Max 30s for HTTP API Gateway
}

variable "lambda_memory" {
  description = "Lambda function memory in MB"
  type        = number
  default     = 512 # Sufficient for simple API
}

# Logging Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

# Custom Domain
variable "domain_name" {
  description = "Custom domain name for API Gateway (e.g., api.auctionspulse.com)"
  type        = string
  default     = ""
}

variable "hosted_zone_name" {
  description = "Route53 hosted zone name (e.g., auctionspulse.com)"
  type        = string
  default     = "auctionspulse.com"
}

# JWT Secret
variable "jwt_secret" {
  description = "JWT secret key (intentionally weak for lab)"
  type        = string
  sensitive   = true
  default     = "weak-secret-key"
}

