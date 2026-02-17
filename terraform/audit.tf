# Feature 4: Audit Trail
# DynamoDB table for audit events with GSI on actor_id

resource "aws_dynamodb_table" "audit" {
  name         = "${var.project_name}-audit-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  attribute {
    name = "actor_id"
    type = "S"
  }

  # GSI for querying by actor
  global_secondary_index {
    name            = "actor-index"
    hash_key        = "actor_id"
    range_key       = "sk"
    projection_type = "ALL"
  }

  # Enable DynamoDB Streams for anomaly detection (optional)
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name    = "${var.project_name}-audit-${var.environment}"
    Feature = "audit-trail"
  }
}

# Add DynamoDB audit permissions to main API Lambda
resource "aws_iam_role_policy" "lambda_audit" {
  name = "${var.project_name}-lambda-audit-${var.environment}"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:GetItem"
        ]
        Resource = [
          aws_dynamodb_table.audit.arn,
          "${aws_dynamodb_table.audit.arn}/index/*"
        ]
      }
    ]
  })
}

# ─── Outputs ──────────────────────────────────────────────────────────────────

output "audit_table_name" {
  description = "DynamoDB table name for audit trail"
  value       = aws_dynamodb_table.audit.name
}

output "audit_table_stream_arn" {
  description = "DynamoDB Streams ARN for audit table"
  value       = aws_dynamodb_table.audit.stream_arn
}
