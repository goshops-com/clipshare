# ClipShare Infrastructure Deployment Guide

This guide provides comprehensive instructions for deploying the ClipShare infrastructure on AWS using Terraform.

## Overview

The ClipShare infrastructure consists of:

- **S3 Bucket**: Private storage for video files with lifecycle policies
- **CloudFront CDN**: Global content delivery network with SSL
- **ACM Certificate**: SSL/TLS certificate for HTTPS
- **Route53 DNS**: DNS management for custom domains

## Prerequisites

### Required Tools

1. **Terraform** (>= 1.0)
   ```bash
   # Install Terraform
   curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
   sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
   sudo apt-get update && sudo apt-get install terraform
   ```

2. **AWS CLI** (>= 2.0)
   ```bash
   # Install AWS CLI
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

### AWS Requirements

1. **AWS Account** with appropriate permissions:
   - S3 (Full Access)
   - CloudFront (Full Access)
   - ACM (Full Access)
   - Route53 (Full Access)
   - IAM (Pass role)

2. **Configured AWS Credentials**:
   ```bash
   aws configure
   ```

3. **Registered Domain** in Route53 (optional but recommended)

### Domain Setup (Optional but Recommended)

If you want to use a custom domain:

1. Purchase a domain through AWS Route53 or another registrar
2. Update nameservers to Route53 if purchased elsewhere
3. Request an ACM certificate for your domain
   - Certificate must be in `us-east-1` for CloudFront
   - Validate via DNS or email

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/goshops-com/clipshare.git
cd clipshare/infrastructure

# Copy the configuration template
cp terraform.tfvars.example terraform.tfvars
```

### 2. Configure Variables

Edit `terraform.tfvars` with your values:

```hcl
# Required
aws_region = "us-east-1"
bucket_name = "clipshare-videos-yourdomain"  # Must be globally unique
domain_name = "yourdomain.com"

# Optional
cloudfront_aliases = ["yourdomain.com", "www.yourdomain.com"]
allowed_origins = ["https://yourdomain.com", "app://localhost"]
create_www_record = true
create_apex_record = false
```

### 3. Deploy Infrastructure

```bash
# Run the deployment script
./scripts/deploy.sh
```

The script will:
- Validate prerequisites
- Initialize Terraform
- Show deployment plan
- Apply the configuration
- Display outputs for ClipShare configuration

### 4. Configure ClipShare

Update your ClipShare `.env` file with the outputs:

```bash
# Example output from terraform
S3_BUCKET_NAME=clipshare-videos-yourdomain
S3_REGION=us-east-1
ENDPOINT=https://yourdomain.com
URL_PREFIX=https://yourdomain.com/
ACL=public-read
```

## Manual Deployment

If you prefer to deploy manually without the scripts:

```bash
# Navigate to infrastructure directory
cd infrastructure

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Apply deployment
terraform apply
```

## Configuration Options

### S3 Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `bucket_name` | S3 bucket name (must be globally unique) | - | Yes |
| `allowed_origins` | CORS allowed origins | `["*"]` | No |

### CloudFront Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `domain_name` | Root domain for SSL certificate | - | Yes |
| `cloudfront_aliases` | CloudFront distribution aliases | `[]` | No |

### DNS Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `create_apex_record` | Create root domain DNS record | `false` | No |
| `create_www_record` | Create www subdomain DNS record | `true` | No |
| `custom_dns_records` | Additional DNS records | `{}` | No |

## Advanced Configuration

### State Management

For team collaboration, configure a remote backend:

```hcl
# In main.tf, uncomment and configure:
terraform {
  backend "s3" {
    bucket         = "clipshare-terraform-state"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
```

### Custom Modules

The infrastructure is organized into reusable modules:

- `modules/s3`: S3 bucket with security best practices
- `modules/cloudfront`: CloudFront distribution with SSL
- `modules/route53`: DNS management

You can use these modules independently or customize them for your needs.

## Cost Optimization

### S3 Lifecycle Policies

The configuration includes automatic lifecycle policies:
- 30 days: Move to Standard-IA
- 90 days: Move to Glacier
- 365 days: Move to Deep Archive

### CloudFront

CloudFront costs are based on data transfer. Consider:
- Enable compression to reduce bandwidth
- Configure appropriate cache TTLs
- Monitor usage in AWS Cost Explorer

## Security Considerations

### S3 Security

- Bucket is private by default
- Only CloudFront can access bucket content
- Server-side encryption enabled (AES256)
- Public access blocked

### Network Security

- HTTPS-only via CloudFront
- TLS 1.2+ minimum protocol
- Secure headers automatically added

## Monitoring and Maintenance

### CloudWatch Metrics

Monitor these key metrics:
- S3: `BucketSizeBytes`, `NumberOfObjects`
- CloudFront: `Requests`, `BytesDownloaded`, `ErrorRate`

### Backup Strategy

- S3 versioning enabled for data protection
- Consider Cross-Region Replication for critical data
- Regular backups of Terraform state

## Troubleshooting

### Common Issues

1. **Bucket Name Already Exists**
   ```
   Error: S3 bucket already exists
   ```
   Solution: Choose a unique bucket name

2. **ACM Certificate Not Found**
   ```
   Error: ACM certificate not found
   ```
   Solution: Ensure certificate exists in `us-east-1` and is issued

3. **Domain Validation Failed**
   ```
   Error: Domain validation failed
   ```
   Solution: Check DNS records and ACM validation status

4. **CloudFront Distribution Slow**
   - Wait 15-20 minutes for full propagation
   - Check Origin Access Identity permissions

### Getting Help

1. Check Terraform logs: `terraform show`
2. Verify AWS credentials: `aws sts get-caller-identity`
3. Check AWS CloudFormation events in console
4. Review AWS CloudWatch metrics

## Cleanup

To remove all infrastructure:

```bash
# Backup any important S3 data first
aws s3 sync s3://your-bucket ./backup

# Destroy infrastructure
./scripts/destroy.sh
```

**Warning**: This will permanently delete all resources and data.

## Support

For issues with:
- **ClipShare App**: [ClipShare GitHub Issues](https://github.com/goshops-com/clipshare/issues)
- **Infrastructure**: Create an issue in the repository
- **AWS Services**: [AWS Support](https://aws.amazon.com/support/)