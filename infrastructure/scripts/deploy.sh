#!/bin/bash

# ClipShare Infrastructure Deployment Script
# This script automates the deployment of ClipShare infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

print_info "ClipShare Infrastructure Deployment Script"
print_info "=========================================="

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed. Please install Terraform first."
        echo "Visit: https://learn.hashicorp.com/tutorials/terraform/install-cli"
        exit 1
    fi

    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install AWS CLI first."
        echo "Visit: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html"
        exit 1
    fi

    # Check if AWS credentials are configured
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials are not configured. Please run 'aws configure' first."
        exit 1
    fi

    print_success "Prerequisites check passed!"
}

# Validate configuration
validate_config() {
    print_info "Validating configuration..."

    # Check if terraform.tfvars exists
    if [[ ! -f "$INFRA_DIR/terraform.tfvars" ]]; then
        print_warning "terraform.tfvars not found. Creating from template..."
        cp "$INFRA_DIR/terraform.tfvars.example" "$INFRA_DIR/terraform.tfvars"
        print_warning "Please edit terraform.tfvars with your specific values before continuing."
        print_info "Key variables to configure:"
        echo "  - bucket_name: Must be globally unique"
        echo "  - domain_name: Your registered domain"
        echo "  - aws_region: Your preferred AWS region"

        read -p "Press Enter after configuring terraform.tfvars..."
    fi

    # Validate Terraform configuration
    cd "$INFRA_DIR"
    terraform fmt -check
    terraform validate

    print_success "Configuration validation passed!"
}

# Initialize Terraform
init_terraform() {
    print_info "Initializing Terraform..."
    cd "$INFRA_DIR"
    terraform init
    print_success "Terraform initialization completed!"
}

# Plan deployment
plan_deployment() {
    print_info "Planning deployment..."
    cd "$INFRA_DIR"
    terraform plan -out=tfplan
    print_success "Deployment plan created!"
}

# Apply deployment
apply_deployment() {
    print_info "Applying deployment..."
    cd "$INFRA_DIR"

    read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        terraform apply tfplan
        print_success "Deployment completed successfully!"
    else
        print_warning "Deployment cancelled by user."
        exit 1
    fi
}

# Show outputs
show_outputs() {
    print_info "Deployment outputs:"
    cd "$INFRA_DIR"
    terraform output

    print_info "ClipShare Configuration:"
    echo "# Add these values to your ClipShare .env file:"
    terraform output -json | jq -r '.clipshare_config.value | to_entries[] | "\(.key | ascii_upcase)=\(.value)"'

    print_success "Deployment information displayed!"
}

# Main execution
main() {
    check_prerequisites
    validate_config
    init_terraform
    plan_deployment
    apply_deployment
    show_outputs

    print_success "ClipShare infrastructure deployment completed successfully!"
    print_info "Next steps:"
    echo "1. Configure your ClipShare app with the provided .env values"
    echo "2. Test the deployment by uploading a video"
    echo "3. Set up monitoring and alerts as needed"
}

# Handle script interruption
trap 'print_warning "Script interrupted by user"; exit 1' INT

# Run main function
main "$@"