#!/usr/bin/env node

/**
 * Health Check Script for Kid-Friendly AI Application
 *
 * This script performs comprehensive health checks for the application
 * including database connectivity, API endpoints, and system resources.
 */

const https = require('https');
const http = require('http');
const { promisify } = require('util');
const redis = require('redis');
const { exec } = require('child_process');
const execAsync = promisify(exec);

// Configuration
const config = {
    port: process.env.PORT || 3000,
    host: process.env.HOSTNAME || 'localhost',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: process.env.REDIS_PORT || 6379,
    redisPassword: process.env.REDIS_PASSWORD,
    healthCheckTimeout: 5000,
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
    maxCpuUsage: 80, // 80%
};

// Colors for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

// Logger
const logger = {
    info: (message) => console.log(`${colors.blue}[INFO]${colors.reset} ${message}`),
    success: (message) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
    warning: (message) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`),
    error: (message) => console.log(`${colors.red}[ERROR]${colors.reset} ${message}`),
};

// Health check results
let healthStatus = {
    overall: true,
    checks: {},
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
};

// Make HTTP request
function makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;

        const req = protocol.request(url, options, (res) => {
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

// Check application HTTP endpoint
async function checkApplicationHealth() {
    try {
        const url = `http://${config.host}:${config.port}/health`;
        const response = await makeHttpRequest(url);

        if (response.statusCode === 200) {
            healthStatus.checks.application = {
                status: 'healthy',
                statusCode: response.statusCode,
                responseTime: Date.now() - startTime,
                message: 'Application is responding',
            };
            logger.success('Application health check passed');
        } else {
            healthStatus.checks.application = {
                status: 'unhealthy',
                statusCode: response.statusCode,
                responseTime: Date.now() - startTime,
                message: `Application returned status ${response.statusCode}`,
            };
            logger.error(`Application health check failed: HTTP ${response.statusCode}`);
            healthStatus.overall = false;
        }
    } catch (error) {
        healthStatus.checks.application = {
            status: 'unhealthy',
            error: error.message,
            message: 'Application is not responding',
        };
        logger.error(`Application health check failed: ${error.message}`);
        healthStatus.overall = false;
    }
}

// Check Redis connection
async function checkRedisConnection() {
    try {
        const client = redis.createClient({
            host: config.redisHost,
            port: config.redisPort,
            password: config.redisPassword,
            connectTimeout: 5000,
        });

        await client.connect();
        await client.ping();

        healthStatus.checks.redis = {
            status: 'healthy',
            message: 'Redis connection is working',
        };

        await client.quit();
        logger.success('Redis health check passed');
    } catch (error) {
        healthStatus.checks.redis = {
            status: 'unhealthy',
            error: error.message,
            message: 'Redis connection failed',
        };
        logger.warning(`Redis health check failed: ${error.message}`);
    }
}

// Check system resources
async function checkSystemResources() {
    try {
        // Memory usage
        const memoryUsage = process.memoryUsage();
        const memoryUsed = memoryUsage.heapUsed + memoryUsage.external;

        healthStatus.checks.memory = {
            status: memoryUsed < config.maxMemoryUsage ? 'healthy' : 'warning',
            used: memoryUsed,
            max: config.maxMemoryUsage,
            percentage: Math.round((memoryUsed / config.maxMemoryUsage) * 100),
            message: `Memory usage: ${Math.round(memoryUsed / 1024 / 1024)}MB`,
        };

        if (memoryUsed >= config.maxMemoryUsage) {
            logger.warning(`Memory usage is high: ${Math.round(memoryUsed / 1024 / 1024)}MB`);
        }

        // CPU usage (approximate)
        const startUsage = process.cpuUsage();
        await new Promise(resolve => setTimeout(resolve, 100));
        const endUsage = process.cpuUsage(startUsage);
        const cpuUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds

        healthStatus.checks.cpu = {
            status: 'healthy',
            usage: cpuUsage,
            message: `CPU usage: ${cpuUsage.toFixed(2)}s`,
        };

        // Uptime
        const uptime = process.uptime();
        healthStatus.checks.uptime = {
            status: 'healthy',
            seconds: uptime,
            message: `Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        };

        logger.success('System resources check passed');
    } catch (error) {
        healthStatus.checks.system = {
            status: 'unhealthy',
            error: error.message,
            message: 'System resources check failed',
        };
        logger.error(`System resources check failed: ${error.message}`);
        healthStatus.overall = false;
    }
}

// Check API endpoints
async function checkApiEndpoints() {
    const endpoints = [
        { path: '/api/health', name: 'Health API' },
        { path: '/api/config', name: 'Config API' },
    ];

    healthStatus.checks.api = {
        status: 'healthy',
        endpoints: {},
    };

    for (const endpoint of endpoints) {
        try {
            const url = `http://${config.host}:${config.port}${endpoint.path}`;
            const response = await makeHttpRequest(url);

            healthStatus.checks.api.endpoints[endpoint.name] = {
                status: response.statusCode === 200 ? 'healthy' : 'unhealthy',
                statusCode: response.statusCode,
                message: `${endpoint.name} is ${response.statusCode === 200 ? 'working' : 'not working'}`,
            };

            if (response.statusCode !== 200) {
                healthStatus.checks.api.status = 'unhealthy';
                healthStatus.overall = false;
                logger.error(`${endpoint.name} failed: HTTP ${response.statusCode}`);
            }
        } catch (error) {
            healthStatus.checks.api.endpoints[endpoint.name] = {
                status: 'unhealthy',
                error: error.message,
                message: `${endpoint.name} is not responding`,
            };
            healthStatus.checks.api.status = 'unhealthy';
            healthStatus.overall = false;
            logger.error(`${endpoint.name} failed: ${error.message}`);
        }
    }

    if (healthStatus.checks.api.status === 'healthy') {
        logger.success('API endpoints check passed');
    }
}

// Check environment variables
function checkEnvironmentVariables() {
    const requiredVars = ['NODE_ENV', 'PORT', 'HOSTNAME'];
    const optionalVars = ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'REDIS_HOST'];

    healthStatus.checks.environment = {
        status: 'healthy',
        variables: {},
    };

    // Check required variables
    for (const varName of requiredVars) {
        const value = process.env[varName];
        healthStatus.checks.environment.variables[varName] = {
            status: value ? 'set' : 'missing',
            required: true,
            value: value ? '***' : null,
        };

        if (!value) {
            healthStatus.checks.environment.status = 'unhealthy';
            healthStatus.overall = false;
            logger.error(`Required environment variable ${varName} is missing`);
        }
    }

    // Check optional variables
    for (const varName of optionalVars) {
        const value = process.env[varName];
        healthStatus.checks.environment.variables[varName] = {
            status: value ? 'set' : 'missing',
            required: false,
            value: value ? '***' : null,
        };
    }

    if (healthStatus.checks.environment.status === 'healthy') {
        logger.success('Environment variables check passed');
    }
}

// Generate health report
function generateHealthReport() {
    const report = {
        status: healthStatus.overall ? 'healthy' : 'unhealthy',
        timestamp: healthStatus.timestamp,
        version: healthStatus.version,
        uptime: process.uptime(),
        checks: healthStatus.checks,
        summary: {
            totalChecks: Object.keys(healthStatus.checks).length,
            passedChecks: Object.values(healthStatus.checks).filter(check =>
                check.status === 'healthy' || (check.endpoints && Object.values(check.endpoints).every(e => e.status === 'healthy'))
            ).length,
        },
    };

    return report;
}

// Main health check function
async function performHealthCheck() {
    const startTime = Date.now();

    logger.info('Starting comprehensive health check...');

    // Reset health status
    healthStatus = {
        overall: true,
        checks: {},
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || 'unknown',
    };

    // Perform all health checks
    await Promise.all([
        checkApplicationHealth(),
        checkRedisConnection(),
        checkSystemResources(),
        checkApiEndpoints(),
    ]);

    checkEnvironmentVariables();

    // Generate report
    const report = generateHealthReport();

    // Log results
    const duration = Date.now() - startTime;
    logger.info(`Health check completed in ${duration}ms`);

    if (healthStatus.overall) {
        logger.success('Overall health status: HEALTHY');
        process.exit(0);
    } else {
        logger.error('Overall health status: UNHEALTHY');
        process.exit(1);
    }
}

// Export for external use
if (require.main === module) {
    performHealthCheck().catch(error => {
        logger.error(`Health check failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    performHealthCheck,
    generateHealthReport,
    healthStatus,
};