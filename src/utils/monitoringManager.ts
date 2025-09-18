/**
 * Centralized monitoring management system for kid-friendly-ai
 * Provides comprehensive system health monitoring, performance metrics collection,
 * error tracking, resource monitoring, and real-time dashboards
 */

import {
  HealthStatus,
  HealthMetrics,
  PerformanceMetric,
  PerformanceThreshold,
  ResourceUsage,
  MonitoringConfig,
  ServiceDependency,
  MonitoringEvent,
  Alert,
  Incident
} from '../types/monitoring';
// import disabled for build
import { NetworkMonitor } from './networkMonitor';
import { errorHandler } from './errorHandler';

export class MonitoringManager {
  private static instance: MonitoringManager;
  private config: MonitoringConfig;
  private performanceMonitor: PerformanceMonitor;
  private networkMonitor: NetworkMonitor;
  private healthChecks: Map<string, HealthStatus> = new Map();
  private serviceDependencies: Map<string, ServiceDependency> = new Map();
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private eventListeners: Set<(event: MonitoringEvent) => void> = new Set();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  private constructor() {
    this.config = this.getDefaultConfig();
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.networkMonitor = NetworkMonitor.getInstance();
    this.initialize();
  }

  static getInstance(): MonitoringManager {
    if (!MonitoringManager.instance) {
      MonitoringManager.instance = new MonitoringManager();
    }
    return MonitoringManager.instance;
  }

  private getDefaultConfig(): MonitoringConfig {
    return {
      enabled: true,
      samplingRate: 1.0,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
      alerting: {
        enabled: true,
        defaultChannels: [],
        suppressionRules: []
      },
      performance: {
        thresholds: {
          responseTime: { warning: 1000, critical: 5000, unit: 'ms', comparison: 'greater_than' },
          errorRate: { warning: 1, critical: 5, unit: '%', comparison: 'greater_than' },
          memoryUsage: { warning: 80, critical: 90, unit: '%', comparison: 'greater_than' },
          cpuUsage: { warning: 70, critical: 85, unit: '%', comparison: 'greater_than' }
        },
        aggregationInterval: 60000 // 1 minute
      },
      health: {
        checkInterval: 30000, // 30 seconds
        timeout: 10000, // 10 seconds
        retryCount: 3
      },
      incidents: {
        autoCreate: true,
        autoAssign: false
      },
      capacity: {
        forecastingEnabled: true,
        alertThresholds: {
          cpu: 85,
          memory: 90,
          disk: 80
        }
      }
    };
  }

  private initialize(): void {
    if (typeof window === 'undefined') return;

    // Set up default monitoring
    this.setupPerformanceMonitoring();
    this.setupHealthMonitoring();
    this.setupResourceMonitoring();
    this.startPeriodicMonitoring();
  }

  private setupPerformanceMonitoring(): void {
    // Set up performance thresholds
    Object.entries(this.config.performance.thresholds).forEach(([name, threshold]) => {
      this.performanceMonitor.setThreshold(name, threshold.warning, threshold.critical, threshold.unit);
    });

    // Add observer for performance metrics
    this.performanceMonitor.addObserver((metric) => {
      this.recordPerformanceMetric({
        id: `${metric.name}_${metric.timestamp}`,
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        timestamp: metric.timestamp,
        tags: { source: 'performance' },
        threshold: this.config.performance.thresholds[metric.name]
      });
    });
  }

  private setupHealthMonitoring(): void {
    // Register default health checks
    this.registerHealthCheck({
      id: 'system_health',
      name: 'System Health',
      status: 'healthy',
      timestamp: Date.now(),
      description: 'Overall system health status',
      metrics: this.getSystemHealthMetrics(),
      dependencies: [],
      checks: []
    });

    // Register network health check
    this.registerHealthCheck({
      id: 'network_health',
      name: 'Network Health',
      status: 'healthy',
      timestamp: Date.now(),
      description: 'Network connectivity and performance',
      metrics: this.getNetworkHealthMetrics(),
      dependencies: [],
      checks: []
    });
  }

  private setupResourceMonitoring(): void {
    // Start resource monitoring
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window as any).performance) {
      setInterval(() => {
        this.recordResourceMetrics();
      }, 30000); // Every 30 seconds
    }
  }

  private startPeriodicMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
      this.aggregateMetrics();
      this.checkAlertConditions();
      this.cleanupOldData();
    }, this.config.health.checkInterval);
  }

  // Health Monitoring
  public registerHealthCheck(healthCheck: HealthStatus): void {
    this.healthChecks.set(healthCheck.id, healthCheck);
    this.emitEvent({
      id: `health_check_${healthCheck.id}`,
      type: 'health',
      source: 'monitoring',
      timestamp: Date.now(),
      data: healthCheck,
      tags: { checkId: healthCheck.id }
    });
  }

  public updateHealthStatus(id: string, status: 'healthy' | 'warning' | 'critical', description?: string): void {
    const healthCheck = this.healthChecks.get(id);
    if (healthCheck) {
      healthCheck.status = status;
      healthCheck.timestamp = Date.now();
      if (description) {
        healthCheck.description = description;
      }
      this.healthChecks.set(id, healthCheck);

      this.emitEvent({
        id: `health_update_${id}`,
        type: 'health',
        source: 'monitoring',
        timestamp: Date.now(),
        data: { id, status, description },
        tags: { checkId: id, status }
      });
    }
  }

  public getHealthStatus(id?: string): HealthStatus | HealthStatus[] {
    if (id) {
      return this.healthChecks.get(id)!;
    }
    return Array.from(this.healthChecks.values());
  }

  private async performHealthChecks(): Promise<void> {
    const promises = Array.from(this.healthChecks.values()).map(async (healthCheck) => {
      try {
        // Perform actual health check logic here
        const newMetrics = await this.getHealthMetrics(healthCheck.id);
        healthCheck.metrics = newMetrics;
        healthCheck.timestamp = Date.now();

        // Update status based on metrics
        const newStatus = this.evaluateHealthStatus(newMetrics);
        if (newStatus !== healthCheck.status) {
          this.updateHealthStatus(healthCheck.id, newStatus, `Health status changed to ${newStatus}`);
        }

        this.healthChecks.set(healthCheck.id, healthCheck);
      } catch (error) {
        this.updateHealthStatus(healthCheck.id, 'critical', `Health check failed: ${error}`);
      }
    });

    await Promise.all(promises);
  }

  private async getHealthMetrics(checkId: string): Promise<HealthMetrics> {
    switch (checkId) {
      case 'system_health':
        return this.getSystemHealthMetrics();
      case 'network_health':
        return this.getNetworkHealthMetrics();
      default:
        return this.getSystemHealthMetrics();
    }
  }

  private getSystemHealthMetrics(): HealthMetrics {
    const uptime = Date.now() - this.startTime;
    const memoryUsage = this.getMemoryUsage();

    return {
      availability: 100, // Assume 100% until we have actual data
      responseTime: this.performanceMonitor.getMetricsSummary().avg,
      errorRate: this.getErrorRate(),
      throughput: this.getThroughput(),
      resourceUsage: memoryUsage
    };
  }

  private getNetworkHealthMetrics(): HealthMetrics {
    const networkInfo = this.networkMonitor.getCurrentInfo();
    const networkMetrics = this.networkMonitor.getMetrics();

    return {
      availability: networkInfo.online ? 100 : 0,
      responseTime: networkInfo.rtt,
      errorRate: networkMetrics.packetLoss * 100,
      throughput: networkInfo.downlink,
      resourceUsage: {
        cpu: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
        memory: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
        disk: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
        network: { used: networkMetrics.bandwidthUsage, available: 100, total: 100, percentage: 0, unit: 'MB', trend: 'stable' }
      }
    };
  }

  private getMemoryUsage(): ResourceUsage {
    if (typeof window === 'undefined' || !(window as any).performance?.memory) {
      return {
        cpu: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
        memory: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
        disk: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
        network: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' }
      };
    }

    const memory = (window as any).performance.memory;
    const memoryPercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

    return {
      cpu: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
      memory: {
        used: memory.usedJSHeapSize / 1024 / 1024,
        available: memory.jsHeapSizeLimit / 1024 / 1024,
        total: memory.jsHeapSizeLimit / 1024 / 1024,
        percentage: memoryPercentage,
        unit: 'MB',
        trend: 'stable'
      },
      disk: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' },
      network: { used: 0, available: 100, total: 100, percentage: 0, unit: '%', trend: 'stable' }
    };
  }

  private evaluateHealthStatus(metrics: HealthMetrics): 'healthy' | 'warning' | 'critical' {
    if (metrics.errorRate > 5 || metrics.availability < 95) {
      return 'critical';
    }
    if (metrics.errorRate > 1 || metrics.availability < 99 || metrics.responseTime > 2000) {
      return 'warning';
    }
    return 'healthy';
  }

  private getErrorRate(): number {
    const errorMetrics = errorHandler.getMetrics();
    const totalErrors = errorMetrics.totalErrors;
    const uptime = (Date.now() - this.startTime) / 1000 / 60; // minutes
    return uptime > 0 ? (totalErrors / uptime) * 100 : 0;
  }

  private getThroughput(): number {
    // Placeholder for throughput calculation
    return 0;
  }

  // Performance Metrics
  public recordPerformanceMetric(metric: PerformanceMetric): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metrics = this.metrics.get(metric.name)!;
    metrics.push(metric);

    // Keep only recent metrics within retention period
    const cutoff = Date.now() - this.config.retentionPeriod;
    const filteredMetrics = metrics.filter(m => m.timestamp > cutoff);
    this.metrics.set(metric.name, filteredMetrics);

    this.emitEvent({
      id: `metric_${metric.id}`,
      type: 'metric',
      source: 'monitoring',
      timestamp: metric.timestamp,
      data: metric,
      tags: { metricName: metric.name }
    });
  }

  public getPerformanceMetrics(name?: string, timeRange?: { start: number; end: number }): PerformanceMetric[] {
    if (name) {
      const metrics = this.metrics.get(name) || [];
      if (timeRange) {
        return metrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);
      }
      return metrics;
    }

    // Get all metrics
    const allMetrics: PerformanceMetric[] = [];
    this.metrics.forEach(metrics => {
      if (timeRange) {
        allMetrics.push(...metrics.filter(m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end));
      } else {
        allMetrics.push(...metrics);
      }
    });
    return allMetrics;
  }

  public getMetricAggregation(name: string, timeRange?: { start: number; end: number }): {
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
    p95: number;
    p99: number;
  } {
    const metrics = this.getPerformanceMetrics(name, timeRange);
    if (metrics.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, sum: 0, p95: 0, p99: 0 };
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      avg: sum / values.length,
      sum,
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)]
    };
  }

  private recordResourceMetrics(): void {
    const memoryUsage = this.getMemoryUsage();

    this.recordPerformanceMetric({
      id: `memory_usage_${Date.now()}`,
      name: 'memory_usage',
      value: memoryUsage.memory.percentage,
      unit: '%',
      timestamp: Date.now(),
      tags: { resource: 'memory', type: 'usage' }
    });

    this.recordPerformanceMetric({
      id: `memory_used_${Date.now()}`,
      name: 'memory_used',
      value: memoryUsage.memory.used,
      unit: 'MB',
      timestamp: Date.now(),
      tags: { resource: 'memory', type: 'absolute' }
    });
  }

  // Service Dependencies
  public registerServiceDependency(dependency: ServiceDependency): void {
    this.serviceDependencies.set(dependency.id, dependency);
  }

  public updateServiceDependency(id: string, updates: Partial<ServiceDependency>): void {
    const dependency = this.serviceDependencies.get(id);
    if (dependency) {
      Object.assign(dependency, updates, { lastChecked: Date.now() });
      this.serviceDependencies.set(id, dependency);
    }
  }

  public getServiceDependencies(): ServiceDependency[] {
    return Array.from(this.serviceDependencies.values());
  }

  // Alert Management
  public addAlert(alert: Alert): void {
    this.alerts.set(alert.id, alert);
    this.emitEvent({
      id: `alert_${alert.id}`,
      type: 'alert',
      source: 'monitoring',
      timestamp: alert.timestamp,
      data: alert,
      tags: { alertId: alert.id, severity: alert.severity }
    });
  }

  public updateAlert(id: string, updates: Partial<Alert>): void {
    const alert = this.alerts.get(id);
    if (alert) {
      Object.assign(alert, updates);
      this.alerts.set(id, alert);
    }
  }

  public getAlerts(status?: Alert['status']): Alert[] {
    const alerts = Array.from(this.alerts.values());
    return status ? alerts.filter(alert => alert.status === status) : alerts;
  }

  private checkAlertConditions(): void {
    if (!this.config.alerting.enabled) return;

    // Check performance thresholds
    Object.entries(this.config.performance.thresholds).forEach(([metricName, threshold]) => {
      const aggregation = this.getMetricAggregation(metricName);

      if (aggregation.count > 0) {
        if (aggregation.avg >= threshold.critical) {
          this.createAlert({
            metric: metricName,
            value: aggregation.avg,
            threshold: threshold.critical,
            severity: 'critical',
            message: `${metricName} exceeded critical threshold: ${aggregation.avg}${threshold.unit}`
          });
        } else if (aggregation.avg >= threshold.warning) {
          this.createAlert({
            metric: metricName,
            value: aggregation.avg,
            threshold: threshold.warning,
            severity: 'warning',
            message: `${metricName} exceeded warning threshold: ${aggregation.avg}${threshold.unit}`
          });
        }
      }
    });
  }

  private createAlert(options: {
    metric: string;
    value: number;
    threshold: number;
    severity: 'warning' | 'critical';
    message: string;
  }): void {
    const alertId = `alert_${options.metric}_${Date.now()}`;
    const alert: Alert = {
      id: alertId,
      ruleId: 'threshold',
      name: `${options.metric} threshold exceeded`,
      description: options.message,
      severity: options.severity,
      status: 'active',
      timestamp: Date.now(),
      metric: options.metric,
      value: options.value,
      threshold: options.threshold,
      channels: this.config.alerting.defaultChannels
    };

    this.addAlert(alert);

    // Auto-create incident if critical
    if (options.severity === 'critical' && this.config.incidents.autoCreate) {
      this.createIncident({
        title: alert.name,
        description: alert.description,
        severity: alert.severity,
        alerts: [alert.id]
      });
    }
  }

  // Incident Management
  public createIncident(incidentData: Partial<Incident>): Incident {
    const incident: Incident = {
      id: `incident_${Date.now()}`,
      title: incidentData.title || 'Untitled Incident',
      description: incidentData.description || 'No description provided',
      severity: incidentData.severity || 'error',
      status: 'open',
      impact: {
        scope: 'system',
        affectedUsers: 0,
        businessImpact: 'medium'
      },
      category: 'performance',
      createdBy: 'system',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      alerts: incidentData.alerts || [],
      timeline: [{
        timestamp: Date.now(),
        type: 'created',
        message: 'Incident created automatically',
        user: 'system'
      }],
      actions: []
    };

    this.incidents.set(incident.id, incident);
    this.emitEvent({
      id: `incident_${incident.id}`,
      type: 'incident',
      source: 'monitoring',
      timestamp: incident.createdAt,
      data: incident,
      tags: { incidentId: incident.id, severity: incident.severity }
    });

    return incident;
  }

  public getIncidents(status?: Incident['status']): Incident[] {
    const incidents = Array.from(this.incidents.values());
    return status ? incidents.filter(incident => incident.status === status) : incidents;
  }

  // Event System
  public addEventListener(listener: (event: MonitoringEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emitEvent(event: MonitoringEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in monitoring event listener:', error);
      }
    });
  }

  // Utility Methods
  private aggregateMetrics(): void {
    // Aggregate metrics at regular intervals
    // This is where you would implement rollups, downsampling, etc.
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;

    // Clean up old metrics
    this.metrics.forEach((metrics, name) => {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      if (filtered.length === 0) {
        this.metrics.delete(name);
      } else {
        this.metrics.set(name, filtered);
      }
    });

    // Clean up resolved alerts
    this.alerts.forEach((alert, id) => {
      if (alert.status === 'resolved' && alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(id);
      }
    });
  }

  public getSystemOverview(): {
    health: HealthStatus[];
    activeAlerts: Alert[];
    activeIncidents: Incident[];
    performance: {
      responseTime: number;
      errorRate: number;
      availability: number;
    };
    uptime: number;
  } {
    return {
      health: Array.from(this.healthChecks.values()),
      activeAlerts: this.getAlerts('active'),
      activeIncidents: this.getIncidents('open'),
      performance: {
        responseTime: this.performanceMonitor.getMetricsSummary().avg,
        errorRate: this.getErrorRate(),
        availability: this.getSystemHealthMetrics().availability
      },
      uptime: Date.now() - this.startTime
    };
  }

  public updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }
}

// Export singleton instance
export const monitoringManager = MonitoringManager.getInstance();

// Export utility functions
export const getMonitoringOverview = () => monitoringManager.getSystemOverview();
export const recordMetric = (metric: PerformanceMetric) => monitoringManager.recordPerformanceMetric(metric);
export const getHealthStatus = (id?: string) => monitoringManager.getHealthStatus(id);
export const getAlerts = (status?: Alert['status']) => monitoringManager.getAlerts(status);
export const getIncidents = (status?: Incident['status']) => monitoringManager.getIncidents(status);