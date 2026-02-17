# Feature 5: Real-Time Bidding
# API Gateway WebSocket API, DynamoDB connection tracking, WebSocket Lambda

# ─── DynamoDB Connection Tracking ─────────────────────────────────────────────

resource "aws_dynamodb_table" "ws_connections" {
  name         = "${var.project_name}-ws-connections-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "auction_id"
  range_key    = "connection_id"

  attribute {
    name = "auction_id"
    type = "S"
  }

  attribute {
    name = "connection_id"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name    = "${var.project_name}-ws-connections-${var.environment}"
    Feature = "real-time-bidding"
  }
}

# ─── WebSocket Lambda ─────────────────────────────────────────────────────────

resource "aws_iam_role" "websocket_handler" {
  name = "${var.project_name}-websocket-handler-${var.environment}"

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

resource "aws_iam_role_policy" "websocket_handler" {
  name = "${var.project_name}-websocket-handler-policy-${var.environment}"
  role = aws_iam_role.websocket_handler.id

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
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.ws_connections.arn,
          "${aws_dynamodb_table.ws_connections.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = "execute-api:ManageConnections"
        Resource = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
      }
    ]
  })
}

resource "aws_lambda_function" "websocket_handler" {
  function_name = "${var.project_name}-websocket-handler-${var.environment}"
  description   = "Handles WebSocket connections for real-time bidding"
  handler       = "workers/websocketHandlers.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  role = aws_iam_role.websocket_handler.arn

  environment {
    variables = {
      NODE_ENV                       = var.environment
      WEBSOCKET_CONNECTIONS_TABLE    = aws_dynamodb_table.ws_connections.name
    }
  }

  tags = {
    Name    = "${var.project_name}-websocket-handler-${var.environment}"
    Feature = "real-time-bidding"
  }
}

resource "aws_cloudwatch_log_group" "websocket_handler" {
  name              = "/aws/lambda/${aws_lambda_function.websocket_handler.function_name}"
  retention_in_days = var.log_retention_days
}

# ─── API Gateway WebSocket API ────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${var.project_name}-ws-${var.environment}"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = {
    Name    = "${var.project_name}-ws-${var.environment}"
    Feature = "real-time-bidding"
  }
}

# Integration
resource "aws_apigatewayv2_integration" "websocket" {
  api_id           = aws_apigatewayv2_api.websocket.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.websocket_handler.invoke_arn
}

# Routes
resource "aws_apigatewayv2_route" "ws_connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket.id}"
  # No authorizer (intentional vulnerability: unauthenticated WebSocket connections)
}

resource "aws_apigatewayv2_route" "ws_disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket.id}"
}

resource "aws_apigatewayv2_route" "ws_default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.websocket.id}"
}

resource "aws_apigatewayv2_route" "ws_send_message" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "sendMessage"
  target    = "integrations/${aws_apigatewayv2_integration.websocket.id}"
}

# Stage
resource "aws_apigatewayv2_stage" "websocket" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = var.environment
  auto_deploy = true

  tags = {
    Name    = "${var.project_name}-ws-stage-${var.environment}"
    Feature = "real-time-bidding"
  }
}

# Lambda permission for WebSocket API
resource "aws_lambda_permission" "websocket" {
  statement_id  = "AllowWebSocketAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
}

# Add WebSocket broadcast permissions to main API Lambda
resource "aws_iam_role_policy" "lambda_websocket" {
  name = "${var.project_name}-lambda-websocket-${var.environment}"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:Query",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          aws_dynamodb_table.ws_connections.arn,
          "${aws_dynamodb_table.ws_connections.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = "execute-api:ManageConnections"
        Resource = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
      }
    ]
  })
}

# ─── Outputs ──────────────────────────────────────────────────────────────────

output "websocket_api_url" {
  description = "WebSocket API URL"
  value       = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "websocket_connections_table" {
  description = "DynamoDB table name for WebSocket connections"
  value       = aws_dynamodb_table.ws_connections.name
}
