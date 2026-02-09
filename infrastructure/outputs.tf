# S3 Outputs
output "s3_bucket_name" {
  description = "The name of the S3 bucket"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = module.s3.bucket_arn
}

output "s3_bucket_domain_name" {
  description = "The domain name of the S3 bucket"
  value       = module.s3.bucket_domain_name
}

# CloudFront Outputs
output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_distribution_arn" {
  description = "The ARN of the CloudFront distribution"
  value       = module.cloudfront.distribution_arn
}

output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = module.cloudfront.distribution_domain_name
}

output "cloudfront_status" {
  description = "The status of the CloudFront distribution"
  value       = module.cloudfront.status
}

output "acm_certificate_arn" {
  description = "The ARN of the ACM certificate"
  value       = module.acm.certificate_arn
}

output "acm_certificate_domain" {
  description = "The domain name of the ACM certificate"
  value       = module.acm.certificate_domain_name
}

output "acm_certificate_status" {
  description = "The status of the ACM certificate"
  value       = module.acm.certificate_status
}

output "acm_validation_records" {
  description = "The DNS validation records created for the certificate"
  value       = module.acm.validation_records
}

# Route53 Outputs
output "route53_zone_id" {
  description = "The ID of the Route53 hosted zone"
  value       = module.route53.zone_id
}

output "route53_zone_name" {
  description = "The name of the Route53 hosted zone"
  value       = module.route53.zone_name
}

# Configuration for ClipShare app
output "clipshare_config" {
  description = "Configuration values to use in ClipShare .env file"
  value = {
    s3_bucket_name = module.s3.bucket_name
    s3_region      = var.aws_region
    cloudfront_url = "https://${module.cloudfront.distribution_domain_name}"
    custom_url     = var.domain_name != "" ? "https://${var.domain_name}" : "https://${module.cloudfront.distribution_domain_name}"
  }
}