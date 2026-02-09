output "distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.clipshare_cdn.id
}

output "distribution_arn" {
  description = "The ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.clipshare_cdn.arn
}

output "distribution_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.clipshare_cdn.domain_name
}

output "distribution_hosted_zone_id" {
  description = "The hosted zone ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.clipshare_cdn.hosted_zone_id
}

output "certificate_arn" {
  description = "The ARN of the ACM certificate"
  value       = var.certificate_arn
}

output "status" {
  description = "The status of the CloudFront distribution"
  value       = aws_cloudfront_distribution.clipshare_cdn.status
}