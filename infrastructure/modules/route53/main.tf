# Get the Route53 hosted zone
data "aws_route53_zone" "selected" {
  name         = var.route53_zone_name
  private_zone = false
}

# Route53 record for apex domain (if needed)
resource "aws_route53_record" "apex" {
  count   = var.create_apex_record ? 1 : 0
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id               = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# Route53 record for www subdomain
resource "aws_route53_record" "www" {
  count   = var.create_www_record ? 1 : 0
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id               = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# Optional: Create additional custom records
resource "aws_route53_record" "custom" {
  for_each = var.custom_records
  zone_id   = data.aws_route53_zone.selected.zone_id
  name      = each.key
  type      = "A"

  alias {
    name                   = var.cloudfront_domain_name
    zone_id               = var.cloudfront_hosted_zone_id
    evaluate_target_health = false
  }
}

# Optional: Health check for monitoring
resource "aws_route53_health_check" "clipshare_health" {
  count             = var.create_health_check ? 1 : 0
  fqdn              = var.cloudfront_domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = var.health_check_path
  failure_threshold = "3"
  request_interval  = "30"

  tags = merge(
    {
      Name      = "clipshare-health-check"
      Project   = "ClipShare"
      ManagedBy = "Terraform"
    },
    var.tags
  )
}