variable "aws_region" {
  description = "The AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "The environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "production"
}

variable "bucket_name" {
  description = "The name of the S3 bucket for ClipShare videos"
  type        = string
}

variable "domain_name" {
  description = "The root domain name for the ClipShare deployment"
  type        = string
}

variable "route53_zone_name" {
  description = "The Route53 hosted zone name (usually the root domain)"
  type        = string
}

variable "acm_subject_alternative_names" {
  description = "List of subject alternative names for the ACM certificate"
  type        = list(string)
  default     = []
}

variable "cloudfront_aliases" {
  description = "List of aliases for the CloudFront distribution"
  type        = list(string)
  default     = []
}

variable "allowed_origins" {
  description = "List of allowed origins for CORS (for Electron app uploads)"
  type        = list(string)
  default     = ["*"]
}

variable "create_apex_record" {
  description = "Whether to create an apex (root) domain DNS record"
  type        = bool
  default     = false
}

variable "create_www_record" {
  description = "Whether to create a www subdomain DNS record"
  type        = bool
  default     = true
}

variable "custom_dns_records" {
  description = "Map of custom DNS records to create (e.g., {\"app\" = \"\"} for app.domain.com)"
  type        = map(string)
  default     = {}
}

variable "create_health_check" {
  description = "Whether to create a Route53 health check"
  type        = bool
  default     = false
}

variable "health_check_path" {
  description = "The path to check for the health check"
  type        = string
  default     = "/"
}

variable "tags" {
  description = "A map of tags to assign to all resources"
  type        = map(string)
  default     = {}
}