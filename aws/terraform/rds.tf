# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-db-subnet-group"
  description = "Subnet group for RDS database"
  subnet_ids  = module.vpc.private_subnets

  tags = {
    Name        = "${var.project_name}-db-subnet-group"
    Environment = var.environment
    Project     = var.project_name
  }
}

# RDS Parameter Group
resource "aws_db_parameter_group" "main" {
  name        = "${var.project_name}-db-parameter-group"
  family      = "postgres14"
  description = "Parameter group for PostgreSQL database"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  tags = {
    Name        = "${var.project_name}-db-parameter-group"
    Environment = var.environment
    Project     = var.project_name
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier             = "${var.project_name}-${var.environment}-db"
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  storage_type           = "gp2"
  engine                 = "postgres"
  engine_version         = "14.7"
  port                   = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  multi_az               = var.environment == "prod"
  storage_encrypted      = true
  deletion_protection    = var.environment == "prod"

  backup_retention_period = var.db_backup_retention_period
  backup_window          = "04:00-05:00"
  maintenance_window     = "sun:05:00-sun:06:00"

  # Performance Insights
  performance_insights_enabled          = var.environment == "prod"
  performance_insights_retention_period = var.environment == "prod" ? 7 : 0

  # Enhanced Monitoring
  monitoring_interval = var.environment == "prod" ? 60 : 0
  monitoring_role_arn = var.environment == "prod" ? aws_iam_role.rds_enhanced_monitoring[0].arn : ""

  # CloudWatch Logs Export
  enabled_cloudwatch_logs_exports = [
    "postgresql",
    "upgrade"
  ]

  skip_final_snapshot  = var.environment == "dev" ? true : false
  final_snapshot_identifier = var.environment == "prod" ? "${var.project_name}-db-final-snapshot" : ""

  tags = {
    Name        = "${var.project_name}-rds"
    Environment = var.environment
    Project     = var.project_name
  }

  lifecycle {
    prevent_destroy = var.environment == "prod"
  }
}

# Enhanced Monitoring IAM Role
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${var.project_name}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-rds-monitoring-role"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.environment == "prod" ? 1 : 0
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"

  count = var.environment == "prod" ? 1 : 0
}

# Read Replica for High Availability (Production Only)
resource "aws_db_instance" "read_replica" {
  identifier             = "${var.project_name}-${var.environment}-db-replica"
  replicate_source_db    = aws_db_instance.main.identifier
  instance_class         = var.db_instance_class
  port                   = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  storage_encrypted      = true
  deletion_protection    = var.environment == "prod"

  # CloudWatch Logs Export
  enabled_cloudwatch_logs_exports = [
    "postgresql",
    "upgrade"
  ]

  skip_final_snapshot  = var.environment == "dev" ? true : false
  final_snapshot_identifier = var.environment == "prod" ? "${var.project_name}-db-replica-final-snapshot" : ""

  tags = {
    Name        = "${var.project_name}-rds-replica"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.environment == "prod" ? 1 : 0
}

# Database Proxy for Connection Pooling (Production Only)
resource "aws_rds_proxy" "main" {
  name                   = "${var.project_name}-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy[0].arn
  vpc_subnet_ids         = module.vpc.private_subnets
  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.app_secrets.arn
  }
  debug_logging          = false
  idle_client_timeout    = 1800

  tags = {
    Name        = "${var.project_name}-rds-proxy"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.environment == "prod" ? 1 : 0
}

resource "aws_iam_role" "rds_proxy" {
  name = "${var.project_name}-rds-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-rds-proxy-role"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.environment == "prod" ? 1 : 0
}

resource "aws_iam_role_policy" "rds_proxy" {
  name = "${var.project_name}-rds-proxy-policy"
  role = aws_iam_role.rds_proxy[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = aws_secretsmanager_secret.app_secrets.arn
      }
    ]
  })

  count = var.environment == "prod" ? 1 : 0
}

resource "aws_rds_proxy_default_target_group" "main" {
  db_proxy_name = aws_rds_proxy.main[0].name
  connection_pool_config {
    max_connections_percent        = 75
    max_idle_connections_percent   = 50
    connection_borrow_timeout      = 120
    session_pinning_filters        = []
    init_query                     = "SET time zone = 'UTC';"
  }

  count = var.environment == "prod" ? 1 : 0
}

resource "aws_rds_proxy_target" "main" {
  db_proxy_name          = aws_rds_proxy.main[0].name
  target_group_name      = aws_rds_proxy_default_target_group.main[0].name
  db_instance_identifier = aws_db_instance.main.identifier

  count = var.environment == "prod" ? 1 : 0
}

# Database Security Group Rules
resource "aws_security_group_rule" "rds_ingress_ecs" {
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  security_group_id = aws_security_group.rds.id
  source_security_group_id = aws_security_group.ecs.id
}

resource "aws_security_group_rule" "rds_ingress_proxy" {
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  security_group_id = aws_security_group.rds.id
  source_security_group_id = aws_security_group.rds.id

  count = var.environment == "prod" ? 1 : 0
}

# Database Auto Scaling Storage
resource "aws_db_instance_automated_backups_replication" "main" {
  source_db_instance_arn = aws_db_instance.main.arn
  kms_key_id             = aws_kms_key.rds.arn

  count = var.environment == "prod" ? 1 : 0
}

resource "aws_kms_key" "rds" {
  description = "KMS key for RDS encryption"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-rds-kms-key"
    Environment = var.environment
    Project     = var.project_name
  }

  count = var.environment == "prod" ? 1 : 0
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${var.project_name}-rds-key"
  target_key_id = aws_kms_key.rds[0].id

  count = var.environment == "prod" ? 1 : 0
}

data "aws_caller_identity" "current" {}