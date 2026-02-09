terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Optional: State management backend
  # backend "s3" {
  #   bucket         = "clipshare-terraform-state"
  #   key            = "terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "terraform-state-lock"
  # }
}

# Configure AWS provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ClipShare"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# S3 module for video storage
module "s3" {
  source = "./modules/s3"

  bucket_name     = var.bucket_name
  allowed_origins = var.allowed_origins
  tags            = var.tags
}

# ACM certificate for custom domain
module "acm" {
  source = "./modules/acm"

  domain_name               = var.domain_name
  route53_zone_name         = var.route53_zone_name
  subject_alternative_names = var.acm_subject_alternative_names
  tags                      = var.tags

  depends_on = [module.s3]
}

# CloudFront module for CDN
module "cloudfront" {
  source = "./modules/cloudfront"

  domain_name           = var.domain_name
  aliases               = var.cloudfront_aliases
  s3_bucket_id          = module.s3.bucket_name
  s3_bucket_domain_name = module.s3.bucket_regional_domain_name
  cloudfront_oai_arn    = module.s3.cloudfront_oai_arn
  certificate_arn       = module.acm.certificate_arn
  tags                  = var.tags

  depends_on = [module.s3, module.acm]
}

# Route53 module for DNS management
module "route53" {
  source = "./modules/route53"

  domain_name               = var.domain_name
  route53_zone_name         = var.route53_zone_name
  cloudfront_domain_name    = module.cloudfront.distribution_domain_name
  cloudfront_hosted_zone_id = module.cloudfront.distribution_hosted_zone_id
  create_apex_record        = var.create_apex_record
  create_www_record         = var.create_www_record
  custom_records            = var.custom_dns_records
  create_health_check       = var.create_health_check
  health_check_path         = var.health_check_path
  tags                      = var.tags

  depends_on = [module.cloudfront]
}