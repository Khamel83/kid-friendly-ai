# Kid-Friendly AI Buddy - Deployment Guide

This comprehensive guide covers the deployment process for the Kid-Friendly AI Buddy application across different platforms and environments.

## 🚀 Deployment Overview

The Kid-Friendly AI Buddy application can be deployed using several methods:
- **Vercel** (Recommended for production)
- **Netlify** (Static site deployment)
- **Docker** (Containerized deployment)
- **AWS** (Cloud infrastructure)
- **Self-hosted** (Custom server deployment)

## 🛠️ Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **npm**: 8.x or higher
- **Git**: Latest version
- **Domain name** (for production)
- **SSL certificate** (for production)

### Required Accounts
- **OpenRouter API key** for AI services
- **Vercel/Netlify/AWS account** (depending on deployment method)
- **Domain registrar account** (if using custom domain)

## 📦 Build Process

### Development Build
```bash
# Install dependencies
npm install

# Development build
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
```

### Production Build
```bash
# Production build
npm run build

# Export static files (if needed)
npm run export

# Run production server locally
npm start
```

### Build Optimization
```bash
# Analyze bundle size
npm run bundle-analyzer

# Run security audit
npm run security-audit

# Performance audit
npm run audit
```

## 🌐 Vercel Deployment (Recommended)

### Step 1: Connect to Vercel

#### Using Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to Vercel
vercel

# Deploy to production
vercel --prod
```

#### Using GitHub Integration
1. Connect your GitHub repository to Vercel
2. Configure build settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### Step 2: Environment Variables

#### Required Environment Variables
```env
# OpenRouter API Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app

# Optional Configuration
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_DEBUG_MODE=false
NEXT_PUBLIC_ENVIRONMENT=production
```

#### Setting Environment Variables in Vercel
1. Go to Vercel dashboard
2. Select your project
3. Navigate to Settings → Environment Variables
4. Add each variable with appropriate environment (Production/Preview/Development)

### Step 3: Domain Configuration

#### Custom Domain Setup
1. In Vercel dashboard, go to Settings → Domains
2. Add your custom domain
3. Configure DNS settings with your domain provider
4. Wait for SSL certificate provisioning (automatic)

### Step 4: Monitoring and Analytics

#### Vercel Analytics
```bash
# Install Vercel analytics
npm install @vercel/analytics

# Add to app
import { Analytics } from '@vercel/analytics/react';

// In your app
function App() {
  return (
    <>
      <YourApp />
      <Analytics />
    </>
  );
}
```

## 🚀 Netlify Deployment

### Step 1: Connect to Netlify

#### Using Netlify CLI
```bash
# Install Netlify CLI
npm install netlify-cli -g

# Login to Netlify
netlify login

# Deploy to Netlify
netlify deploy --prod
```

#### Using Git Integration
1. Connect your GitHub repository to Netlify
2. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
   - **Node version**: 18

### Step 2: Environment Variables

#### Netlify Environment Setup
```bash
# Using Netlify CLI
netlify env:set OPENROUTER_API_KEY your_key
netlify env:set NEXT_PUBLIC_SITE_URL https://your-app.netlify.app
```

### Step 3: Build Configuration

#### netlify.toml Configuration
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "18"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

## 🐳 Docker Deployment

### Step 1: Create Dockerfile

```dockerfile
# Use official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "start"]
```

### Step 2: Create docker-compose.yml

```yaml
version: '3.8'

services:
  kid-friendly-ai:
    build: .
    ports:
      - "3000:3000"
    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Step 3: Build and Run

```bash
# Build Docker image
docker build -t kid-friendly-ai .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

## ☁️ AWS Deployment

### Option 1: AWS Elastic Beanstalk

#### Step 1: Create Application
```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
eb init

# Create environment
eb create production

# Deploy
eb deploy
```

#### Step 2: Configuration Files

##### `.ebextensions/environment.config`
```yaml
option_settings:
  aws:elasticbeanstalk:application:environment:
    OPENROUTER_API_KEY: "${OPENROUTER_API_KEY}"
    NEXT_PUBLIC_SITE_URL: "${NEXT_PUBLIC_SITE_URL}"
    NODE_ENV: "production"
```

### Option 2: AWS ECS with Fargate

#### Step 1: Create Task Definition
```json
{
  "family": "kid-friendly-ai",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "kid-friendly-ai",
      "image": "your-account.dkr.ecr.region.amazonaws.com/kid-friendly-ai:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "OPENROUTER_API_KEY",
          "value": "${OPENROUTER_API_KEY}"
        },
        {
          "name": "NEXT_PUBLIC_SITE_URL",
          "value": "${NEXT_PUBLIC_SITE_URL}"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/kid-friendly-ai",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Option 3: AWS Amplify

#### Step 1: Connect Repository
```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
amplify init

# Add hosting
amplify add hosting

# Deploy
amplify publish
```

## 🏠 Self-Hosted Deployment

### Option 1: PM2 Process Manager

#### Step 1: Install PM2
```bash
# Install PM2 globally
npm install pm2 -g

# Create ecosystem.config.js
module.exports = {
  apps: [{
    name: 'kid-friendly-ai',
    script: 'npm',
    args: 'start',
    cwd: './',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
    }
  }]
};
```

#### Step 2: Start Application
```bash
# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on reboot
pm2 startup
```

### Option 2: Nginx Reverse Proxy

#### Step 1: Install Nginx
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# CentOS/RHEL
sudo yum install epel-release
sudo yum install nginx
```

#### Step 2: Configure Nginx
```nginx
# /etc/nginx/sites-available/kid-friendly-ai
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Step 3: Enable Site
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/kid-friendly-ai /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## 🔒 SSL Configuration

### Let's Encrypt with Certbot

#### Step 1: Install Certbot
```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

#### Step 2: Obtain Certificate
```bash
# Obtain and install certificate
sudo certbot --nginx -d your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

### Cloudflare SSL

#### Step 1: Configure Cloudflare
1. Add domain to Cloudflare
2. Update nameservers at domain registrar
3. Wait for propagation (24-48 hours)
4. Enable SSL/TLS encryption mode

#### Step 2: Origin Server Certificate
```bash
# Generate origin certificate
# Download from Cloudflare dashboard
# Install on your server
```

## 📊 Monitoring and Logging

### Application Monitoring

#### Health Checks
```typescript
// pages/api/health.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV || 'unknown'
  };

  // Check external services
  try {
    await checkOpenRouterHealth();
    health.services = { openRouter: 'healthy' };
  } catch (error) {
    health.status = 'degraded';
    health.services = { openRouter: 'unhealthy' };
  }

  res.status(health.status === 'healthy' ? 200 : 503).json(health);
}
```

### Error Tracking

#### Sentry Integration
```bash
# Install Sentry
npm install @sentry/nextjs

# Configure Sentry
// next.config.js
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig({
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
});
```

### Performance Monitoring

#### Web Vitals Tracking
```typescript
// pages/_app.tsx
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function reportWebVitals(metric) {
  // Send to analytics service
  console.log(metric);

  // Example: send to Google Analytics
  if (window.gtag) {
    window.gtag('event', metric.name, {
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    });
  }
}
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

#### `.github/workflows/deploy.yml`
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test

      - name: Build application
        run: npm run build

      - name: Run linting
        run: npm run lint

      - name: Type check
        run: npm run type-check

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Deploy to Vercel
        uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### Environment-Specific Deployments

#### Development Environment
```yaml
# .github/workflows/deploy-dev.yml
name: Deploy to Development

on:
  push:
    branches: [ develop ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      # ... similar to production ...
      - name: Deploy to Development
        uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          alias: dev.kid-friendly-ai.com
```

## 🚨 Rollback Procedures

### Vercel Rollback
```bash
# Using Vercel CLI
vercel rollback

# Or specific deployment
vercel rollback --production
```

### Git Rollback
```bash
# Reset to previous commit
git reset --hard HEAD~1

# Force push (be careful!)
git push --force origin main
```

### Database Rollback
```bash
# If using database migrations
npm run migrate:down
```

## 📈 Performance Optimization

### Build Optimization

#### Next.js Configuration
```javascript
// next.config.js
module.exports = {
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  httpAgentOptions: {
    keepAlive: true,
  },
  images: {
    domains: ['your-domain.com'],
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {
    optimizeCss: true,
    optimizeImages: true,
  },
};
```

### CDN Configuration

#### Static Asset Caching
```nginx
# Nginx configuration for static assets
location /_next/static/ {
  alias /app/.next/static/;
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location /static/ {
  alias /app/public/static/;
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

## 🔧 Environment Management

### Environment Templates

#### `.env.example`
```env
# API Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Application Configuration
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_DEBUG_MODE=false
NEXT_PUBLIC_ANALYTICS_ENABLED=false

# Optional Services
SENTRY_DSN=your_sentry_dsn_here
GOOGLE_ANALYTICS_ID=your_ga_id_here
```

### Environment-Specific Builds

#### Package.json Scripts
```json
{
  "scripts": {
    "build:dev": "env-cmd -f .env.development npm run build",
    "build:staging": "env-cmd -f .env.staging npm run build",
    "build:prod": "env-cmd -f .env.production npm run build"
  }
}
```

## 🚀 Post-Deployment Checklist

### Immediate Checks
- [ ] Application loads successfully
- [ ] All pages render correctly
- [ ] API endpoints respond properly
- [ ] Database connections work
- [ ] SSL certificate is valid
- [ ] Health checks pass
- [ ] Error tracking is working
- [ ] Analytics are collecting data

### Performance Checks
- [ ] Page load times are acceptable
- [ ] Core Web Vitals are within thresholds
- [ ] Bundle sizes are optimized
- [ ] Images are properly optimized
- [ ] Caching is working correctly

### Security Checks
- [ ] No sensitive data in client-side code
- [ ] All dependencies are up-to-date
- [ ] Security headers are properly configured
- [ ] Rate limiting is working
- [ ] Input validation is working

### Functionality Tests
- [ ] Voice recording works
- [ ] AI responses are generated
- [ ] Games load and function
- [ ] Parental controls work
- [ ] Mobile responsiveness
- [ ] Cross-browser compatibility

## 📞 Deployment Support

### Troubleshooting Common Issues

#### Build Failures
```bash
# Clear Next.js cache
rm -rf .next
npm run build

# Check for memory issues
node --max-old-space-size=4096 node_modules/.bin/next build
```

#### Runtime Errors
```bash
# Check environment variables
printenv | grep NEXT

# Check logs
pm2 logs kid-friendly-ai
```

#### Performance Issues
```bash
# Analyze bundle
npm run bundle-analyzer

# Check performance metrics
npm run audit
```

### Getting Help

#### Documentation
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [AWS Documentation](https://docs.aws.amazon.com)
- [Docker Documentation](https://docs.docker.com)

#### Community Support
- [Stack Overflow](https://stackoverflow.com/)
- [GitHub Issues](https://github.com/Khamel83/kid-friendly-ai/issues)
- [Discord Community](https://discord.gg/kid-friendly-ai)

#### Professional Support
- Email: support@kid-friendly-ai.com
- Response Time: Within 24-48 hours
- Include: Environment details, error logs, and reproduction steps

---

This deployment guide provides comprehensive instructions for deploying the Kid-Friendly AI Buddy application across various platforms. Choose the deployment method that best fits your infrastructure and requirements.

*Last Updated: January 2024*