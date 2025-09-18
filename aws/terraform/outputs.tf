output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnets" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

output "ecs_cluster_id" {
  description = "ECS Cluster ID"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_arn" {
  description = "ECS Cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_service_name" {
  description = "ECS Service name"
  value       = aws_ecs_service.main.name
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB zone ID"
  value       = aws_lb.main.zone_id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID"
  value       = aws_cloudfront_distribution.main.hosted_zone_id
}

output "rds_instance_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.address
}

output "rds_instance_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "s3_bucket_name" {
  description = "S3 bucket name for static assets"
  value       = aws_s3_bucket.static_assets.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.static_assets.arn
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.app.repository_url
}

output "secrets_manager_arn" {
  description = "Secrets Manager ARN"
  value       = aws_secretsmanager_secret.app_secrets.arn
}

output "task_execution_role_arn" {
  description = "ECS task execution role ARN"
  value       = aws_iam_role.ecs_task_execution.arn
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "waf_web_acl_id" {
  description = "WAF Web ACL ID"
  value       = var.enable_waf ? aws_waf_web_acl.main[0].id : null
}

output "auto_scaling_target_arn" {
  description = "Auto scaling target ARN"
  value       = aws_appautoscaling_target.main.arn
}

# Deployment Commands
output "docker_build_command" {
  description = "Command to build Docker image"
  value       = "docker build -t kid-friendly-ai ."
}

output "docker_tag_command" {
  description = "Command to tag Docker image for ECR"
  value       = "docker tag kid-friendly-ai:latest ${aws_ecr_repository.app.repository_url}:latest"
}

output "docker_push_command" {
  description = "Command to push Docker image to ECR"
  value       = "docker push ${aws_ecr_repository.app.repository_url}:latest"
}

output "ecs_update_command" {
  description = "Command to update ECS service"
  value       = "aws ecs update-service --cluster ${aws_ecs_cluster.main.name} --service ${aws_ecs_service.main.name} --force-new-deployment"
}

# Access URLs
output "application_url" {
  description = "Application URL via ALB"
  value       = "http://${aws_lb.main.dns_name}"
}

output "secure_application_url" {
  description = "Secure application URL via CloudFront"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "cdn_url" {
  description = "CDN URL for static assets"
  value       = "https://${aws_cloudfront_distribution.static_assets.domain_name}"
}

# Database Connection Info
output "database_connection_string" {
  description = "Database connection string format"
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.address}:5432/${var.db_name}"
  sensitive   = true
}

# Cost Information
output "estimated_monthly_cost" {
  description = "Estimated monthly cost based on current configuration"
  value = {
    ecs_fargate = var.desired_count * var.container_memory * 730 * 0.0000125 / 1024,
    rds         = var.db_allocated_storage * 0.115,
    s3          = 0.023,
    cloudfront  = 0.085,
    total       = (var.desired_count * var.container_memory * 730 * 0.0000125 / 1024) + (var.db_allocated_storage * 0.115) + 0.023 + 0.085
  }
}