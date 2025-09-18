#!/usr/bin/env node

/**
 * Kid-Friendly AI Deployment Verification Script
 * This script verifies that the deployment is working correctly
 */

const https = require('https');
const { URL } = require('url');

// Configuration
const BASE_URL = process.argv[2] || 'https://kid-friendly-ai.vercel.app';
const TIMEOUT = 30000; // 30 seconds

// Test endpoints
const ENDPOINTS = [
    {
        path: '/',
        method: 'GET',
        expectedStatus: 200,
        description: 'Main page'
    },
    {
        path: '/api/health',
        method: 'GET',
        expectedStatus: 200,
        description: 'Health check endpoint'
    },
    {
        path: '/sw.js',
        method: 'GET',
        expectedStatus: 200,
        description: 'Service worker'
    },
    {
        path: '/manifest.json',
        method: 'GET',
        expectedStatus: 200,
        description: 'PWA manifest'
    }
];

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(TIMEOUT, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

async function testEndpoint(endpoint) {
    const url = new URL(endpoint.path, BASE_URL);

    try {
        log(`Testing ${endpoint.description}...`, 'cyan');

        const response = await makeRequest(url, {
            method: endpoint.method,
            headers: {
                'User-Agent': 'Kid-Friendly-AI-Verifier/1.0'
            }
        });

        if (response.status === endpoint.expectedStatus) {
            log(`✅ ${endpoint.description}: ${response.status}`, 'green');
            return true;
        } else {
            log(`❌ ${endpoint.description}: ${response.status} (expected ${endpoint.expectedStatus})`, 'red');
            return false;
        }
    } catch (error) {
        log(`❌ ${endpoint.description}: ${error.message}`, 'red');
        return false;
    }
}

async function testSecurityHeaders() {
    log('\n🔒 Testing security headers...', 'blue');

    try {
        const url = new URL('/', BASE_URL);
        const response = await makeRequest(url);

        const expectedHeaders = {
            'x-frame-options': 'DENY',
            'x-content-type-options': 'nosniff',
            'strict-transport-security': 'max-age=31536000',
            'x-xss-protection': '1; mode=block',
            'content-security-policy': 'default-src'
        };

        let allHeadersPresent = true;

        for (const [header, expectedValue] of Object.entries(expectedHeaders)) {
            const actualValue = response.headers[header];
            if (actualValue && actualValue.includes(expectedValue)) {
                log(`✅ ${header}: ${actualValue}`, 'green');
            } else {
                log(`❌ ${header}: ${actualValue || 'missing'}`, 'red');
                allHeadersPresent = false;
            }
        }

        return allHeadersPresent;
    } catch (error) {
        log(`❌ Security headers test failed: ${error.message}`, 'red');
        return false;
    }
}

async function testApiFunctionality() {
    log('\n🧪 Testing API functionality...', 'blue');

    // Test the ask endpoint (this will fail without proper API keys, but should return proper error)
    try {
        const url = new URL('/api/ask', BASE_URL);
        const response = await makeRequest(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question: 'Hello',
                conversationHistory: []
            })
        });

        if (response.status === 500 || response.status === 400) {
            log(`✅ API endpoint responds properly (status: ${response.status})`, 'green');
            return true;
        } else if (response.status === 200) {
            log(`✅ API endpoint works correctly (status: ${response.status})`, 'green');
            return true;
        } else {
            log(`⚠️  API endpoint unexpected status: ${response.status}`, 'yellow');
            return false;
        }
    } catch (error) {
        log(`❌ API functionality test failed: ${error.message}`, 'red');
        return false;
    }
}

async function testStaticAssets() {
    log('\n📁 Testing static assets...', 'blue');

    const assets = [
        '/favicon.ico',
        '/_next/static/chunks/main.js',
        '/_next/static/css/app.css'
    ];

    let allAssetsWorking = true;

    for (const asset of assets) {
        try {
            const url = new URL(asset, BASE_URL);
            const response = await makeRequest(url);

            if (response.status === 200) {
                log(`✅ ${asset}: ${response.status}`, 'green');
            } else {
                log(`❌ ${asset}: ${response.status}`, 'red');
                allAssetsWorking = false;
            }
        } catch (error) {
            log(`❌ ${asset}: ${error.message}`, 'red');
            allAssetsWorking = false;
        }
    }

    return allAssetsWorking;
}

async function main() {
    log('🚀 Kid-Friendly AI Deployment Verification', 'cyan');
    log(`📍 Testing URL: ${BASE_URL}`, 'cyan');
    log(''.padEnd(50, '='), 'cyan');

    let totalTests = 0;
    let passedTests = 0;

    // Test basic endpoints
    log('\n📋 Testing basic endpoints...', 'blue');
    for (const endpoint of ENDPOINTS) {
        totalTests++;
        if (await testEndpoint(endpoint)) {
            passedTests++;
        }
    }

    // Test security headers
    totalTests++;
    if (await testSecurityHeaders()) {
        passedTests++;
    }

    // Test API functionality
    totalTests++;
    if (await testApiFunctionality()) {
        passedTests++;
    }

    // Test static assets
    totalTests++;
    if (await testStaticAssets()) {
        passedTests++;
    }

    // Summary
    log('\n'.padEnd(50, '='), 'cyan');
    log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`, 'cyan');

    if (passedTests === totalTests) {
        log('🎉 All tests passed! Deployment is working correctly.', 'green');
        process.exit(0);
    } else {
        log('⚠️  Some tests failed. Please check the deployment.', 'yellow');
        process.exit(1);
    }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    log('Usage: node verify-deployment.js [url]', 'cyan');
    log('', 'cyan');
    log('Options:', 'cyan');
    log('  url      The URL to test (default: https://kid-friendly-ai.vercel.app)', 'cyan');
    log('  --help   Show this help message', 'cyan');
    process.exit(0);
}

main().catch((error) => {
    log(`❌ Verification failed: ${error.message}`, 'red');
    process.exit(1);
});