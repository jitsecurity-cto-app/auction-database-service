# Feature 3: Auction Scheduling
# EventBridge Scheduler, Step Functions state machine, scheduler Lambda

# ─── Scheduler Lambda ─────────────────────────────────────────────────────────

resource "aws_iam_role" "scheduler_worker" {
  name = "${var.project_name}-scheduler-worker-${var.environment}"

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
    Name    = "${var.project_name}-scheduler-worker-${var.environment}"
    Feature = "scheduling"
  }
}

resource "aws_iam_role_policy" "scheduler_worker" {
  name = "${var.project_name}-scheduler-worker-policy-${var.environment}"
  role = aws_iam_role.scheduler_worker.id

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
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = aws_sqs_queue.notifications.arn
      }
    ]
  })
}

resource "aws_lambda_function" "scheduler_worker" {
  function_name = "${var.project_name}-scheduler-${var.environment}"
  description   = "Activates scheduled auctions and closes expired ones"
  handler       = "workers/schedulerWorker.handler"
  runtime       = "nodejs20.x"
  timeout       = 120
  memory_size   = 256

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  role = aws_iam_role.scheduler_worker.arn

  environment {
    variables = {
      NODE_ENV                = var.environment
      DATABASE_URL            = "postgresql://${aws_db_instance.main.username}:${urlencode(var.db_password)}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}?sslmode=no-verify"
      NOTIFICATIONS_QUEUE_URL = aws_sqs_queue.notifications.url
    }
  }

  vpc_config {
    subnet_ids         = data.aws_subnets.default.ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = {
    Name    = "${var.project_name}-scheduler-${var.environment}"
    Feature = "scheduling"
  }
}

resource "aws_cloudwatch_log_group" "scheduler_worker" {
  name              = "/aws/lambda/${aws_lambda_function.scheduler_worker.function_name}"
  retention_in_days = var.log_retention_days

  tags = {
    Name    = "${var.project_name}-scheduler-logs-${var.environment}"
    Feature = "scheduling"
  }
}

# ─── EventBridge Scheduler ────────────────────────────────────────────────────

resource "aws_iam_role" "scheduler_eventbridge" {
  name = "${var.project_name}-scheduler-eb-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "scheduler.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "scheduler_eventbridge" {
  name = "${var.project_name}-scheduler-eb-policy-${var.environment}"
  role = aws_iam_role.scheduler_eventbridge.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "states:StartExecution"
        Resource = aws_sfn_state_machine.auction_scheduler.arn
      }
    ]
  })
}

resource "aws_scheduler_schedule" "auction_scheduler" {
  name       = "${var.project_name}-auction-scheduler-${var.environment}"
  group_name = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = "rate(1 minute)"

  target {
    arn      = aws_sfn_state_machine.auction_scheduler.arn
    role_arn = aws_iam_role.scheduler_eventbridge.arn

    input = jsonencode({
      triggered_at = "scheduled"
    })
  }

  state = "ENABLED"
}

# ─── Step Functions State Machine ─────────────────────────────────────────────

resource "aws_iam_role" "step_functions" {
  name = "${var.project_name}-sfn-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "step_functions" {
  name = "${var.project_name}-sfn-policy-${var.environment}"
  role = aws_iam_role.step_functions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "lambda:InvokeFunction"
        Resource = aws_lambda_function.scheduler_worker.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_sfn_state_machine" "auction_scheduler" {
  name     = "${var.project_name}-auction-scheduler-${var.environment}"
  role_arn = aws_iam_role.step_functions.arn

  definition = jsonencode({
    Comment = "Auction scheduler - activates scheduled auctions and closes expired ones"
    StartAt = "ProcessAuctions"
    States = {
      ProcessAuctions = {
        Type     = "Task"
        Resource = aws_lambda_function.scheduler_worker.arn
        # Input injection vulnerability: unsanitized event data passed to Lambda
        End      = true
        Retry = [
          {
            ErrorEquals     = ["States.TaskFailed"]
            IntervalSeconds = 5
            MaxAttempts     = 2
            BackoffRate     = 2.0
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next        = "SchedulerFailed"
          }
        ]
      }
      SchedulerFailed = {
        Type  = "Fail"
        Error = "SchedulerError"
        Cause = "Auction scheduler Lambda failed after retries"
      }
    }
  })

  tags = {
    Name    = "${var.project_name}-auction-scheduler-${var.environment}"
    Feature = "scheduling"
  }
}

# ─── Outputs ──────────────────────────────────────────────────────────────────

output "scheduler_function_name" {
  description = "Scheduler Lambda function name"
  value       = aws_lambda_function.scheduler_worker.function_name
}

output "step_function_arn" {
  description = "Step Functions state machine ARN"
  value       = aws_sfn_state_machine.auction_scheduler.arn
}

output "eventbridge_schedule_name" {
  description = "EventBridge schedule name"
  value       = aws_scheduler_schedule.auction_scheduler.name
}
