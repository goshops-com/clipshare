# ClipShare AWS Infrastructure

This directory contains the Terraform configuration for deploying ClipShare infrastructure on AWS.

## 🚀 Quick Start

```bash
# 1. Configure your deployment
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your specific values

# 2. Deploy the infrastructure
./scripts/deploy.sh

# 3. Configure ClipShare with the provided outputs
```

## 📁 Directory Structure

```
infrastructure/
├── main.tf                 # Main Terraform configuration
├── variables.tf           # Input variables
├── outputs.tf             # Output values
├── terraform.tfvars.example # Configuration template
├── modules/               # Re Terraform modules
│   ├── s3/               # S3 bucket configuration
│   ├── cloudfront/       # CloudFront + ACM
│   └── route53/          # Route53 DNS
├── scripts/              # Deployment scripts
│   ├── deploy.sh         # Automated deployment
│   └── destroy.sh        # Cleanup script
└── docs/
    └── deployment.md     # Detailed deployment guide
```

## 🏗️ Architecture

### Components

1. **S3 Module** (`modules/s3/`)
   - Private S3 bucket with encryption
   - Lifecycle policies for cost optimization
   - CORS configuration for ClipShare uploads
   - CloudFront Origin Access Identity

2. **CloudFront Module** (`modules/cloudfront/`)
   - CDN distribution with SSL termination
   - ACM certificate integration
   - Custom cache behaviors for videos
   - Access logging

3. **Route53 Module** (`modules/route53/`)
   - DNS record management
   - Custom domain aliases
   - Optional health checks

### Security Features

- ✅ Private S3 buckets (no public access)
- ✅ Server-side encryption (AES256)
- ✅ HTTPS-only via CloudFront
- ✅ Origin Access Identity (OAI) for secure S3 access
- ✅ TLS 1.2+ enforcement
- ✅ CORS configuration for ClipShare app

## 🛠️ Configuration

### Required Variables

```hcl
# AWS Region
aws_region = "us-east-1"

# S3 Configuration (must be globally unique)
bucket_name = "clipshare-videos-yourdomain"

# Domain Configuration
domain_name = "yourdomain.com"
```

### Optional Variables

```hcl
# CloudFront Aliases
cloudfront_aliases = ["yourdomain.com", "www.yourdomain.com"]

# CORS Origins (restrict to your domains in production)
allowed_origins = ["https://yourdomain.com"]

# DNS Records
create_www_record = true
create_apex_record = false

# Custom DNS Records
custom_dns_records = {
  "app" = ""  # Creates app.yourdomain.com
}
```

## 📊 Cost Optimization

The infrastructure includes several cost optimization features:

### S3 Lifecycle Policies
- **Day 30**: Move to Standard-IA (cheaper for infrequent access)
- **Day 90**: Move to Glacier (cold storage)
- **Day 365**: Move to Deep Archive (archival storage)

### CloudFront Features
- Compression enabled to reduce bandwidth
- Configurable cache TTLs
- Edge caching for better performance

## 🚦 Deployment Options

### Option 1: Automated Script (Recommended)
```bash
./scripts/deploy.sh
```

### Option 2: Manual Terraform
```bash
terraform init
terraform plan
terraform apply
```

### Option 3: Custom Configuration
You can use individual modules for custom deployments:

```hcl
module "s3" {
  source = "./modules/s3"
  bucket_name = "my-clipshare-bucket"
}
```

## 🔍 Monitoring

### CloudWatch Metrics to Monitor

1. **S3 Bucket**
   - `BucketSizeBytes`: Storage usage
   - `NumberOfObjects`: Object count
   - `AllRequests`: Request count

2. **CloudFront**
   - `Requests`: Total requests
   - `BytesDownloaded`: Data transferred
   - `4xxErrorRate` & `5xxErrorRate`: Error rates

### Recommended Alarms

- High error rates (>5%)
- Sudden traffic spikes
- Storage usage approaching limits

## 🔧 Maintenance

### Regular Tasks

1. **Review Costs**: Check AWS Cost Explorer monthly
2. **Monitor Logs**: Review CloudFront access logs
3. **Update Certificates**: ACM auto-renews, but verify
4. **Security Audit**: Review IAM permissions quarterly

### Backup Strategy

- S3 versioning protects against accidental deletion
- Consider Cross-Region Replication for critical data
- Backup Terraform state to multiple locations

## 🧹 Cleanup

To remove all infrastructure:

```bash
# Backup important data first
aws s3 sync s3://your-bucket ./backup

# Destroy everything
./scripts/destroy.sh
```

⚠️ **Warning**: This permanently deletes all resources and data.

## 🆘 Troubleshooting

### Common Issues

1. **Bucket Name Exists**
   ```
   Error: S3 bucket already exists
   ```
   Solution: Choose a unique bucket name

2. **Certificate Not Found**
   ```
   Error: ACM certificate not found
   ```
   Solution: Ensure certificate exists in us-east-1

3. **DNS Propagation**
   ```
   Domain not resolving
   ```
   Solution: Wait 15-20 minutes for DNS propagation

### Debug Commands

```bash
# Check Terraform state
terraform show

# Validate configuration
terraform validate

# Check AWS credentials
aws sts get-caller-identity
```

## 📚 Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [ClipShare Application](../README.md)

## 🤝 Contributing

When contributing to the infrastructure:

1. Test changes in a non-production environment
2. Follow Terraform best practices
3. Update documentation for any changes
4. Use semantic versioning for module updates

## 📄 License

This infrastructure code is licensed under the same MIT License as the ClipShare project.