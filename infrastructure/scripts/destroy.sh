#!/bin/bash

# ClipShare Infrastructure Destroy Script
# This script safely destroys all ClipShare infrastructure

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

print_info "ClipShare Infrastructure Destroy Script"
print_info "======================================"

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed."
        exit 1
    fi

    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed."
        exit 1
    fi

    # Check if we're in the right directory
    if [[ ! -f "$INFRA_DIR/terraform.tfstate" ]]; then
        print_error "No terraform state file found. Are you in the right directory?"
        exit 1
    fi

    print_success "Prerequisites check passed!"
}

# Backup important data
backup_data() {
    print_info "Checking for data backup requirements..."

    cd "$INFRA_DIR"

    # Get S3 bucket name from state
    BUCKET_NAME=$(terraform output -raw s3_bucket_name 2>/dev/null || echo "")

    if [[ -n "$BUCKET_NAME" ]]; then
        print_warning "Found S3 bucket: $BUCKET_NAME"
        print_warning "Please ensure you have backed up any important data from this bucket before proceeding!"

        # List bucket contents (if any)
        OBJECT_COUNT=$(aws s3 ls "s3://$BUCKET_NAME" --recursive 2>/dev/null | wc -l)
        if [[ $OBJECT_COUNT -gt 0 ]]; then
            print_warning "Bucket contains $OBJECT_COUNT object(s)"
            print_info "To backup your data, run:"
            echo "  aws s3 sync s3://$BUCKET_NAME ./backup-$BUCKET_NAME"
        else
            print_success "Bucket appears to be empty"
        fi
    fi

    print_success "Data backup check completed!"
}

# Show what will be destroyed
show_destruction_plan() {
    print_info "Showing destruction plan..."
    cd "$INFRA_DIR"
    terraform plan -destroy
    print_success "Destruction plan generated!"
}

# Confirm destruction
confirm_destruction() {
    print_warning "⚠️  WARNING: This will permanently destroy all ClipShare infrastructure!"
    print_warning "This includes:"
    echo "  - S3 bucket and all data"
    echo "  - CloudFront distribution"
    echo "  - ACM certificates"
    echo "  - Route53 DNS records"
    echo ""
    print_warning "This action cannot be undone!"

    read -p "Type 'destroy' to confirm: " -r
    if [[ $REPLY != "destroy" ]]; then
        print_warning "Destruction cancelled by user."
        exit 1
    fi
}

# Execute destruction
execute_destruction() {
    print_info "Executing infrastructure destruction..."
    cd "$INFRA_DIR"
    terraform destroy -auto-approve
    print_success "Infrastructure destruction completed!"
}

# Cleanup local files
cleanup_local() {
    print_info "Cleaning up local files..."
    cd "$INFRA_DIR"

    # Remove terraform files
    rm -f tfplan
    rm -f .terraform.lock.hcl
    rm -f terraform.tfstate.backup
    rm -rf .terraform/

    # Optional: Remove terraform.tfvars if user wants
    read -p "Do you want to remove terraform.tfvars file? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f terraform.tfvars
        print_success "terraform.tfvars removed"
    fi

    print_success "Local cleanup completed!"
}

# Main execution
main() {
    check_prerequisites
    backup_data
    show_destruction_plan
    confirm_destruction
    execute_destruction
    cleanup_local

    print_success "ClipShare infrastructure has been completely destroyed!"
    print_info "All AWS resources and local files have been cleaned up."
}

# Handle script interruption
trap 'print_warning "Script interrupted by user"; exit 1' INT

# Run main function
main "$@"