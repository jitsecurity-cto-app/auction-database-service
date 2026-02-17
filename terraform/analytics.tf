# Feature 6: CRM Analytics Dashboard
# S3 data lake, Athena, Glue Catalog, data export Lambda

# ─── S3 Data Lake Bucket ──────────────────────────────────────────────────────

resource "aws_s3_bucket" "data_lake" {
  bucket = "${var.project_name}-data-lake-${var.environment}"

  tags = {
    Name    = "${var.project_name}-data-lake-${var.environment}"
    Feature = "analytics"
  }
}

# No encryption (intentional security vulnerability: PII in unencrypted data lake)
resource "aws_s3_bucket_server_side_encryption_configuration" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Public access block disabled (intentional vulnerability: S3 data exfiltration)
resource "aws_s3_bucket_public_access_block" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# S3 Bucket for Athena query results
resource "aws_s3_bucket" "athena_results" {
  bucket = "${var.project_name}-athena-results-${var.environment}"

  tags = {
    Name    = "${var.project_name}-athena-results-${var.environment}"
    Feature = "analytics"
  }
}

# ─── Glue Catalog Database ────────────────────────────────────────────────────

resource "aws_glue_catalog_database" "analytics" {
  name = "${replace(var.project_name, "-", "_")}_analytics_${var.environment}"

  description = "Auction Lab analytics database"
}

# Glue table for auctions data
resource "aws_glue_catalog_table" "auctions" {
  name          = "auctions"
  database_name = aws_glue_catalog_database.analytics.name

  table_type = "EXTERNAL_TABLE"

  parameters = {
    EXTERNAL              = "TRUE"
    "classification"      = "json"
    "compressionType"     = "none"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.data_lake.bucket}/auctions/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      serialization_library = "org.openx.data.jsonserde.JsonSerDe"
    }

    columns {
      name = "id"
      type = "int"
    }
    columns {
      name = "title"
      type = "string"
    }
    columns {
      name = "starting_price"
      type = "double"
    }
    columns {
      name = "current_bid"
      type = "double"
    }
    columns {
      name = "status"
      type = "string"
    }
    columns {
      name = "created_by"
      type = "int"
    }
    columns {
      name = "winner_id"
      type = "int"
    }
    columns {
      name = "created_at"
      type = "timestamp"
    }
    columns {
      name = "end_time"
      type = "timestamp"
    }
  }
}

# Glue table for bids data
resource "aws_glue_catalog_table" "bids" {
  name          = "bids"
  database_name = aws_glue_catalog_database.analytics.name

  table_type = "EXTERNAL_TABLE"

  parameters = {
    EXTERNAL         = "TRUE"
    "classification" = "json"
  }

  storage_descriptor {
    location      = "s3://${aws_s3_bucket.data_lake.bucket}/bids/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      serialization_library = "org.openx.data.jsonserde.JsonSerDe"
    }

    columns {
      name = "id"
      type = "int"
    }
    columns {
      name = "auction_id"
      type = "int"
    }
    columns {
      name = "user_id"
      type = "int"
    }
    columns {
      name = "amount"
      type = "double"
    }
    columns {
      name = "created_at"
      type = "timestamp"
    }
  }
}

# ─── Data Export Lambda ───────────────────────────────────────────────────────

resource "aws_iam_role" "data_export" {
  name = "${var.project_name}-data-export-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "data_export" {
  name = "${var.project_name}-data-export-policy-${var.environment}"
  role = aws_iam_role.data_export.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.data_lake.arn,
          "${aws_s3_bucket.data_lake.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_lambda_function" "data_export" {
  function_name = "${var.project_name}-data-export-${var.environment}"
  description   = "Daily RDS to S3 data lake export"
  handler       = "workers/dataExportWorker.handler"
  runtime       = "nodejs20.x"
  timeout       = 300
  memory_size   = 512

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  role = aws_iam_role.data_export.arn

  environment {
    variables = {
      NODE_ENV     = var.environment
      DATABASE_URL = "postgresql://${aws_db_instance.main.username}:${urlencode(var.db_password)}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}?sslmode=no-verify"
      DATA_LAKE_BUCKET = aws_s3_bucket.data_lake.bucket
    }
  }

  vpc_config {
    subnet_ids         = data.aws_subnets.default.ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = {
    Name    = "${var.project_name}-data-export-${var.environment}"
    Feature = "analytics"
  }
}

# Daily EventBridge schedule for data export
resource "aws_scheduler_schedule" "data_export" {
  name       = "${var.project_name}-data-export-${var.environment}"
  group_name = "default"

  flexible_time_window {
    mode = "FLEXIBLE"
    maximum_window_in_minutes = 30
  }

  schedule_expression = "cron(0 2 * * ? *)" # 2 AM daily

  target {
    arn      = aws_lambda_function.data_export.arn
    role_arn = aws_iam_role.scheduler_eventbridge.arn
  }
}

resource "aws_lambda_permission" "data_export_scheduler" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.data_export.function_name
  principal     = "scheduler.amazonaws.com"
}

# Add Athena permissions to main API Lambda
resource "aws_iam_role_policy" "lambda_analytics" {
  name = "${var.project_name}-lambda-analytics-${var.environment}"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "athena:StartQueryExecution",
          "athena:GetQueryExecution",
          "athena:GetQueryResults",
          "athena:StopQueryExecution"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          aws_s3_bucket.data_lake.arn,
          "${aws_s3_bucket.data_lake.arn}/*",
          aws_s3_bucket.athena_results.arn,
          "${aws_s3_bucket.athena_results.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "glue:GetTable",
          "glue:GetTables",
          "glue:GetDatabase",
          "glue:GetDatabases",
          "glue:GetPartitions"
        ]
        Resource = "*"
      }
    ]
  })
}

# ─── Outputs ──────────────────────────────────────────────────────────────────

output "data_lake_bucket" {
  description = "S3 data lake bucket name"
  value       = aws_s3_bucket.data_lake.bucket
}

output "athena_database" {
  description = "Glue catalog database name for Athena"
  value       = aws_glue_catalog_database.analytics.name
}

output "athena_results_bucket" {
  description = "S3 bucket for Athena query results"
  value       = aws_s3_bucket.athena_results.bucket
}
