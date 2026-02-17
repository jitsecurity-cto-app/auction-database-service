# Feature 1: Auction Image Uploads
# S3 bucket for auction images + CloudFront distribution with thumbnail resizing

# S3 Bucket for auction images
resource "aws_s3_bucket" "images" {
  bucket = "${var.project_name}-images-${var.environment}"

  tags = {
    Name    = "${var.project_name}-images-${var.environment}"
    Feature = "auction-images"
  }
}

# Intentionally permissive CORS (security vulnerability for lab)
resource "aws_s3_bucket_cors_configuration" "images" {
  bucket = aws_s3_bucket.images.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"] # Intentionally permissive (security vulnerability)
    expose_headers  = ["ETag", "Content-Length"]
    max_age_seconds = 3600
  }
}

# Disable public access block (intentional for lab — security vulnerability)
resource "aws_s3_bucket_public_access_block" "images" {
  bucket = aws_s3_bucket.images.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Public read policy (intentional — security vulnerability: S3 data exfiltration)
resource "aws_s3_bucket_policy" "images_public_read" {
  bucket = aws_s3_bucket.images.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.images.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.images]
}

# CloudFront Function for thumbnail resizing (on-the-fly via URL rewriting)
resource "aws_cloudfront_function" "image_resize" {
  name    = "${var.project_name}-image-resize-${var.environment}"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite thumbnail requests to resized image paths"
  publish = true

  code = <<-EOF
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      // If requesting /thumbnails/*, rewrite to add resize parameters
      if (uri.startsWith('/thumbnails/')) {
        // Strip /thumbnails/ prefix — serve original (thumbnail generation is a stub)
        request.uri = uri.replace('/thumbnails/', '/');
      }

      return request;
    }
  EOF
}

# CloudFront Origin Access Control for images
resource "aws_cloudfront_origin_access_control" "images" {
  name                              = "${var.project_name}-images-oac-${var.environment}"
  description                       = "OAC for auction images S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution for images
resource "aws_cloudfront_distribution" "images" {
  origin {
    domain_name              = aws_s3_bucket.images.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.images.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.images.id
  }

  enabled         = true
  is_ipv6_enabled = true
  comment         = "Auction images CDN - ${var.environment}"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.images.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 1 day
    max_ttl                = 31536000 # 1 year

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.image_resize.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name    = "${var.project_name}-images-cdn-${var.environment}"
    Feature = "auction-images"
  }
}

# Add S3 permissions to Lambda role
resource "aws_iam_role_policy" "lambda_s3_images" {
  name = "${var.project_name}-lambda-s3-images-${var.environment}"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.images.arn,
          "${aws_s3_bucket.images.arn}/*"
        ]
      }
    ]
  })
}

# Outputs
output "images_bucket_name" {
  description = "S3 bucket name for auction images"
  value       = aws_s3_bucket.images.bucket
}

output "images_cdn_url" {
  description = "CloudFront distribution URL for auction images"
  value       = "https://${aws_cloudfront_distribution.images.domain_name}"
}

output "images_cdn_distribution_id" {
  description = "CloudFront distribution ID for images"
  value       = aws_cloudfront_distribution.images.id
}
