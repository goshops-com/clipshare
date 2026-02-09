output "certificate_arn" {
  description = "The ARN of the validated ACM certificate"
  value       = aws_acm_certificate_validation.clipshare_cert_validation.certificate_arn
}

output "certificate_domain_name" {
  description = "The domain name of the certificate"
  value       = aws_acm_certificate.clipshare_cert.domain_name
}

output "certificate_status" {
  description = "The status of the certificate"
  value       = aws_acm_certificate.clipshare_cert.status
}

output "validation_records" {
  description = "The DNS validation records created"
  value = {
    for dvo in aws_acm_certificate.clipshare_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
}

output "route53_zone_id" {
  description = "The Route53 zone ID used for validation"
  value       = data.aws_route53_zone.selected.zone_id
}