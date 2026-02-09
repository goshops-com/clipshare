# Get Route53 zone for DNS validation
data "aws_route53_zone" "selected" {
  name         = var.route53_zone_name
  private_zone = false
}

# ACM Certificate for custom domain
resource "aws_acm_certificate" "clipshare_cert" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = var.subject_alternative_names

  tags = merge(
    {
      Name      = "${var.domain_name}-cert"
      Project   = "ClipShare"
      ManagedBy = "Terraform"
    },
    var.tags
  )

  lifecycle {
    create_before_destroy = true
  }
}

# DNS validation records for ACM certificate
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.clipshare_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.selected.zone_id
}

# Wait for certificate validation
resource "aws_acm_certificate_validation" "clipshare_cert_validation" {
  certificate_arn         = aws_acm_certificate.clipshare_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}