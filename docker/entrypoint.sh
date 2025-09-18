#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    error "This script should not be run as root"
    exit 1
fi

# Check if required environment variables are set
check_env_vars() {
    log "Checking environment variables..."

    required_vars=("NODE_ENV" "PORT" "HOSTNAME")
    missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi

    # Check for API keys
    if [ -z "$OPENROUTER_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
        warn "No API keys found. Application will have limited functionality."
    fi

    log "Environment variables check completed"
}

# Wait for Redis to be ready
wait_for_redis() {
    if [ "$REDIS_ENABLED" = "true" ]; then
        log "Waiting for Redis to be ready..."

        max_attempts=30
        attempt=1

        while [ $attempt -le $max_attempts ]; do
            if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then
                log "Redis is ready!"
                return 0
            fi

            info "Waiting for Redis... (attempt $attempt/$max_attempts)"
            sleep 2
            attempt=$((attempt + 1))
        done

        error "Redis is not ready after $max_attempts attempts"
        return 1
    fi
}

# Wait for database (if applicable)
wait_for_database() {
    if [ "$DATABASE_ENABLED" = "true" ]; then
        log "Waiting for database to be ready..."

        max_attempts=30
        attempt=1

        while [ $attempt -le $max_attempts ]; do
            if pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER" > /dev/null 2>&1; then
                log "Database is ready!"
                return 0
            fi

            info "Waiting for database... (attempt $attempt/$max_attempts)"
            sleep 2
            attempt=$((attempt + 1))
        done

        error "Database is not ready after $max_attempts attempts"
        return 1
    fi
}

# Initialize directories
initialize_directories() {
    log "Initializing directories..."

    # Create logs directory if it doesn't exist
    mkdir -p /app/logs

    # Create temporary directory
    mkdir -p /app/tmp

    # Set proper permissions
    chmod 755 /app/logs
    chmod 755 /app/tmp

    log "Directories initialized"
}

# Health check
health_check() {
    log "Performing health check..."

    # Check if Node.js is running
    if ! pgrep -f "node.*server.js" > /dev/null; then
        error "Node.js server is not running"
        return 1
    fi

    # Check if the application is responding
    if ! curl -f http://localhost:$PORT/health > /dev/null 2>&1; then
        warn "Application health check failed, but continuing..."
    fi

    log "Health check completed"
}

# Graceful shutdown
graceful_shutdown() {
    log "Received shutdown signal, gracefully shutting down..."

    # Send SIGTERM to Node.js process
    if pgrep -f "node.*server.js" > /dev/null; then
        pkill -f "node.*server.js"
        log "Sent SIGTERM to Node.js process"

        # Wait for graceful shutdown
        sleep 10

        # Force kill if still running
        if pgrep -f "node.*server.js" > /dev/null; then
            warn "Force killing Node.js process"
            pkill -9 -f "node.*server.js"
        fi
    fi

    log "Graceful shutdown completed"
    exit 0
}

# Setup signal handlers
setup_signal_handlers() {
    trap graceful_shutdown SIGTERM SIGINT
}

# Start the application
start_application() {
    log "Starting the application..."

    # Display configuration
    info "Starting application with the following configuration:"
    info "  Node Environment: $NODE_ENV"
    info "  Port: $PORT"
    info "  Hostname: $HOSTNAME"
    info "  Redis Enabled: $REDIS_ENABLED"
    info "  Database Enabled: $DATABASE_ENABLED"

    # Start the application
    if [ "$NODE_ENV" = "development" ]; then
        info "Starting in development mode"
        exec node server.js
    else
        info "Starting in production mode"
        exec node server.js
    fi
}

# Main execution
main() {
    log "Starting entrypoint script..."

    # Check environment variables
    check_env_vars

    # Initialize directories
    initialize_directories

    # Setup signal handlers
    setup_signal_handlers

    # Wait for services
    wait_for_redis
    wait_for_database

    # Health check
    health_check

    # Start application
    start_application
}

# Run main function
main "$@"