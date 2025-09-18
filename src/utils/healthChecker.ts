/**
 * Health checking utilities for the kid-friendly-ai monitoring system
 * Provides comprehensive health endpoints, dependency monitoring, database checks,
 * API monitoring, third-party service checks, and network connectivity verification
 */

import {
  HealthStatus,
  HealthMetrics,
  HealthDependency,
  HealthCheck,
  ServiceDependency
} from '../types/monitoring';
import { monitoringManager } from './monitoringManager';
import { networkMonitor } from './networkMonitor';

export interface HealthCheckConfig {
  name: string;
  type: 'http' | 'tcp' | 'database' | 'api' | 'custom';
  endpoint?: string;
  timeout: number;
  interval: number;
  retries: number;
  threshold: {
    responseTime: number;
    errorRate: number;
    availability: number;
  };
}

export interface HealthCheckResult {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'timeout';
  responseTime: number;
  timestamp: number;
  error?: string;
  details?: Record<string, any>;
}

export class HealthChecker {
  private static instance: HealthChecker;
  private checks: Map<string, HealthCheckConfig> = new Map();
  private results: Map<string, HealthCheckResult[]> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private subscribers: Set<(result: HealthCheckResult) => void> = new Set();

  private constructor() {
    this.initializeDefaultChecks();
  }

  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  private initializeDefaultChecks(): void {
    // System health check
    this.registerHealthCheck({
      name: 'System Health',
      type: 'custom',
      timeout: 5000,
      interval: 30000,
      retries: 3,
      threshold: {
        responseTime: 1000,
        errorRate: 1,
        availability: 99
      }
    });

    // Network health check
    this.registerHealthCheck({
      name: 'Network Connectivity',
      type: 'http',
      endpoint: 'https://www.google.com',
      timeout: 10000,
      interval: 30000,
      retries: 3,
      threshold: {
        responseTime: 2000,
        errorRate: 5,
        availability: 95
      }
    });

    // API health check
    this.registerHealthCheck({
      name: 'API Endpoints',
      type: 'api',
      endpoint: '/api/health',
      timeout: 5000,
      interval: 60000,
      retries: 2,
      threshold: {
        responseTime: 1000,
        errorRate: 1,
        availability: 99
      }
    });

    // Memory health check
    this.registerHealthCheck({
      name: 'Memory Usage',
      type: 'custom',
      timeout: 1000,
      interval: 30000,
      retries: 1,
      threshold: {
        responseTime: 100,
        errorRate: 0,
        availability: 100
      }
    });
  }

  public registerHealthCheck(config: HealthCheckConfig): void {
    const id = this.generateCheckId(config.name);
    this.checks.set(id, config);
    this.results.set(id, []);

    // Start monitoring
    this.startHealthCheck(id, config);
  }

  private generateCheckId(name: string): string {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  private startHealthCheck(id: string, config: HealthCheckConfig): void {
    // Initial check
    this.performHealthCheck(id, config);

    // Set up interval
    const interval = setInterval(() => {
      this.performHealthCheck(id, config);
    }, config.interval);

    this.intervals.set(id, interval);
  }

  private async performHealthCheck(id: string, config: HealthCheckConfig): Promise<void> {
    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      switch (config.type) {
        case 'http':
          result = await this.checkHttpEndpoint(config);
          break;
        case 'tcp':
          result = await this.checkTcpEndpoint(config);
          break;
        case 'database':
          result = await this.checkDatabase(config);
          break;
        case 'api':
          result = await this.checkApiEndpoint(config);
          break;
        case 'custom':
          result = await this.checkCustom(config);
          break;
        default:
          throw new Error(`Unknown health check type: ${config.type}`);
      }
    } catch (error) {
      result = {
        id,
        name: config.name,
        status: 'fail',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }

    // Store result
    const results = this.results.get(id) || [];
    results.push(result);

    // Keep only last 100 results
    if (results.length > 100) {
      results.splice(0, results.length - 100);
    }

    this.results.set(id, results);

    // Notify subscribers
    this.notifySubscribers(result);

    // Update monitoring manager
    this.updateMonitoringManager(id, result);
  }

  private async checkHttpEndpoint(config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(config.endpoint!, {
        method: 'GET',
        timeout: config.timeout,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          id: this.generateCheckId(config.name),
          name: config.name,
          status: 'pass',
          responseTime,
          timestamp: Date.now(),
          details: {
            statusCode: response.status,
            headers: Object.fromEntries(response.headers.entries())
          }
        };
      } else {
        return {
          id: this.generateCheckId(config.name),
          name: config.name,
          status: 'fail',
          responseTime,
          timestamp: Date.now(),
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        id: this.generateCheckId(config.name),
        name: config.name,
        status: 'fail',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkTcpEndpoint(config: HealthCheckConfig): Promise<HealthCheckResult> {
    // TCP health check would require a different implementation
    // For now, we'll simulate it with a fetch to a known TCP service
    return this.checkHttpEndpoint(config);
  }

  private async checkDatabase(config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check database connectivity through our API
      const response = await fetch('/api/health', {
        method: 'GET',
        timeout: config.timeout
      });

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      if (response.ok && data.checks?.database) {
        return {
          id: this.generateCheckId(config.name),
          name: config.name,
          status: 'pass',
          responseTime,
          timestamp: Date.now(),
          details: {
            database: data.checks.database,
            metrics: data.metrics?.memory
          }
        };
      } else {
        return {
          id: this.generateCheckId(config.name),
          name: config.name,
          status: 'fail',
          responseTime,
          timestamp: Date.now(),
          error: 'Database health check failed'
        };
      }
    } catch (error) {
      return {
        id: this.generateCheckId(config.name),
        name: config.name,
        status: 'fail',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkApiEndpoint(config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(config.endpoint!, {
        method: 'GET',
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          id: this.generateCheckId(config.name),
          name: config.name,
          status: 'pass',
          responseTime,
          timestamp: Date.now(),
          details: {
            statusCode: response.status,
            responseTime: data.responseTime,
            uptime: data.uptime,
            version: data.version
          }
        };
      } else {
        return {
          id: this.generateCheckId(config.name),
          name: config.name,
          status: 'fail',
          responseTime,
          timestamp: Date.now(),
          error: `API Error: ${response.status} ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        id: this.generateCheckId(config.name),
        name: config.name,
        status: 'fail',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkCustom(config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      switch (config.name) {
        case 'System Health':
          return await this.checkSystemHealth(config);
        case 'Memory Usage':
          return await this.checkMemoryUsage(config);
        case 'Network Connectivity':
          return await this.checkNetworkConnectivity(config);
        default:
          throw new Error(`Unknown custom check: ${config.name}`);
      }
    } catch (error) {
      return {
        id: this.generateCheckId(config.name),
        name: config.name,
        status: 'fail',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkSystemHealth(config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = Date.now();

    // Check various system metrics
    const checks = {
      memory: this.checkMemoryThreshold(),
      network: networkMonitor.isOnline(),
      performance: this.checkPerformanceMetrics(),
      errors: this.checkErrorRates()
    };

    const allPassed = Object.values(checks).every(check => check === true);
    const responseTime = Date.now() - startTime;

    return {
      id: this.generateCheckId(config.name),
      name: config.name,
      status: allPassed ? 'pass' : 'fail',
      responseTime,
      timestamp: Date.now(),
      details: {
        checks,
        summary: allPassed ? 'All systems operational' : 'Some systems degraded'
      }
    };
  }

  private async checkMemoryUsage(config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = Date.now();

    if (typeof window === 'undefined' || !(window as any).performance?.memory) {
      return {
        id: this.generateCheckId(config.name),
        name: config.name,
        status: 'pass',
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
        details: { message: 'Memory monitoring not available' }
      };
    }

    const memory = (window as any).performance.memory;
    const memoryPercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

    const status = memoryPercentage < 90 ? 'pass' : 'fail';
    const responseTime = Date.now() - startTime;

    return {
      id: this.generateCheckId(config.name),
      name: config.name,
      status,
      responseTime,
      timestamp: Date.now(),
      details: {
        memoryPercentage: Math.round(memoryPercentage * 100) / 100,
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
      }
    };
  }

  private async checkNetworkConnectivity(config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const networkInfo = networkMonitor.getCurrentInfo();

    const status = networkInfo.online && networkInfo.reliability > 0.5 ? 'pass' : 'fail';
    const responseTime = Date.now() - startTime;

    return {
      id: this.generateCheckId(config.name),
      name: config.name,
      status,
      responseTime,
      timestamp: Date.now(),
      details: {
        online: networkInfo.online,
        reliability: networkInfo.reliability,
        effectiveType: networkInfo.effectiveType,
        downlink: networkInfo.downlink,
        rtt: networkInfo.rtt
      }
    };
  }

  private checkMemoryThreshold(): boolean {
    if (typeof window === 'undefined' || !(window as any).performance?.memory) {
      return true;
    }

    const memory = (window as any).performance.memory;
    const memoryPercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    return memoryPercentage < 90;
  }

  private checkPerformanceMetrics(): boolean {
    // Check if performance metrics are within acceptable ranges
    const metrics = monitoringManager.getPerformanceMetrics();
    const recentMetrics = metrics.filter(m => Date.now() - m.timestamp < 300000); // Last 5 minutes

    if (recentMetrics.length === 0) return true;

    const avgResponseTime = recentMetrics
      .filter(m => m.name === 'responseTime')
      .reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;

    return avgResponseTime < 2000; // Less than 2 seconds average response time
  }

  private checkErrorRates(): boolean {
    const errorMetrics = monitoringManager.getAlerts();
    const recentErrors = errorMetrics.filter(a =>
      a.status === 'active' && Date.now() - a.timestamp < 300000
    );

    return recentErrors.length < 5; // Less than 5 active errors in last 5 minutes
  }

  private notifySubscribers(result: HealthCheckResult): void {
    this.subscribers.forEach(subscriber => {
      try {
        subscriber(result);
      } catch (error) {
        console.error('Error in health check subscriber:', error);
      }
    });
  }

  private updateMonitoringManager(id: string, result: HealthCheckResult): void {
    const overallStatus = result.status === 'pass' ? 'healthy' : 'critical';
    const description = `${result.name}: ${result.status.toUpperCase()}`;

    monitoringManager.updateHealthStatus(id, overallStatus, description);
  }

  // Public API
  public subscribe(callback: (result: HealthCheckResult) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  public getCheckResults(checkId?: string): HealthCheckResult[] | Map<string, HealthCheckResult[]> {
    if (checkId) {
      return this.results.get(checkId) || [];
    }
    return this.results;
  }

  public getHealthSummary(): {
    totalChecks: number;
    passingChecks: number;
    failingChecks: number;
    averageResponseTime: number;
    overallStatus: 'healthy' | 'degraded' | 'critical';
  } {
    let totalChecks = 0;
    let passingChecks = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    this.results.forEach(results => {
      if (results.length > 0) {
        const latestResult = results[results.length - 1];
        totalChecks++;
        totalResponseTime += latestResult.responseTime;
        responseTimeCount++;

        if (latestResult.status === 'pass') {
          passingChecks++;
        }
      }
    });

    const averageResponseTime = responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
    const failingChecks = totalChecks - passingChecks;
    const failureRate = totalChecks > 0 ? failingChecks / totalChecks : 0;

    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (failureRate > 0.5) {
      overallStatus = 'critical';
    } else if (failureRate > 0.1) {
      overallStatus = 'degraded';
    }

    return {
      totalChecks,
      passingChecks,
      failingChecks,
      averageResponseTime,
      overallStatus
    };
  }

  public async runAllChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const [id, config] of this.checks) {
      try {
        const result = await this.performSingleCheck(id, config);
        results.push(result);
      } catch (error) {
        results.push({
          id,
          name: config.name,
          status: 'fail',
          responseTime: 0,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  private async performSingleCheck(id: string, config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = Date.now();

    switch (config.type) {
      case 'http':
        return this.checkHttpEndpoint(config);
      case 'api':
        return this.checkApiEndpoint(config);
      case 'custom':
        return this.checkCustom(config);
      default:
        throw new Error(`Unsupported check type: ${config.type}`);
    }
  }

  public removeHealthCheck(name: string): void {
    const id = this.generateCheckId(name);

    // Stop interval
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }

    // Remove from collections
    this.checks.delete(id);
    this.results.delete(id);
  }

  public getCheckConfigs(): HealthCheckConfig[] {
    return Array.from(this.checks.values());
  }

  public stop(): void {
    // Stop all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
  }
}

// Export singleton instance
export const healthChecker = HealthChecker.getInstance();

// Export utility functions
export const registerHealthCheck = (config: HealthCheckConfig) => {
  healthChecker.registerHealthCheck(config);
};

export const getHealthSummary = () => healthChecker.getHealthSummary();
export const runAllHealthChecks = () => healthChecker.runAllChecks();
export const getHealthCheckResults = (checkId?: string) => healthChecker.getCheckResults(checkId);
export const subscribeToHealthChecks = (callback: (result: HealthCheckResult) => void) => {
  return healthChecker.subscribe(callback);
};