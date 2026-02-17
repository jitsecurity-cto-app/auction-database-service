# Feature 2: Bid Notifications
# SQS queue, SNS topic, DynamoDB table, notification worker Lambda

# ─── SQS Queue ────────────────────────────────────────────────────────────────

resource "aws_sqs_queue" "notifications" {
  name                       = "${var.project_name}-notifications-${var.environment}"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 86400 # 1 day
  receive_wait_time_seconds  = 10    # Long polling

  # No encryption (intentional security vulnerability)
  sqs_managed_sse_enabled = false

  # Dead letter queue for failed messages
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.notifications_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name    = "${var.project_name}-notifications-${var.environment}"
    Feature = "notifications"
  }
}

resource "aws_sqs_queue" "notifications_dlq" {
  name                      = "${var.project_name}-notifications-dlq-${var.environment}"
  message_retention_seconds = 604800 # 7 days

  tags = {
    Name    = "${var.project_name}-notifications-dlq-${var.environment}"
    Feature = "notifications"
  }
}

# Permissive SQS policy (intentional security vulnerability: message tampering)
resource "aws_sqs_queue_policy" "notifications" {
  queue_url = aws_sqs_queue.notifications.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowAnyoneToSendMessages"
        Effect    = "Allow"
        Principal = "*"
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.notifications.arn
      }
    ]
  })
}

# ─── SNS Topic ────────────────────────────────────────────────────────────────

resource "aws_sns_topic" "notifications" {
  name = "${var.project_name}-notifications-${var.environment}"

  tags = {
    Name    = "${var.project_name}-notifications-${var.environment}"
    Feature = "notifications"
  }
}

# ─── DynamoDB Table (Notification History) ────────────────────────────────────

resource "aws_dynamodb_table" "notifications" {
  name         = "${var.project_name}-notifications-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "timestamp"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name    = "${var.project_name}-notifications-${var.environment}"
    Feature = "notifications"
  }
}

# ─── Notification Worker Lambda ───────────────────────────────────────────────

resource "aws_iam_role" "notification_worker" {
  name = "${var.project_name}-notification-worker-${var.environment}"

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

  tags = {
    Name    = "${var.project_name}-notification-worker-${var.environment}"
    Feature = "notifications"
  }
}

resource "aws_iam_role_policy" "notification_worker" {
  name = "${var.project_name}-notification-worker-policy-${var.environment}"
  role = aws_iam_role.notification_worker.id

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
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.notifications.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [aws_sns_topic.notifications.arn, "*"]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
        Resource = aws_dynamodb_table.notifications.arn
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

resource "aws_lambda_function" "notification_worker" {
  function_name = "${var.project_name}-notification-worker-${var.environment}"
  description   = "Processes notification events from SQS"
  handler       = "workers/notificationWorker.handler"
  runtime       = "nodejs20.x"
  timeout       = 60
  memory_size   = 256

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  role = aws_iam_role.notification_worker.arn

  environment {
    variables = {
      NODE_ENV                = var.environment
      DATABASE_URL            = "postgresql://${aws_db_instance.main.username}:${urlencode(var.db_password)}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}?sslmode=no-verify"
      NOTIFICATIONS_TABLE     = aws_dynamodb_table.notifications.name
      NOTIFICATIONS_TOPIC_ARN = aws_sns_topic.notifications.arn
    }
  }

  vpc_config {
    subnet_ids         = data.aws_subnets.default.ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = {
    Name    = "${var.project_name}-notification-worker-${var.environment}"
    Feature = "notifications"
  }
}

# SQS trigger for notification worker
resource "aws_lambda_event_source_mapping" "notifications" {
  event_source_arn = aws_sqs_queue.notifications.arn
  function_name    = aws_lambda_function.notification_worker.arn
  batch_size       = 10
  enabled          = true
}

# CloudWatch Log Group for notification worker
resource "aws_cloudwatch_log_group" "notification_worker" {
  name              = "/aws/lambda/${aws_lambda_function.notification_worker.function_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Name    = "${var.project_name}-notification-worker-logs-${var.environment}"
    Feature = "notifications"
  }
}

# Add SQS and DynamoDB permissions to main API Lambda
resource "aws_iam_role_policy" "lambda_notifications" {
  name = "${var.project_name}-lambda-notifications-${var.environment}"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.notifications.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem"
        ]
        Resource = [
          aws_dynamodb_table.notifications.arn,
          "${aws_dynamodb_table.notifications.arn}/index/*"
        ]
      }
    ]
  })
}

# ─── Outputs ──────────────────────────────────────────────────────────────────

output "notifications_queue_url" {
  description = "SQS queue URL for notifications"
  value       = aws_sqs_queue.notifications.url
}

output "notifications_topic_arn" {
  description = "SNS topic ARN for notifications"
  value       = aws_sns_topic.notifications.arn
}

output "notifications_table_name" {
  description = "DynamoDB table name for notification history"
  value       = aws_dynamodb_table.notifications.name
}
