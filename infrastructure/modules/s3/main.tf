# S3 Bucket for ClipShare video storage
resource "aws_s3_bucket" "clipshare_bucket" {
  bucket = var.bucket_name

  tags = merge(
    {
      Name        = var.bucket_name
      Project     = "ClipShare"
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}

# Enable versioning for data protection
resource "aws_s3_bucket_versioning" "clipshare_versioning" {
  bucket = aws_s3_bucket.clipshare_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "clipshare_encryption" {
  bucket = aws_s3_bucket.clipshare_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access for security (adjusted for CloudFront logs)
resource "aws_s3_bucket_public_access_block" "clipshare_pab" {
  bucket = aws_s3_bucket.clipshare_bucket.id

  block_public_acls       = false  # CloudFront needs this for logs
  block_public_policy     = true   # Keep public policy blocked
  ignore_public_acls      = true   # Ignore existing public ACLs
  restrict_public_buckets = true   # Restrict public buckets
}

# Lifecycle rules for cost optimization
resource "aws_s3_bucket_lifecycle_configuration" "clipshare_lifecycle" {
  bucket = aws_s3_bucket.clipshare_bucket.id

  rule {
    id     = "clipshare_videos"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# CORS configuration for Electron app uploads
resource "aws_s3_bucket_cors_configuration" "clipshare_cors" {
  bucket = aws_s3_bucket.clipshare_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# CloudFront Origin Access Identity for secure access
resource "aws_cloudfront_origin_access_identity" "clipshare_oai" {
  comment = "OAI for ClipShare S3 bucket"
}

# Bucket policy to allow CloudFront access
resource "aws_s3_bucket_policy" "clipshare_bucket_policy" {
  bucket = aws_s3_bucket.clipshare_bucket.id
  policy = data.aws_iam_policy_document.clipshare_bucket_policy.json
}

data "aws_iam_policy_document" "clipshare_bucket_policy" {
  statement {
    principals {
      type        = "AWS"
      identifiers = [aws_cloudfront_origin_access_identity.clipshare_oai.iam_arn]
    }

    actions = [
      "s3:GetObject",
    ]

    resources = [
      "${aws_s3_bucket.clipshare_bucket.arn}/*",
    ]
  }
}