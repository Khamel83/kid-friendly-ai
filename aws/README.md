# AWS Deployment for Kid-Friendly AI

This directory contains the complete AWS deployment configuration for the Kid-Friendly AI application, including Terraform infrastructure as code, CloudFormation templates, and deployment automation scripts.

## 🏗️ Architecture Overview

The deployment includes:

### Infrastructure Components
- **VPC** with public and private subnets
- **ECS Fargate** cluster for container orchestration
- **RDS PostgreSQL** database for user data
- **S3 buckets** for static assets and user uploads
- **CloudFront CDN** with WAF protection
- **Application Load Balancer** (ALB)
- **CloudWatch** monitoring and alarms
- **Secrets Manager** for environment variables
- **Auto Scaling** configuration
- **IAM roles** and security groups

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │     CloudFront  │    │      Route 53    │
│     CDN         │◄───│    Static CDN   │◄───│      DNS         │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         │ HTTPS                                       │
         │                                              │
┌─────────────────┐    ┌─────────────────┐              │
│  Load Balancer  │    │   S3 Buckets    │              │
│      (ALB)      │◄───│   (Assets)      │              │
│                 │    │                 │              │
└─────────────────┘    └─────────────────┘              │
         │                                              │
         │ Internal                                     │
         │                                              │
┌─────────────────┐    ┌─────────────────┐              │
│   ECS Fargate   │    │   RDS           │              │
│   Cluster       │◄───│   PostgreSQL    │              │
│                 │    │   Database      │              │
└─────────────────┘    └─────────────────┘              │
         │                                              │
         │ Private Network                               │
         │                                              │
┌─────────────────┐    ┌─────────────────┐              │
│   CloudWatch    │    │   Secrets Mgr   │              │
│   Monitoring    │    │   Secrets       │              │
│                 │    │                 │              │
└─────────────────┘    └─────────────────┘              │
```

## 📁 Directory Structure

```
aws/
├── terraform/                 # Terraform IaC
│   ├── main.tf               # Main infrastructure
│   ├── variables.tf          # Input variables
│   ├── outputs.tf            # Output values
│   ├── ecs.tf               # ECS configuration
│   ├── rds.tf               # Database configuration
│   ├── s3.tf                # S3 bucket configuration
│   ├── cloudfront.tf        # CDN configuration
│   └── monitoring.tf        # Monitoring and alarms
├── scripts/                  # Deployment scripts
│   ├── build-and-push.sh    # Docker build & push
│   └── deploy-ecs.sh        # ECS deployment
├── cloudformation/           # CloudFormation template
│   └── infrastructure.yml   # Full infrastructure
├── deploy-aws.sh            # Main deployment script
└── README.md                # This file
```

## 🚀 Quick Start

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Terraform** installed (v1.0+)
4. **Docker** installed and running
5. **Node.js** and npm installed
6. **kubectl** (optional for EKS)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd kid-friendly-ai

# Install dependencies
npm install

# Build the application
npm run build
```

### 1. Deploy with Terraform (Recommended)

#### Initialize and Deploy
```bash
# Deploy to development environment
./aws/deploy-aws.sh dev us-east-1

# Deploy to staging environment
./aws/deploy-aws.sh staging us-east-1

# Deploy to production environment
./aws/deploy-aws.sh prod us-east-1
```

#### Manual Terraform Commands
```bash
# Initialize Terraform
cd aws/terraform
terraform init

# Create workspace
terraform workspace new dev
terraform workspace select dev

# Plan deployment
terraform plan -var="environment=dev" -out=tfplan

# Apply deployment
terraform apply tfplan

# Build and push Docker image
../scripts/build-and-push.sh <ecr-url> us-east-1

# Deploy to ECS
../scripts/deploy-ecs.sh kid-friendly-ai dev us-east-1
```

### 2. Deploy with CloudFormation

```bash
# Deploy CloudFormation stack
aws cloudformation deploy \
  --template-file aws/cloudformation/infrastructure.yml \
  --stack-name kid-friendly-ai-dev \
  --parameter-overrides \
    Environment=dev \
    AWSRegion=us-east-1 \
    DbPassword=your-secure-password \
    AlarmEmail=your-email@example.com \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

### 3. Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://admin:password@your-rds-endpoint:5432/kidfriendlyai

# NextAuth
NEXTAUTH_SECRET=your-nextauth-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# AWS
AWS_BUCKET_NAME=your-s3-bucket-name
AWS_REGION=us-east-1
ENVIRONMENT=development

# Application
PORT=3000
NODE_ENV=development
```

## ⚙️ Configuration

### Terraform Variables

Key configuration options in `aws/terraform/variables.tf`:

| Variable | Default | Description |
|----------|---------|-------------|
| `aws_region` | `us-east-1` | AWS region |
| `environment` | `dev` | Environment name |
| `project_name` | `kid-friendly-ai` | Project name |
| `container_cpu` | `256` | Container CPU units |
| `container_memory` | `512` | Container memory (MB) |
| `desired_count` | `2` | Desired ECS tasks |
| `enable_waf` | `true` | Enable WAF protection |
| `enable_https_only` | `true` | Force HTTPS |

### Database Configuration

- **Instance Class**: `db.t3.micro` (dev), `db.t3.medium` (prod)
- **Storage**: 20GB minimum, auto-scaling enabled
- **Backup**: 7-day retention, daily snapshots
- **Multi-AZ**: Enabled in production
- **Encryption**: At rest and in transit

### Scaling Configuration

- **Minimum Capacity**: 1 task
- **Maximum Capacity**: 10 tasks
- **CPU Scale-up**: 70% threshold
- **Memory Scale-up**: 70% threshold
- **Scale-down**: 20% threshold
- **Cooldown**: 5 minutes

## 📊 Monitoring and Logging

### CloudWatch Dashboards

- **Application Performance**: CPU, memory, response time
- **Database Metrics**: Connections, storage, performance
- **ALB Metrics**: Request count, error rates, latency
- **CloudFront Metrics**: Requests, bandwidth, cache hits

### Alarms

- **High CPU Usage** (>80%)
- **High Memory Usage** (>80%)
- **Application Errors** (>5%)
- **Database Connections** (>50)
- **Response Time** (>5s)

### Logging

- **ECS Container Logs**: 30-day retention
- **Application Logs**: Structured JSON format
- **Access Logs**: ALB and CloudFront access logs
- **Error Tracking**: Automatic error detection

## 🔒 Security

### Network Security

- **VPC**: Private and public subnets
- **Security Groups**: Least-privilege access
- **NAT Gateway**: Outbound internet access
- **WAF**: Web Application Firewall
- **SSL/TLS**: HTTPS-only configuration

### Data Security

- **Database Encryption**: At rest and in transit
- **S3 Encryption**: AES-256 encryption
- **Secrets Management**: AWS Secrets Manager
- **IAM Roles**: Least-privilege permissions
- **CORS**: Restricted cross-origin access

### Compliance

- **CSP**: Content Security Policy headers
- **HSTS**: HTTP Strict Transport Security
- **XSS Protection**: Built-in XSS mitigation
- **CSRF Protection**: Cross-site request forgery protection

## 🚀 Deployment Scripts

### Main Deployment Script
```bash
./aws/deploy-aws.sh [environment] [region]
```

Options:
- `dev`: Development environment
- `staging`: Staging environment
- `prod`: Production environment

### Docker Build and Push
```bash
./aws/scripts/build-and-push.sh <ecr-url> [region]
```

### ECS Deployment
```bash
./aws/scripts/deploy-ecs.sh <project-name> <environment> [region]
```

Special commands:
- `rollback`: Rollback to previous deployment
- `status`: Get deployment status
- `logs`: View CloudWatch logs

## 📈 Cost Optimization

### Cost-Saving Features

- **Spot Instances**: Up to 70% savings
- **Auto Scaling**: Scale based on demand
- **Reserved Instances**: For predictable workloads
- **S3 Lifecycle**: Move to cheaper storage classes
- **CloudFront**: Reduce origin requests

### Estimated Monthly Costs

| Service | Development | Production |
|---------|-------------|------------|
| ECS Fargate | ~$30/month | ~$150/month |
| RDS Database | ~$25/month | ~$100/month |
| S3 Storage | ~$5/month | ~$20/month |
| CloudFront | ~$10/month | ~$50/month |
| **Total** | **~$70/month** | **~$320/month** |

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to AWS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Build application
        run: |
          npm ci
          npm run build

      - name: Deploy to AWS
        run: |
          chmod +x ./aws/deploy-aws.sh
          ./aws/deploy-aws.sh prod us-east-1
```

## 🐛 Troubleshooting

### Common Issues

#### Docker Build Issues
```bash
# Check Docker daemon
docker info

# Build with debug output
docker build --no-cache --progress=plain -t kid-friendly-ai .
```

#### ECS Deployment Issues
```bash
# Check service status
aws ecs describe-services --cluster kid-friendly-ai-cluster --services kid-friendly-ai-service

# View task logs
aws logs tail /ecs/kid-friendly-ai --follow

# Check task definition
aws ecs describe-task-definition --task-definition kid-friendly-ai-task
```

#### Database Connection Issues
```bash
# Test database connectivity
nc -zv your-rds-endpoint 5432

# Check RDS status
aws rds describe-db-instances --db-instance-identifier kid-friendly-ai-dev-db
```

#### Terraform Issues
```bash
# Reinitialize Terraform
terraform init -reconfigure

# Check state
terraform state list

# Fix state issues
terraform state rm <resource-name>
```

### Health Checks

The application includes built-in health checks:

- **Health Endpoint**: `/health`
- **Metrics Endpoint**: `/metrics`
- **Ready Endpoint**: `/ready`

### Performance Monitoring

- **APM**: CloudWatch Application Signals
- **Distributed Tracing**: AWS X-Ray
- **Real User Monitoring**: CloudFront RUM
- **Synthetic Monitoring**: CloudWatch Synthetics

## 📚 Additional Resources

### Documentation

- [AWS Fargate Documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)

### Tools

- **AWS Management Console**: web-based AWS interface
- **AWS CLI**: command-line interface for AWS
- **Terraform CLI**: infrastructure as code tool
- **Docker**: containerization platform
- **kubectl**: Kubernetes CLI (for EKS)

### Support

For issues and questions:

1. Check the troubleshooting section above
2. Review AWS service logs in CloudWatch
3. Consult the [AWS Documentation](https://docs.aws.amazon.com/)
4. Open an issue in the project repository

## 🔄 Updates and Maintenance

### Regular Maintenance

- **Security Updates**: Apply AWS security patches
- **Terraform Updates**: Update provider versions
- **Application Updates**: Deploy new application versions
- **Database Maintenance**: Apply PostgreSQL updates
- **Cost Optimization**: Review and optimize resource usage

### Backup Strategy

- **Database**: Daily snapshots, 7-day retention
- **S3 Objects**: Versioning enabled, 30-day retention
- **Infrastructure**: Terraform state management
- **Configuration**: Secrets Manager versioning

### Disaster Recovery

- **Multi-AZ**: Database replication
- **Cross-region**: Optional multi-region deployment
- **Backup Restoration**: Automated backup procedures
- **Infrastructure as Code**: Quick environment recreation

---

## 📄 License

This deployment configuration is part of the Kid-Friendly AI project. See the main project license for details.

## 🤝 Contributing

Contributions to improve the deployment configuration are welcome. Please ensure all changes are tested and documented.