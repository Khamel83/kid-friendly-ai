import type { NextApiRequest, NextApiResponse } from 'next';

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: boolean;
    redis: boolean;
    api: boolean;
    memory: boolean;
    cpu: boolean;
  };
  metrics: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponse<HealthResponse>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const healthStatus: HealthResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      checks: {
        database: checkDatabase(),
        redis: checkRedis(),
        api: checkApi(),
        memory: checkMemory(),
        cpu: checkCpu(),
      },
      metrics: {
        memory: getMemoryMetrics(),
        cpu: getCpuMetrics(),
      },
    };

    // Determine overall health status
    const failingChecks = Object.values(healthStatus.checks).filter(check => !check);
    if (failingChecks.length > 0) {
      healthStatus.status = 'unhealthy';
    }

    // Set appropriate HTTP status
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    const errorResponse: HealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'unknown',
      checks: {
        database: false,
        redis: false,
        api: false,
        memory: false,
        cpu: false,
      },
      metrics: {
        memory: { used: 0, total: 0, percentage: 0 },
        cpu: { usage: 0 },
      },
    };

    res.status(503).json(errorResponse);
  }
}

function checkDatabase(): boolean {
  // For now, return true as we don't have a database dependency
  // In a real application, you would check database connectivity here
  return true;
}

function checkRedis(): boolean {
  // Check if Redis is configured and accessible
  if (process.env.REDIS_ENABLED === 'true') {
    // In a real application, you would check Redis connectivity here
    return true;
  }
  return true; // Redis is optional
}

function checkApi(): boolean {
  // Check if API keys are configured
  const hasOpenRouterKey = process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== '';
  const hasOpenAIKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== '';

  return hasOpenRouterKey || hasOpenAIKey;
}

function checkMemory(): boolean {
  const memoryUsage = process.memoryUsage();
  const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  return memoryPercentage < 90; // Alert if memory usage is above 90%
}

function checkCpu(): boolean {
  // For now, return true as CPU usage checking requires more complex monitoring
  // In a real application, you might use process.cpuUsage() or system monitoring
  return true;
}

function getMemoryMetrics() {
  const memoryUsage = process.memoryUsage();
  const systemMemory = require('os').totalmem();

  return {
    used: memoryUsage.heapUsed,
    total: memoryUsage.heapTotal,
    percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
  };
}

function getCpuMetrics() {
  // Basic CPU usage approximation
  const cpuUsage = process.cpuUsage();
  return {
    usage: Math.round((cpuUsage.user + cpuUsage.system) / 1000000), // Convert to seconds
  };
} 