# Vercel Deployment Guide

This guide provides comprehensive instructions for deploying the Kid-Friendly AI application to Vercel.

## Prerequisites

1. **Node.js** (v18.x or higher)
2. **npm** or yarn package manager
3. **Git** repository
4. **Vercel account** (free tier available)
5. **API keys** for AI services

## Environment Variables Setup

### Required Environment Variables

1. **OpenRouter API Key**
   - Visit [OpenRouter.ai](https://openrouter.ai/keys)
   - Create an account and generate an API key
   - Add to Vercel environment variables as `OPENROUTER_API_KEY`

2. **OpenAI API Key**
   - Visit [OpenAI Platform](https://platform.openai.com/api-keys)
   - Create an API key
   - Add to Vercel environment variables as `OPENAI_API_KEY`

### Setting Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:
   ```
   OPENROUTER_API_KEY = your_openrouter_api_key_here
   OPENAI_API_KEY = your_openai_api_key_here
   NEXT_PUBLIC_SITE_URL = https://your-project-url.vercel.app
   NEXT_PUBLIC_VERCEL_URL = https://your-project-url.vercel.app
   NODE_ENV = production
   ```

## Deployment Methods

### Method 1: Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### Method 2: Git Integration

1. **Connect your Git repository** to Vercel
2. **Configure environment variables** in Vercel dashboard
3. **Push changes** to trigger automatic deployment:
   ```bash
   git push origin main
   ```

### Method 3: Vercel Dashboard

1. **Import project** from Git provider
2. **Configure build settings**:
   - Framework: **Next.js**
   - Build Command: `npm run build`
   - Output Directory: `.next`
3. **Set environment variables**
4. **Deploy**

## Configuration Overview

### Vercel Configuration (`vercel.json`)

The `vercel.json` file includes:

- **Build configuration** for Next.js
- **Route handling** for static assets and API routes
- **Security headers** including CSP, HSTS, and XSS protection
- **Cache control** settings for optimal performance
- **Function settings** for API routes with appropriate timeouts
- **Redirects and rewrites** for better URL structure
- **Cron jobs** for health checks

### Environment Variables

The `.env.example` file provides a comprehensive list of all available environment variables:

- **Required**: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`
- **Configuration**: Site URLs, feature flags
- **Optional**: Analytics, monitoring, advanced features

## Security Features

### Content Security Policy (CSP)

The deployment includes a strict CSP:
```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https:
style-src 'self' 'unsafe-inline' https:
img-src 'self' data: https:
font-src 'self' data: https:
connect-src 'self' https: wss:
media-src 'self' blob: https:
worker-src 'self' blob:
frame-src 'self'
form-action 'self'
base-uri 'self'
```

### Security Headers

- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **X-XSS-Protection**: 1; mode=block
- **Strict-Transport-Security**: max-age=31536000; includeSubDomains; preload
- **Permissions-Policy**: Restricted access to camera, microphone, and geolocation

## Performance Optimization

### Caching Strategy

- **Static assets**: 1 year immutable cache
- **Service worker**: No-cache, must-revalidate
- **API routes**: No-cache to ensure fresh responses
- **Next.js static files**: 1 year immutable cache

### Function Configuration

- **API routes**: Optimized memory and timeout settings
- **Streaming responses**: Configured for real-time AI interactions
- **Regional deployment**: Multiple regions for better performance

## Monitoring and Analytics

### Built-in Monitoring

- **Vercel Analytics**: Automatic performance monitoring
- **Health checks**: Cron job every 6 hours
- **Error tracking**: Through Vercel's built-in error logging

### Optional Add-ons

Add these environment variables to enable additional features:
```bash
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX  # Google Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS=true  # Vercel Analytics
```

## Post-Deployment Checklist

1. **Verify environment variables** are properly set
2. **Test all API endpoints**:
   - `/api/health` - Health check
   - `/api/ask` - AI chat functionality
   - `/api/tts` - Text-to-speech
   - `/api/transcribe` - Speech-to-text

3. **Test PWA features**:
   - Service worker registration
   - Offline functionality
   - Install prompts

4. **Verify security headers** using browser dev tools
5. **Test accessibility features**
6. **Monitor performance** using Vercel Analytics
7. **Check API usage** and costs

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Review build logs in Vercel dashboard

2. **API Errors**
   - Verify API keys are correctly set
   - Check API key permissions and billing
   - Monitor rate limits

3. **CORS Issues**
   - Verify `NEXT_PUBLIC_SITE_URL` is correct
   - Check API route headers

4. **Performance Issues**
   - Monitor function execution times
   - Check memory usage
   - Review caching headers

### Debug Commands

```bash
# Check Vercel deployment logs
vercel logs

# View environment variables
vercel env ls

# Redeploy latest commit
vercel redeploy

# Remove deployment
vercel remove [deployment-url]
```

## Scaling and Production Considerations

### Cost Optimization

- **Monitor API usage** to control costs
- **Implement rate limiting** for high-traffic scenarios
- **Use caching** to reduce API calls

### High Availability

- **Multi-region deployment** configured
- **Health monitoring** with cron jobs
- **Automatic failover** through Vercel's infrastructure

### Maintenance

- **Regular dependency updates**
- **Security patching**
- **Performance monitoring**
- **API key rotation**

## Support

For deployment issues:
1. Check Vercel's [documentation](https://vercel.com/docs)
2. Review deployment logs
3. Verify environment variable configuration
4. Test with local development setup

## Backup and Recovery

- **Git repository** serves as source of truth
- **Environment variables** stored securely in Vercel
- **Automatic deployments** from Git pushes
- **Rollback capability** through Vercel dashboard

---

This deployment configuration provides a production-ready setup for the Kid-Friendly AI application with comprehensive security, performance, and monitoring features.