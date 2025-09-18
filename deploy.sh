#!/bin/bash

# Kid-Friendly AI Deployment Script
# This script automates the deployment process to Vercel

set -e

echo "🚀 Starting Kid-Friendly AI deployment..."

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18.x or higher."
        exit 1
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is not installed. Please install npm."
        exit 1
    fi

    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo "📦 Installing Vercel CLI..."
        npm install -g vercel
    fi

    # Check if git repository exists
    if [ ! -d ".git" ]; then
        echo "❌ This is not a git repository. Please initialize git first."
        exit 1
    fi

    echo "✅ All prerequisites are met!"
}

# Check environment variables
check_environment() {
    echo "🔍 Checking environment variables..."

    # Check if .env.local exists
    if [ -f ".env.local" ]; then
        echo "✅ Local environment file found"

        # Check for required variables
        if grep -q "OPENROUTER_API_KEY=" .env.local; then
            echo "✅ OpenRouter API key found"
        else
            echo "⚠️  OpenRouter API key not found in .env.local"
        fi

        if grep -q "OPENAI_API_KEY=" .env.local; then
            echo "✅ OpenAI API key found"
        else
            echo "⚠️  OpenAI API key not found in .env.local"
        fi
    else
        echo "⚠️  .env.local file not found. Please create it from .env.local.example"
    fi
}

# Run tests and build
build_project() {
    echo "🔨 Building project..."

    # Install dependencies
    echo "📦 Installing dependencies..."
    npm install

    # Run type checking
    echo "🔍 Running type checking..."
    npm run type-check

    # Run linting
    echo "🧹 Running linting..."
    npm run lint

    # Run tests if they exist
    if [ -d "__tests__" ] || [ -d "tests" ] || [ -f "jest.config.js" ]; then
        echo "🧪 Running tests..."
        npm test
    fi

    # Build the project
    echo "🏗️  Building project..."
    npm run build

    echo "✅ Project built successfully!"
}

# Deploy to Vercel
deploy_to_vercel() {
    echo "🚀 Deploying to Vercel..."

    # Check if user is logged in to Vercel
    if ! vercel whoami &> /dev/null; then
        echo "🔐 Logging in to Vercel..."
        vercel login
    fi

    # Deploy to production
    echo "🌐 Deploying to production..."
    vercel --prod

    echo "✅ Deployment completed!"
}

# Verify deployment
verify_deployment() {
    echo "🔍 Verifying deployment..."

    # Get the deployment URL
    DEPLOYMENT_URL=$(vercel ls --prod | head -n 2 | tail -n 1 | awk '{print $2}')

    if [ -z "$DEPLOYMENT_URL" ]; then
        echo "❌ Could not determine deployment URL"
        return
    fi

    echo "🌐 Deployment URL: $DEPLOYMENT_URL"

    # Test health endpoint
    echo "🏥 Testing health endpoint..."
    if curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL/api/health" | grep -q "200"; then
        echo "✅ Health endpoint is responding"
    else
        echo "❌ Health endpoint is not responding"
    fi

    # Test main page
    echo "📄 Testing main page..."
    if curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL" | grep -q "200"; then
        echo "✅ Main page is responding"
    else
        echo "❌ Main page is not responding"
    fi
}

# Main deployment process
main() {
    echo "🎯 Kid-Friendly AI Deployment Script"
    echo "====================================="

    check_prerequisites
    check_environment

    echo ""
    read -p "Do you want to continue with deployment? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi

    build_project
    deploy_to_vercel
    verify_deployment

    echo ""
    echo "🎉 Deployment completed successfully!"
    echo "📋 Next steps:"
    echo "   1. Check your Vercel dashboard for deployment status"
    echo "   2. Verify environment variables are set correctly"
    echo "   3. Test all features in the deployed application"
    echo "   4. Monitor API usage and costs"
    echo ""
    echo "📚 For more information, see DEPLOYMENT.md"
}

# Run main function
main "$@"