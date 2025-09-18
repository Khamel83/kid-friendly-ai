# CloudWatch Alarms for ECS
resource "aws_cloudwatch_metric_alarm" "ecs_cpu_high" {
  alarm_name          = "${var.project_name}-ecs-cpu-high"
  alarm_description   = "ECS CPU utilization is high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.main.name
  }

  tags = {
    Name        = "${var.project_name}-ecs-cpu-high"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory_high" {
  alarm_name          = "${var.project_name}-ecs-memory-high"
  alarm_description   = "ECS memory utilization is high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.main.name
  }

  tags = {
    Name        = "${var.project_name}-ecs-memory-high"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

resource "aws_cloudwatch_metric_alarm" "ecs_service_unhealthy" {
  alarm_name          = "${var.project_name}-ecs-service-unhealthy"
  alarm_description   = "ECS service is unhealthy"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Minimum"
  threshold           = 1
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  dimensions = {
    TargetGroup  = aws_lb_target_group.main.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name        = "${var.project_name}-ecs-service-unhealthy"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

# CloudWatch Alarms for ALB
resource "aws_cloudwatch_metric_alarm" "alb_5xx_error" {
  alarm_name          = "${var.project_name}-alb-5xx-error"
  alarm_description   = "ALB is generating 5xx errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = 0
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name        = "${var.project_name}-alb-5xx-error"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

resource "aws_cloudwatch_metric_alarm" "alb_latency_high" {
  alarm_name          = "${var.project_name}-alb-latency-high"
  alarm_description   = "ALB response time is high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = 5
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = {
    Name        = "${var.project_name}-alb-latency-high"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

# CloudWatch Alarms for RDS
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${var.project_name}-rds-cpu-high"
  alarm_description   = "RDS CPU utilization is high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = 80
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name        = "${var.project_name}-rds-cpu-high"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

resource "aws_cloudwatch_metric_alarm" "rds_memory_high" {
  alarm_name          = "${var.project_name}-rds-memory-high"
  alarm_description   = "RDS freeable memory is low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = 100000000  # 100MB
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name        = "${var.project_name}-rds-memory-high"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "${var.project_name}-rds-connections-high"
  alarm_description   = "RDS database connections are high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = 50
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name        = "${var.project_name}-rds-connections-high"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

# CloudWatch Alarms for CloudFront
resource "aws_cloudwatch_metric_alarm" "cloudfront_4xx_error" {
  alarm_name          = "${var.project_name}-cloudfront-4xx-error"
  alarm_description   = "CloudFront 4xx error rate is high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = 5
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
    Region         = "Global"
  }

  tags = {
    Name        = "${var.project_name}-cloudfront-4xx-error"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx_error" {
  alarm_name          = "${var.project_name}-cloudfront-5xx-error"
  alarm_description   = "CloudFront 5xx error rate is high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = "300"
  statistic           = "Average"
  threshold           = 1
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  dimensions = {
    DistributionId = aws_cloudfront_distribution.main.id
    Region         = "Global"
  }

  tags = {
    Name        = "${var.project_name}-cloudfront-5xx-error"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

# SNS Topic for Alarms
resource "aws_sns_topic" "main" {
  name = "${var.project_name}-${var.environment}-alarms"

  tags = {
    Name        = "${var.project_name}-sns-topic"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.alarm_email != "" ? 1 : 0
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.main[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email

  count = var.alarm_email != "" ? 1 : 0
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-${var.environment}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.main.name],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.main.name, "ServiceName", aws_ecs_service.main.name]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "ECS Performance"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "ALB Metrics"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.main.identifier],
            ["AWS/RDS", "FreeableMemory", "DBInstanceIdentifier", aws_db_instance.main.identifier]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "RDS Performance"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", aws_cloudfront_distribution.main.id, "Region", "Global"],
            ["AWS/CloudFront", "BytesDownloaded", "DistributionId", aws_cloudfront_distribution.main.id, "Region", "Global"]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "CloudFront Metrics"
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        properties = {
          query = "SOURCE '${aws_cloudwatch_log_group.ecs.name}' | fields @timestamp, @message | sort @timestamp desc | limit 20"
          region = var.aws_region
          title  = "ECS Application Logs"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-dashboard"
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Log Insights
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "${var.project_name}-error-count"
  pattern        = "[ERROR, error, Error, 5xx]"
  log_group_name = aws_cloudwatch_log_group.ecs.name

  metric_transformation {
    name      = "ErrorCount"
    namespace = "KidFriendlyAI"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "error_count_high" {
  alarm_name          = "${var.project_name}-error-count-high"
  alarm_description   = "Application error count is high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorCount"
  namespace           = "KidFriendlyAI"
  period              = "300"
  statistic           = "Sum"
  threshold           = 10
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.main.arn] : []

  tags = {
    Name        = "${var.project_name}-error-count-high"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.enable_cloudwatch_alarms ? 1 : 0
}

# X-Ray Tracing
resource "aws_xray_sampling_rule" "main" {
  rule_name          = "${var.project_name}-sampling-rule"
  resource_arn       = "*"
  priority          = 100
  fixed_rate        = 0.1
  reservoir_size    = 5
  service_type      = "*"
  host              = "*"
  http_method       = "*"
  url_path          = "*"
  version           = 1

  tags = {
    Name        = "${var.project_name}-xray-rule"
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudWatch Synthetics Canary
resource "aws_synthetics_canary" "main" {
  name                 = "${var.project_name}-canary"
  artifact_s3_location = "${aws_s3_bucket.logs.id}/canary"
  execution_role_arn   = aws_iam_role.synthetics.arn
  handler             = "canary.handler"
  runtime_version     = "syn-nodejs-puppeteer-6.2"
  schedule {
    expression = "rate(5 minutes)"
  }
  run_config {
    timeout_in_seconds = 60
  }
  success_retention_period = 31
  failure_retention_period = 31

  tags = {
    Name        = "${var.project_name}-canary"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.environment == "prod" ? 1 : 0
}

resource "aws_iam_role" "synthetics" {
  name = "${var.project_name}-synthetics-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-synthetics-role"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.environment == "prod" ? 1 : 0
}

resource "aws_iam_role_policy_attachment" "synthetics" {
  role       = aws_iam_role.synthetics[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/CloudWatchSyntheticsRole"

  count = var.environment == "prod" ? 1 : 0
}