#!/usr/bin/env node

/**
 * Standalone health check script for Docker containers
 * This script can be used as a health check for the Next.js application
 */

const http = require('http');
const https = require('https');

const config = {
    port: process.env.PORT || 3000,
    host: process.env.HOSTNAME || 'localhost',
    healthCheckTimeout: 5000,
    maxRetries: 3,
    retryDelay: 1000,
};

// Logger
const logger = {
    info: (message) => console.log(`[INFO] ${message}`),
    error: (message) => console.error(`[ERROR] ${message}`),
    success: (message) => console.log(`[SUCCESS] ${message}`),
};

// Make HTTP request
function makeHttpRequest(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.request(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data,
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(config.healthCheckTimeout, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Health check function
async function performHealthCheck() {
    let lastError = null;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            const url = `http://${config.host}:${config.port}/api/health`;
            logger.info(`Attempt ${attempt}/${config.maxRetries}: Checking ${url}`);

            const response = await makeHttpRequest(url);

            if (response.statusCode === 200) {
                try {
                    const healthData = JSON.parse(response.data);
                    if (healthData.status === 'healthy') {
                        logger.success('Health check passed');
                        process.exit(0);
                    } else {
                        logger.error(`Application reported unhealthy status: ${healthData.status}`);
                        lastError = new Error(`Application status: ${healthData.status}`);
                    }
                } catch (parseError) {
                    logger.error('Failed to parse health check response');
                    lastError = parseError;
                }
            } else {
                logger.error(`HTTP ${response.statusCode}: Application not responding properly`);
                lastError = new Error(`HTTP ${response.statusCode}`);
            }
        } catch (error) {
            logger.error(`Health check attempt ${attempt} failed: ${error.message}`);
            lastError = error;
        }

        if (attempt < config.maxRetries) {
            logger.info(`Retrying in ${config.retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
    }

    logger.error('Health check failed after all attempts');
    if (lastError) {
        logger.error(`Last error: ${lastError.message}`);
    }
    process.exit(1);
}

// Execute health check
if (require.main === module) {
    performHealthCheck().catch(error => {
        logger.error(`Health check failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { performHealthCheck };