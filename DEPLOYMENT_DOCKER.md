# Docker Deployment Guide for Kid-Friendly AI

This guide provides comprehensive instructions for deploying the Kid-Friendly AI application using Docker containers.

## Overview

The Docker deployment provides a production-ready, scalable alternative to Vercel deployment with the following benefits:

- **Multi-stage builds** for optimized image size
- **Nginx reverse proxy** with SSL termination
- **Redis caching** for improved performance
- **Health checks** and monitoring
- **Production-grade security** with non-root users
- **Easy scaling** with Docker Compose

## Prerequisites

- Docker and Docker Compose installed
- Domain name (for production SSL)
- SSL certificates (or use Let's Encrypt)
- API keys for OpenRouter and OpenAI

## Quick Start

### Local Development

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd kid-friendly-ai
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start the application:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - Application: http://localhost:3000
   - Nginx: http://localhost:80
   - Grafana: http://localhost:3001 (admin/admin)
   - Prometheus: http://localhost:9090

### Production Deployment

1. **Prepare production environment:**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production values
   ```

2. **Create SSL certificates directory:**
   ```bash
   mkdir -p ssl
   # Place your SSL certificates in ssl/ directory
   # - cert.pem (certificate)
   # - key.pem (private key)
   ```

3. **Start production services:**
   ```bash
   docker-compose -f docker/docker-compose.prod.yml up -d
   ```

## Configuration Files

### Dockerfile
- **Multi-stage build**: Separates build and runtime environments
- **Security**: Runs as non-root user
- **Optimization**: Includes only necessary dependencies
- **Health checks**: Built-in health monitoring

### docker-compose.yml
- **Development environment**: Complete stack with monitoring
- **Services**: App, Nginx, Redis, Prometheus, Grafana
- **Networking**: Isolated network for services
- **Volumes**: Persistent storage for data

### docker/docker-compose.prod.yml
- **Production optimizations**: Resource limits, replicas
- **SSL termination**: Nginx with HTTPS support
- **Monitoring**: Comprehensive observability stack
- **Security**: Enhanced security configurations

### nginx.conf
- **Reverse proxy**: Routes traffic to Next.js app
- **SSL termination**: HTTPS support with security headers
- **Caching**: Optimized static file serving
- **Rate limiting**: Protection against abuse
- **Security headers**: Comprehensive security configuration

## Environment Variables

### Required Variables
- `NODE_ENV`: Set to `production` for production
- `PORT`: Application port (default: 3000)
- `HOSTNAME`: Application host (default: 0.0.0.0)

### AI Configuration
- `OPENROUTER_API_KEY`: OpenRouter API key for AI chat
- `OPENAI_API_KEY`: OpenAI API key for TTS and Whisper

### Application Configuration
- `NEXT_PUBLIC_SITE_URL`: Production site URL
- `NEXT_PUBLIC_VERCEL_URL`: Vercel deployment URL
- `DEFAULT_AI_MODEL`: Default AI model (e.g., google/gemini-2.5-flash-lite)
- `MAX_TOKENS`: Maximum tokens for AI responses

### Feature Flags
- `NEXT_PUBLIC_ENABLE_VOICE_INPUT`: Enable voice input feature
- `NEXT_PUBLIC_ENABLE_PARENTAL_CONTROLS`: Enable parental controls
- `NEXT_PUBLIC_ENABLE_SOUND_EFFECTS`: Enable sound effects
- `NEXT_PUBLIC_ENABLE_PATTERN_PUZZLE`: Enable pattern puzzle game

### Security Configuration
- `RATE_LIMIT_RPM`: Rate limit per minute
- `RATE_LIMIT_RPH`: Rate limit per hour
- `REDIS_PASSWORD`: Redis authentication password

## Services Overview

### Application Service (app)
- **Next.js application**: Main application server
- **Health checks**: Built-in health monitoring
- **Environment**: Production-optimized
- **Security**: Non-root user execution

### Nginx Service (nginx)
- **Reverse proxy**: Routes traffic to application
- **SSL termination**: HTTPS support
- **Static files**: Efficient static asset serving
- **Security headers**: Comprehensive security configuration

### Redis Service (redis)
- **Caching**: Session storage and application cache
- **Persistence**: Data persistence with AOF
- **Security**: Password protection
- **Performance**: Memory optimization

### Monitoring Services
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Health checks**: Application monitoring

## Monitoring and Health Checks

### Health Check Endpoint
- **URL**: `/health`
- **Method**: GET
- **Response**: JSON with health status

### Monitoring Dashboard
- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090
- **Metrics**: Application performance, system resources

### Health Check Script
- **Location**: `docker/healthcheck.js`
- **Features**: Comprehensive health monitoring
- **Checks**: Application, Redis, system resources, API endpoints

## SSL Configuration

### Let's Encrypt Setup
1. **Install certbot:**
   ```bash
   sudo apt update
   sudo apt install certbot
   ```

2. **Generate certificates:**
   ```bash
   sudo certbot certonly --standalone -d your-domain.com
   ```

3. **Copy certificates:**
   ```bash
   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
   ```

### Manual SSL Setup
1. **Place certificates in `ssl/` directory:**
   - `cert.pem`: SSL certificate
   - `key.pem`: Private key
   - `chain.pem`: Certificate chain (optional)

2. **Update nginx.conf with your domain**

## Scaling and Performance

### Horizontal Scaling
```yaml
# In docker-compose.prod.yml
deploy:
  replicas: 3
  update_config:
    parallelism: 1
    delay: 10s
```

### Resource Limits
```yaml
# Resource constraints
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
    reservations:
      cpus: '0.25'
      memory: 256M
```

### Performance Optimization
- **Redis caching**: Reduces database load
- **Nginx caching**: Efficient static file serving
- **Compression**: Gzip compression for responses
- **CDN**: Consider using CDN for static assets

## Security Considerations

### Container Security
- **Non-root user**: Application runs as non-root user
- **Read-only filesystem**: Where possible
- **Resource limits**: Prevent resource exhaustion
- **Network isolation**: Separate networks for services

### Application Security
- **Environment variables**: Secure configuration
- **Rate limiting**: Prevent abuse
- **Security headers**: Comprehensive header configuration
- **SSL/TLS**: Encrypted communication

### Monitoring Security
- **Authentication**: Grafana authentication
- **Network access**: Restricted monitoring access
- **Log monitoring**: Security event monitoring

## Troubleshooting

### Common Issues

#### Application not starting
```bash
# Check logs
docker-compose logs app
docker-compose logs nginx

# Check health status
curl http://localhost:3000/health
```

#### Redis connection issues
```bash
# Check Redis logs
docker-compose logs redis

# Test Redis connection
docker exec -it kid-friendly-ai-redis redis-cli ping
```

#### SSL certificate issues
```bash
# Check certificate validity
openssl x509 -in ssl/cert.pem -text -noout

# Test SSL configuration
openssl s_client -connect localhost:443
```

#### Performance issues
```bash
# Monitor resource usage
docker stats

# Check application metrics
curl http://localhost:3000/metrics
```

### Maintenance

#### Log Management
```bash
# View logs
docker-compose logs -f app
docker-compose logs -f nginx

# Rotate logs
docker exec kid-friendly-ai-nginx nginx -s reload
```

#### Backup and Recovery
```bash
# Backup Redis data
docker exec kid-friendly-ai-redis redis-cli BGSAVE

# Backup volumes
docker run --rm -v kid-friendly-ai_redis_data:/data -v $(pwd):/backup alpine tar cvf /backup/redis-backup.tar /data
```

#### Updates
```bash
# Update images
docker-compose pull
docker-compose up -d

# Clean up unused images
docker image prune -f
```

## Production Deployment Checklist

- [ ] Set up production environment variables
- [ ] Configure SSL certificates
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Test health checks
- [ ] Set up log aggregation
- [ ] Configure security monitoring
- [ ] Test disaster recovery
- [ ] Set up CI/CD pipeline
- [ ] Configure domain and DNS
- [ ] Test SSL configuration
- [ ] Set up error tracking
- [ ] Configure performance monitoring

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs using `docker-compose logs`
3. Consult the health check endpoints
4. Check the monitoring dashboards

## License

This deployment configuration is part of the Kid-Friendly AI project and follows the same license terms.