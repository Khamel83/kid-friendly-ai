#!/bin/bash

# AWS Deployment Script for Kid-Friendly AI
# This script orchestrates the complete AWS deployment process

set -e

# Configuration
PROJECT_NAME="kid-friendly-ai"
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}
TERRAFORM_DIR="aws/terraform"
SCRIPTS_DIR="aws/scripts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install it first."
        exit 1
    fi

    # Check kubectl (optional)
    if ! command -v kubectl &> /dev/null; then
        log_warning "kubectl is not installed. Some features may not work."
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not configured. Please run 'aws configure'."
        exit 1
    fi

    log_success "All prerequisites are satisfied."
}

# Initialize Terraform
init_terraform() {
    log_info "Initializing Terraform..."
    cd "$TERRAFORM_DIR"
    terraform init
    cd - > /dev/null
    log_success "Terraform initialized successfully."
}

# Create Terraform workspace
create_workspace() {
    log_info "Creating Terraform workspace for $ENVIRONMENT..."
    cd "$TERRAFORM_DIR"

    if ! terraform workspace list | grep -q "$ENVIRONMENT"; then
        terraform workspace new "$ENVIRONMENT"
        log_success "Workspace '$ENVIRONMENT' created."
    else
        terraform workspace select "$ENVIRONMENT"
        log_info "Workspace '$ENVIRONMENT' already exists. Selected."
    fi

    cd - > /dev/null
}

# Plan Terraform deployment
plan_deployment() {
    log_info "Planning Terraform deployment..."
    cd "$TERRAFORM_DIR"

    terraform plan \
        -var="environment=$ENVIRONMENT" \
        -var="aws_region=$AWS_REGION" \
        -out="tfplan"

    cd - > /dev/null
    log_success "Terraform plan created."
}

# Apply Terraform deployment
apply_deployment() {
    log_info "Applying Terraform deployment..."
    cd "$TERRAFORM_DIR"

    terraform apply "tfplan"

    cd - > /dev/null
    log_success "Terraform deployment completed."
}

# Build and push Docker image
build_and_push_image() {
    log_info "Building and pushing Docker image..."

    # Get ECR repository URL from Terraform outputs
    cd "$TERRAFORM_DIR"
    ECR_URL=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "")
    cd - > /dev/null

    if [ -z "$ECR_URL" ]; then
        log_error "Could not get ECR repository URL. Make sure Terraform deployment is complete."
        exit 1
    fi

    # Execute build script
    if [ -f "$SCRIPTS_DIR/build-and-push.sh" ]; then
        chmod +x "$SCRIPTS_DIR/build-and-push.sh"
        "$SCRIPTS_DIR/build-and-push.sh" "$ECR_URL" "$AWS_REGION"
    else
        log_error "Build script not found: $SCRIPTS_DIR/build-and-push.sh"
        exit 1
    fi

    log_success "Docker image built and pushed successfully."
}

# Deploy to ECS
deploy_to_ecs() {
    log_info "Deploying to ECS..."

    # Execute ECS deployment script
    if [ -f "$SCRIPTS_DIR/deploy-ecs.sh" ]; then
        chmod +x "$SCRIPTS_DIR/deploy-ecs.sh"
        "$SCRIPTS_DIR/deploy-ecs.sh" "$PROJECT_NAME" "$ENVIRONMENT" "$AWS_REGION"
    else
        log_error "ECS deployment script not found: $SCRIPTS_DIR/deploy-ecs.sh"
        exit 1
    fi

    log_success "ECS deployment completed."
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."

    # Get application URLs from Terraform outputs
    cd "$TERRAFORM_DIR"
    APP_URL=$(terraform output -raw application_url 2>/dev/null || echo "")
    SECURE_APP_URL=$(terraform output -raw secure_application_url 2>/dev/null || echo "")
    cd - > /dev/null

    if [ -n "$SECURE_APP_URL" ]; then
        log_info "Checking application health at $SECURE_APP_URL..."

        # Wait for application to be ready
        for i in {1..30}; do
            if curl -f "$SECURE_APP_URL/health" > /dev/null 2>&1; then
                log_success "Application is healthy!"
                break
            fi
            log_info "Waiting for application to be ready... (attempt $i/30)"
            sleep 10
        done
    fi

    if [ -n "$APP_URL" ]; then
        log_info "Application URL: $APP_URL"
    fi
    if [ -n "$SECURE_APP_URL" ]; then
        log_info "Secure Application URL: $SECURE_APP_URL"
    fi
}

# Display deployment summary
display_summary() {
    log_info "Deployment Summary"
    log_info "=================="

    cd "$TERRAFORM_DIR"

    echo "Project: $PROJECT_NAME"
    echo "Environment: $ENVIRONMENT"
    echo "AWS Region: $AWS_REGION"
    echo ""

    echo "Application URLs:"
    SECURE_APP_URL=$(terraform output -raw secure_application_url 2>/dev/null || echo "")
    APP_URL=$(terraform output -raw application_url 2>/dev/null || echo "")
    CDN_URL=$(terraform output -raw cdn_url 2>/dev/null || echo "")

    [ -n "$SECURE_APP_URL" ] && echo "  - Secure Application: $SECURE_APP_URL"
    [ -n "$APP_URL" ] && echo "  - Application: $APP_URL"
    [ -n "$CDN_URL" ] && echo "  - CDN: $CDN_URL"
    echo ""

    echo "Docker Commands:"
    ECR_URL=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "")
    [ -n "$ECR_URL" ] && echo "  - Build: docker build -t kid-friendly-ai ."
    [ -n "$ECR_URL" ] && echo "  - Tag: docker tag kid-friendly-ai:latest $ECR_URL:latest"
    [ -n "$ECR_URL" ] && echo "  - Push: docker push $ECR_URL:latest"
    echo ""

    echo "Terraform Outputs:"
    echo "  - VPC ID: $(terraform output -raw vpc_id 2>/dev/null || echo 'N/A')"
    echo "  - ECS Cluster: $(terraform output -raw ecs_cluster_id 2>/dev/null || echo 'N/A')"
    echo "  - RDS Endpoint: $(terraform output -raw rds_instance_endpoint 2>/dev/null || echo 'N/A')"
    echo "  - S3 Bucket: $(terraform output -raw s3_bucket_name 2>/dev/null || echo 'N/A')"

    cd - > /dev/null

    log_success "Deployment completed successfully!"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    if [ -f "$TERRAFORM_DIR/tfplan" ]; then
        rm -f "$TERRAFORM_DIR/tfplan"
    fi
    log_success "Cleanup completed."
}

# Main execution
main() {
    log_info "Starting AWS deployment for $PROJECT_NAME ($ENVIRONMENT)..."

    # Check prerequisites
    check_prerequisites

    # Initialize Terraform
    init_terraform

    # Create workspace
    create_workspace

    # Plan deployment
    plan_deployment

    # Apply deployment
    apply_deployment

    # Build and push Docker image
    build_and_push_image

    # Deploy to ECS
    deploy_to_ecs

    # Run health checks
    run_health_checks

    # Display summary
    display_summary

    # Cleanup
    cleanup

    log_success "AWS deployment completed successfully!"
}

# Handle script arguments
case "$1" in
    "help"|"--help"|"-h")
        echo "Usage: $0 [environment] [aws-region]"
        echo ""
        echo "Arguments:"
        echo "  environment  Deployment environment (dev, staging, prod) - Default: dev"
        echo "  aws-region   AWS region for deployment - Default: us-east-1"
        echo ""
        echo "Examples:"
        echo "  $0 dev us-east-1"
        echo "  $0 staging"
        echo "  $0 prod eu-west-2"
        exit 0
        ;;
    *)
        main
        ;;
esac

# Trap errors and cleanup
trap cleanup EXIT
trap 'log_error "Script interrupted. Cleaning up..."; cleanup; exit 1' INT TERM