#!/bin/bash

# Docker Build and Push Script for Kid-Friendly AI
# This script builds the Docker image and pushes it to ECR

set -e

# Configuration
ECR_URL="$1"
AWS_REGION="$2"
PROJECT_NAME="kid-friendly-ai"

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

# Validate arguments
if [ -z "$ECR_URL" ]; then
    log_error "ECR URL is required. Usage: $0 <ecr-url> [aws-region]"
    exit 1
fi

if [ -z "$AWS_REGION" ]; then
    AWS_REGION="us-east-1"
    log_info "AWS region not specified, using default: $AWS_REGION"
fi

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker."
        exit 1
    fi

    log_success "All prerequisites are satisfied."
}

# Build Docker image
build_docker_image() {
    log_info "Building Docker image..."

    # Check if Dockerfile exists
    if [ ! -f "Dockerfile" ]; then
        log_error "Dockerfile not found in current directory."
        exit 1
    fi

    # Build the image
    docker build -t "$PROJECT_NAME:latest" .

    # Also tag with timestamp
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    docker tag "$PROJECT_NAME:latest" "$PROJECT_NAME:$TIMESTAMP"

    log_success "Docker image built successfully."
}

# Log in to ECR
login_to_ecr() {
    log_info "Logging in to ECR..."

    # Get ECR login password
    ECR_PASSWORD=$(aws ecr get-login-password --region "$AWS_REGION")

    # Log in to ECR
    echo "$ECR_PASSWORD" | docker login --username AWS --password-stdin "$ECR_URL"

    log_success "Successfully logged in to ECR."
}

# Tag Docker image for ECR
tag_docker_image() {
    log_info "Tagging Docker image for ECR..."

    # Tag the image
    docker tag "$PROJECT_NAME:latest" "$ECR_URL:latest"
    docker tag "$PROJECT_NAME:latest" "$ECR_URL:$TIMESTAMP"

    log_success "Docker image tagged successfully."
}

# Push Docker image to ECR
push_docker_image() {
    log_info "Pushing Docker image to ECR..."

    # Push the image
    docker push "$ECR_URL:latest"
    docker push "$ECR_URL:$TIMESTAMP"

    log_success "Docker image pushed successfully to ECR."
}

# Create multi-architecture build (optional)
build_multi_arch() {
    log_info "Building multi-architecture Docker image..."

    # Check if buildx is available
    if ! docker buildx inspect &> /dev/null; then
        log_warning "Docker Buildx is not available. Skipping multi-architecture build."
        return 0
    fi

    # Create buildx builder if it doesn't exist
    if ! docker buildx ls | grep -q "multi-arch-builder"; then
        docker buildx create --name multi-arch-builder --use
    fi

    # Build and push multi-architecture image
    docker buildx build --platform linux/amd64,linux/arm64 \
        --tag "$ECR_URL:latest" \
        --tag "$ECR_URL:$TIMESTAMP" \
        --push .

    log_success "Multi-architecture image built and pushed successfully."
}

# Clean up local images
cleanup() {
    log_info "Cleaning up local images..."

    # Remove the local tagged images (keep the original)
    docker rmi "$ECR_URL:latest" 2>/dev/null || true
    docker rmi "$ECR_URL:$TIMESTAMP" 2>/dev/null || true

    log_success "Cleanup completed."
}

# Display image information
display_image_info() {
    log_info "Image Information"
    log_info "================"

    echo "ECR Repository: $ECR_URL"
    echo "Latest Tag: $ECR_URL:latest"
    echo "Timestamp Tag: $ECR_URL:$TIMESTAMP"
    echo ""

    # Get image manifest
    IMAGE_MANIFEST=$(aws ecr describe-images --repository-name "$PROJECT_NAME-app" --region "$AWS_REGION" --query 'sort_by(imageDetails,&imagePushedAt)[-1]' --output json 2>/dev/null || echo "")

    if [ -n "$IMAGE_MANIFEST" ]; then
        echo "Image Size: $(echo "$IMAGE_MANIFEST" | jq -r '.imageSizeInBytes // "N/A"')"
        echo "Image Digest: $(echo "$IMAGE_MANIFEST" | jq -r '.imageDigest // "N/A"')"
        echo "Architecture: $(echo "$IMAGE_MANIFEST" | jq -r '.architecture // "N/A"')"
    fi

    echo ""
    echo "Next.js Build Commands:"
    echo "  - Build: npm run build"
    echo "  - Start: npm run start"
    echo "  - Dev: npm run dev"
    echo ""
    echo "Docker Commands:"
    echo "  - Run locally: docker run -p 3000:3000 $PROJECT_NAME:latest"
    echo "  - Stop: docker stop \$(docker ps -q --filter ancestor=$PROJECT_NAME:latest)"
}

# Main execution
main() {
    log_info "Starting Docker build and push process..."

    # Check prerequisites
    check_prerequisites

    # Build Docker image
    build_docker_image

    # Log in to ECR
    login_to_ecr

    # Tag Docker image
    tag_docker_image

    # Push Docker image
    push_docker_image

    # Optionally build multi-architecture
    if [ "$BUILD_MULTI_ARCH" = "true" ]; then
        build_multi_arch
    fi

    # Display image information
    display_image_info

    # Cleanup
    cleanup

    log_success "Docker build and push process completed successfully!"
}

# Handle script arguments
case "$1" in
    "help"|"--help"|"-h")
        echo "Usage: $0 <ecr-url> [aws-region]"
        echo ""
        echo "Arguments:"
        echo "  ecr-url     ECR repository URL (required)"
        echo "  aws-region  AWS region for ECR (default: us-east-1)"
        echo ""
        echo "Environment Variables:"
        echo "  BUILD_MULTI_ARCH  Build multi-architecture image (true/false)"
        echo ""
        echo "Examples:"
        echo "  $0 123456789012.dkr.ecr.us-east-1.amazonaws.com/kid-friendly-ai-app"
        echo "  $0 123456789012.dkr.ecr.us-east-1.amazonaws.com/kid-friendly-ai-app us-west-2"
        echo "  BUILD_MULTI_ARCH=true $0 123456789012.dkr.ecr.us-east-1.amazonaws.com/kid-friendly-ai-app"
        exit 0
        ;;
    *)
        main
        ;;
esac

# Trap errors
trap 'log_error "Script interrupted. Exiting..."; exit 1' INT TERM