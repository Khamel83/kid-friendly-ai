#!/bin/bash

# Docker Deployment Script for Kid-Friendly AI
# This script automates the deployment process using Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="kid-friendly-ai"
IMAGE_NAME="kid-friendly-ai"
REGISTRY="${REGISTRY:-docker.io}"
TAG="${TAG:-latest}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check if required commands exist
check_requirements() {
    log "Checking requirements..."

    for cmd in docker docker-compose git; do
        if ! command -v $cmd &> /dev/null; then
            error "$cmd is not installed"
            exit 1
        fi
    done

    log "Requirements check passed"
}

# Build Docker image
build_image() {
    log "Building Docker image..."

    docker build \
        --build-arg NODE_ENV=$ENVIRONMENT \
        -t ${IMAGE_NAME}:${TAG} \
        -t ${IMAGE_NAME}:latest \
        .

    log "Docker image built successfully"
}

# Push to registry (if configured)
push_image() {
    if [ -n "$REGISTRY" ] && [ "$REGISTRY" != "docker.io" ]; then
        log "Pushing image to registry..."

        docker tag ${IMAGE_NAME}:${TAG} ${REGISTRY}/${IMAGE_NAME}:${TAG}
        docker tag ${IMAGE_NAME}:latest ${REGISTRY}/${IMAGE_NAME}:latest

        docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}
        docker push ${REGISTRY}/${IMAGE_NAME}:latest

        log "Image pushed to registry successfully"
    else
        warn "No registry configured, skipping push"
    fi
}

# Deploy using Docker Compose
deploy_compose() {
    log "Deploying with Docker Compose..."

    # Create necessary directories
    mkdir -p logs ssl

    # Set environment variables for Docker Compose
    export TAG=$TAG
    export ENVIRONMENT=$ENVIRONMENT
    export REGISTRY=$REGISTRY

    # Stop existing services
    info "Stopping existing services..."
    docker-compose down

    # Pull latest images
    info "Pulling latest images..."
    docker-compose pull

    # Start services
    info "Starting services..."
    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose -f docker-compose.yml -f docker/docker-compose.prod.yml up -d
    else
        docker-compose up -d
    fi

    log "Deployment completed successfully"
}

# Health check
health_check() {
    log "Performing health check..."

    max_attempts=30
    attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
            log "Health check passed!"
            return 0
        fi

        info "Waiting for application to be ready... (attempt $attempt/$max_attempts)"
        sleep 10
        attempt=$((attempt + 1))
    done

    error "Health check failed after $max_attempts attempts"
    return 1
}

# Show status
show_status() {
    log "Showing deployment status..."

    echo ""
    echo "=== Container Status ==="
    docker-compose ps

    echo ""
    echo "=== Recent Logs ==="
    docker-compose logs --tail=20 app

    echo ""
    echo "=== Application Access ==="
    echo "Application: http://localhost:3000"
    echo "Nginx: http://localhost:80"
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "Grafana: http://localhost:3001"
        echo "Prometheus: http://localhost:9090"
    fi
}

# Cleanup
cleanup() {
    log "Cleaning up..."

    # Remove unused images
    docker image prune -f

    # Remove unused volumes
    docker volume prune -f

    log "Cleanup completed"
}

# Rollback
rollback() {
    warn "Rolling back to previous deployment..."

    # Stop current services
    docker-compose down

    # Start previous version (if available)
    if docker image inspect ${IMAGE_NAME}:previous > /dev/null 2>&1; then
        docker tag ${IMAGE_NAME}:previous ${IMAGE_NAME}:rollback
        docker-compose up -d

        log "Rollback completed successfully"
    else
        error "No previous version available for rollback"
        exit 1
    fi
}

# Show help
show_help() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  build                    Build Docker image"
    echo "  push                     Push image to registry"
    echo "  deploy                   Deploy application"
    echo "  health                   Health check"
    echo "  status                   Show deployment status"
    echo "  cleanup                  Clean up unused resources"
    echo "  rollback                 Rollback to previous version"
    echo "  logs                     Show application logs"
    echo "  stop                     Stop services"
    echo "  restart                  Restart services"
    echo ""
    echo "Options:"
    echo "  -e, --env ENV           Environment (development|production)"
    echo "  -t, --tag TAG           Docker tag"
    echo "  -r, --registry REGISTRY Docker registry"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy -e production"
    echo "  $0 build -t v1.0.0"
    echo "  $0 logs -e production"
}

# Main function
main() {
    local command="${1:-help}"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--tag)
                TAG="$2"
                shift 2
                ;;
            -r|--registry)
                REGISTRY="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                shift
                ;;
        esac
    done

    # Set environment-specific defaults
    if [ "$ENVIRONMENT" = "production" ]; then
        TAG="${TAG:-latest}"
    else
        TAG="${TAG:-dev}"
    fi

    # Execute command
    case $command in
        build)
            check_requirements
            build_image
            ;;
        push)
            check_requirements
            push_image
            ;;
        deploy)
            check_requirements
            build_image
            push_image
            deploy_compose
            health_check
            show_status
            ;;
        health)
            health_check
            ;;
        status)
            show_status
            ;;
        cleanup)
            cleanup
            ;;
        rollback)
            rollback
            ;;
        logs)
            docker-compose logs -f app
            ;;
        stop)
            docker-compose down
            ;;
        restart)
            docker-compose restart
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"