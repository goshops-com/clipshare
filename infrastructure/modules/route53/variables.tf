variable "domain_name" {
  description = "The root domain name"
  type        = string
}

variable "route53_zone_name" {
  description = "The Route53 hosted zone name"
  type        = string
}

variable "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  type        = string
}

variable "cloudfront_hosted_zone_id" {
  description = "The hosted zone ID of the CloudFront distribution"
  type        = string
}

variable "create_apex_record" {
  description = "Whether to create an apex (root) domain record"
  type        = bool
  default     = false
}

variable "create_www_record" {
  description = "Whether to create a www subdomain record"
  type        = bool
  default     = true
}

variable "custom_records" {
  description = "Map of custom DNS records to create (key: subdomain, value: unused but required for Terraform)"
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
  description = "A map of tags to assign to the resources"
  type        = map(string)
  default     = {}
}