#!/bin/bash

# ECS Deployment Script for Kid-Friendly AI
# This script deploys the application to ECS Fargate

set -e

# Configuration
PROJECT_NAME="$1"
ENVIRONMENT="$2"
AWS_REGION="$3"
FORCE_DEPLOYMENT=${FORCE_DEPLOYMENT:-false}

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
if [ -z "$PROJECT_NAME" ] || [ -z "$ENVIRONMENT" ]; then
    log_error "Project name and environment are required. Usage: $0 <project-name> <environment> [aws-region]"
    exit 1
fi

if [ -z "$AWS_REGION" ]; then
    AWS_REGION="us-east-1"
    log_info "AWS region not specified, using default: $AWS_REGION"
fi

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    # Check jq for JSON parsing
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it first."
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not configured. Please run 'aws configure'."
        exit 1
    fi

    log_success "All prerequisites are satisfied."
}

# Get cluster and service information
get_ecs_info() {
    log_info "Getting ECS cluster and service information..."

    # Get cluster name
    CLUSTER_NAME="${PROJECT_NAME}-cluster"

    # Get service name
    SERVICE_NAME="${PROJECT_NAME}-service"

    # Check if cluster exists
    if ! aws ecs describe-clusters --clusters "$CLUSTER_NAME" --region "$AWS_REGION" | jq -r '.clusters[0].status' | grep -q "ACTIVE"; then
        log_error "ECS cluster '$CLUSTER_NAME' not found or not active."
        exit 1
    fi

    # Check if service exists
    if ! aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$AWS_REGION" | jq -r '.services[0].status' | grep -q "ACTIVE"; then
        log_error "ECS service '$SERVICE_NAME' not found or not active."
        exit 1
    fi

    log_success "ECS cluster and service found."
}

# Update ECS service
update_ecs_service() {
    log_info "Updating ECS service..."

    # Get current task definition
    CURRENT_TASK_DEF=$(aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$AWS_REGION" | jq -r '.services[0].taskDefinition')

    # Extract task definition family and revision
    TASK_DEF_FAMILY=$(echo "$CURRENT_TASK_DEF" | cut -d':' -f1)
    TASK_DEF_REVISION=$(echo "$CURRENT_TASK_DEF" | cut -d':' -f2)

    log_info "Current task definition: $TASK_DEF_FAMILY:$TASK_DEF_REVISION"

    # Update service to force new deployment
    if [ "$FORCE_DEPLOYMENT" = "true" ]; then
        log_info "Forcing new deployment..."
        aws ecs update-service \
            --cluster "$CLUSTER_NAME" \
            --service "$SERVICE_NAME" \
            --force-new-deployment \
            --region "$AWS_REGION"
    else
        log_info "Updating service..."
        aws ecs update-service \
            --cluster "$CLUSTER_NAME" \
            --service "$SERVICE_NAME" \
            --region "$AWS_REGION"
    fi

    log_success "ECS service update initiated."
}

# Wait for service to be stable
wait_for_service_stability() {
    log_info "Waiting for ECS service to become stable..."

    # Wait for service to be stable
    aws ecs wait services-stable \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$AWS_REGION"

    log_success "ECS service is now stable."
}

# Get service status
get_service_status() {
    log_info "Getting service status..."

    # Get service details
    SERVICE_DETAILS=$(aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$AWS_REGION")

    # Extract status information
    DESIRED_COUNT=$(echo "$SERVICE_DETAILS" | jq -r '.services[0].desiredCount')
    RUNNING_COUNT=$(echo "$SERVICE_DETAILS" | jq -r '.services[0].runningCount')
    PENDING_COUNT=$(echo "$SERVICE_DETAILS" | jq -r '.services[0].pendingCount')
    DEPLOYMENTS=$(echo "$SERVICE_DETAILS" | jq -r '.services[0].deployments')
    DEPLOYMENT_COUNT=$(echo "$DEPLOYMENTS" | jq 'length')

    echo "Service Status:"
    echo "  - Desired Count: $DESIRED_COUNT"
    echo "  - Running Count: $RUNNING_COUNT"
    echo "  - Pending Count: $PENDING_COUNT"
    echo "  - Active Deployments: $DEPLOYMENT_COUNT"

    # Check if all desired tasks are running
    if [ "$DESIRED_COUNT" -eq "$RUNNING_COUNT" ] && [ "$PENDING_COUNT" -eq 0 ]; then
        log_success "All desired tasks are running."
    else
        log_warning "Service is not fully deployed yet."
    fi

    # Show deployment information
    echo ""
    echo "Deployments:"
    echo "$DEPLOYMENTS" | jq -r '.[] | "  - ID: \(.id), Status: \(.status), Desired: \(.desiredCount), Running: \(.runningCount)"'
}

# Get task information
get_task_info() {
    log_info "Getting task information..."

    # List running tasks
    TASK_LIST=$(aws ecs list-tasks --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" --region "$AWS_REGION")
    TASK_ARN=$(echo "$TASK_LIST" | jq -r '.taskArns[0]')

    if [ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "null" ]; then
        # Get task details
        TASK_DETAILS=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" --region "$AWS_REGION")

        # Extract task information
        TASK_ID=$(echo "$TASK_ARN" | rev | cut -d'/' -f1 | rev)
        TASK_STATUS=$(echo "$TASK_DETAILS" | jq -r '.tasks[0].lastStatus')
        TASK_HEALTH=$(echo "$TASK_DETAILS" | jq -r '.tasks[0].healthStatus // "N/A"')
        TASK_DEF=$(echo "$TASK_DETAILS" | jq -r '.tasks[0].taskDefinitionArn')
        CONTAINER_INSTANCE=$(echo "$TASK_DETAILS" | jq -r '.tasks[0].containerInstanceArn // "N/A"')
        STARTED_AT=$(echo "$TASK_DETAILS" | jq -r '.tasks[0].startedAt // "N/A"')

        echo "Task Information:"
        echo "  - Task ID: $TASK_ID"
        echo "  - Status: $TASK_STATUS"
        echo "  - Health: $TASK_HEALTH"
        echo "  - Task Definition: $TASK_DEF"
        echo "  - Container Instance: $CONTAINER_INSTANCE"
        echo "  - Started At: $STARTED_AT"
    else
        log_warning "No running tasks found."
    fi
}

# Get load balancer information
get_load_balancer_info() {
    log_info "Getting load balancer information..."

    # Get load balancer ARN from service
    SERVICE_DETAILS=$(aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$AWS_REGION")
    LOAD_BALANCER_ARN=$(echo "$SERVICE_DETAILS" | jq -r '.services[0].loadBalancers[0].targetGroupArn' | cut -d':' -f1-6)

    if [ -n "$LOAD_BALANCER_ARN" ] && [ "$LOAD_BALANCER_ARN" != "null" ]; then
        # Get load balancer details
        LB_DETAILS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$LOAD_BALANCER_ARN" --region "$AWS_REGION")

        LB_DNS=$(echo "$LB_DETAILS" | jq -r '.LoadBalancers[0].DNSName')
        LB_SCHEME=$(echo "$LB_DETAILS" | jq -r '.LoadBalancers[0].Scheme')
        LB_TYPE=$(echo "$LB_DETAILS" | jq -r '.LoadBalancers[0].Type')
        LB_VPC=$(echo "$LB_DETAILS" | jq -r '.LoadBalancers[0].VpcId')

        echo "Load Balancer Information:"
        echo "  - DNS Name: $LB_DNS"
        echo "  - Scheme: $LB_SCHEME"
        echo "  - Type: $LB_TYPE"
        echo "  - VPC: $LB_VPC"

        # Get target group health
        TARGET_GROUP_ARN=$(echo "$SERVICE_DETAILS" | jq -r '.services[0].loadBalancers[0].targetGroupArn')
        if [ -n "$TARGET_GROUP_ARN" ] && [ "$TARGET_GROUP_ARN" != "null" ]; then
            TARGET_HEALTH=$(aws elbv2 describe-target-health --target-group-arn "$TARGET_GROUP_ARN" --region "$AWS_REGION")
            echo ""
            echo "Target Health:"
            echo "$TARGET_HEALTH" | jq -r '.TargetHealthDescriptions[] | "  - \(.Target.Id): \(.TargetHealth.State) (\(.TargetHealth.Reason // "N/A"))"'
        fi
    else
        log_warning "No load balancer found for service."
    fi
}

# Get CloudWatch logs
get_cloudwatch_logs() {
    log_info "Getting CloudWatch logs..."

    # Get log group name
    LOG_GROUP="/ecs/$PROJECT_NAME"

    # Get recent logs
    echo "Recent CloudWatch Logs:"
    echo "======================"

    # Get log streams
    LOG_STREAMS=$(aws logs describe-log-streams --log-group-name "$LOG_GROUP" --region "$AWS_REGION" --query 'sort_by(logStreams, &lastEventTimestamp)[-5:].logStreamName' --output text)

    if [ -n "$LOG_STREAMS" ]; then
        for STREAM in $LOG_STREAMS; do
            echo ""
            echo "Log Stream: $STREAM"
            echo "----------------"

            # Get log events
            LOG_EVENTS=$(aws logs get-log-events --log-group-name "$LOG_GROUP" --log-stream-name "$STREAM" --region "$AWS_REGION" --limit 10 --query 'events[-5:].{timestamp:timestamp, message:message}' --output json)

            if [ -n "$LOG_EVENTS" ]; then
                echo "$LOG_EVENTS" | jq -r '.[] | "[\(.timestamp / 1000 | strftime("%Y-%m-%d %H:%M:%S"))] \(.message)"'
            else
                echo "No recent log events."
            fi
        done
    else
        echo "No log streams found."
    fi
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."

    # Get previous task definition
    SERVICE_DETAILS=$(aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --region "$AWS_REGION")
    CURRENT_DEPLOYMENT=$(echo "$SERVICE_DETAILS" | jq -r '.services[0].deployments[0]')

    # If there's only one deployment, we can't rollback
    DEPLOYMENT_COUNT=$(echo "$SERVICE_DETAILS" | jq -r '.services[0].deployments | length')
    if [ "$DEPLOYMENT_COUNT" -le 1 ]; then
        log_error "No previous deployment to rollback to."
        exit 1
    fi

    # Get the previous task definition
    PREVIOUS_TASK_DEF=$(echo "$SERVICE_DETAILS" | jq -r '.services[0].deployments[1].taskDefinition')

    # Update service with previous task definition
    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$SERVICE_NAME" \
        --task-definition "$PREVIOUS_TASK_DEF" \
        --force-new-deployment \
        --region "$AWS_REGION"

    log_success "Rollback initiated. Previous task definition: $PREVIOUS_TASK_DEF"
}

# Main execution
main() {
    log_info "Starting ECS deployment for $PROJECT_NAME ($ENVIRONMENT)..."

    # Check prerequisites
    check_prerequisites

    # Get ECS information
    get_ecs_info

    # Update ECS service
    update_ecs_service

    # Wait for service stability
    wait_for_service_stability

    # Get service status
    get_service_status

    # Get task information
    get_task_info

    # Get load balancer information
    get_load_balancer_info

    # Get CloudWatch logs
    get_cloudwatch_logs

    log_success "ECS deployment completed successfully!"
}

# Handle script arguments
case "$1" in
    "rollback")
        log_info "Starting rollback..."
        PROJECT_NAME="$2"
        ENVIRONMENT="$3"
        AWS_REGION="$4"
        check_prerequisites
        get_ecs_info
        rollback_deployment
        ;;
    "status")
        log_info "Getting deployment status..."
        PROJECT_NAME="$2"
        ENVIRONMENT="$3"
        AWS_REGION="$4"
        check_prerequisites
        get_ecs_info
        get_service_status
        get_task_info
        get_load_balancer_info
        ;;
    "logs")
        log_info "Getting logs..."
        PROJECT_NAME="$2"
        ENVIRONMENT="$3"
        AWS_REGION="$4"
        check_prerequisites
        get_cloudwatch_logs
        ;;
    "help"|"--help"|"-h")
        echo "Usage: $0 <project-name> <environment> [aws-region]"
        echo ""
        echo "Arguments:"
        echo "  project-name  Project name (e.g., kid-friendly-ai)"
        echo "  environment   Environment (e.g., dev, staging, prod)"
        echo "  aws-region    AWS region (default: us-east-1)"
        echo ""
        echo "Commands:"
        echo "  rollback <project-name> <environment> [aws-region]  Rollback to previous deployment"
        echo "  status <project-name> <environment> [aws-region]    Get deployment status"
        echo "  logs <project-name> <environment> [aws-region]      Get CloudWatch logs"
        echo ""
        echo "Environment Variables:"
        echo "  FORCE_DEPLOYMENT  Force new deployment (true/false)"
        echo ""
        echo "Examples:"
        echo "  $0 kid-friendly-ai dev us-east-1"
        echo "  $0 kid-friendly-ai staging"
        echo "  FORCE_DEPLOYMENT=true $0 kid-friendly-ai prod"
        echo "  $0 rollback kid-friendly-ai prod"
        echo "  $0 status kid-friendly-ai dev"
        echo "  $0 logs kid-friendly-ai dev"
        exit 0
        ;;
    *)
        main
        ;;
esac

# Trap errors
trap 'log_error "Script interrupted. Exiting..."; exit 1' INT TERM