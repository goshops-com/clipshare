output "bucket_name" {
  description = "The name of the S3 bucket"
  value       = aws_s3_bucket.clipshare_bucket.id
}

output "bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = aws_s3_bucket.clipshare_bucket.arn
}

output "bucket_domain_name" {
  description = "The domain name of the S3 bucket"
  value       = aws_s3_bucket.clipshare_bucket.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "The regional domain name of the S3 bucket"
  value       = aws_s3_bucket.clipshare_bucket.bucket_regional_domain_name
}

output "cloudfront_oai_arn" {
  description = "The ARN of the CloudFront Origin Access Identity"
  value       = aws_cloudfront_origin_access_identity.clipshare_oai.iam_arn
}

output "cloudfront_oai_id" {
  description = "The ID of the CloudFront Origin Access Identity"
  value       = aws_cloudfront_origin_access_identity.clipshare_oai.id
}