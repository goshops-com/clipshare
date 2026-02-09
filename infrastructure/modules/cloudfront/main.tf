# CloudFront Distribution
resource "aws_cloudfront_distribution" "clipshare_cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "ClipShare CDN distribution"
  default_root_object = ""

  # Origin configuration for S3 bucket
  origin {
    domain_name = var.s3_bucket_domain_name
    origin_id   = var.s3_bucket_id

    s3_origin_config {
      origin_access_identity = "origin-access-identity/cloudfront/${replace(var.cloudfront_oai_arn, "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ", "")}"
    }
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = var.s3_bucket_id
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # Cache behavior for video uploads (PUT/POST operations)
  ordered_cache_behavior {
    path_pattern           = "*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = var.s3_bucket_id
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Aliases for custom domain
  aliases = var.aliases

  # Custom SSL certificate
  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Restrictions (allow all)
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Custom error pages
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
    error_caching_min_ttl = 0
  }

  # Logging configuration (disabled to avoid ACL issues)
  # logging_config {
  #   include_cookies = false
  #   bucket          = var.s3_bucket_domain_name
  #   prefix          = "cloudfront-logs/"
  # }

  tags = merge(
    {
      Name      = "clipshare-cdn"
      Project   = "ClipShare"
      ManagedBy = "Terraform"
    },
    var.tags
  )
}