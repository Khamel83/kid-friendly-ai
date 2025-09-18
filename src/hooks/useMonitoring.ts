/**
 * React hooks for monitoring system integration
 * Provides performance monitoring, error tracking, health checks, resource monitoring,
 * service status, alert management, and incident response capabilities
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  HealthStatus,
  PerformanceMetric,
  PerformanceThreshold,
  ResourceUsage,
  Alert,
  Incident,
  MonitoringConfig,
  MonitoringEvent,
  AlertSeverity,
  ServiceDependency,
  DashboardWidget,
  TimeRange
} from '../types/monitoring';
import { monitoringManager } from '../utils/monitoringManager';
import { PerformanceMonitor } from '../utils/performanceMonitor';
import { NetworkMonitor } from '../utils/networkMonitor';
import { errorHandler } from '../utils/errorHandler';

// Performance Monitoring Hook
export function usePerformanceMonitoring(componentName: string) {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, PerformanceThreshold>>({});
  const [loading, setLoading] = useState(false);

  const performanceMonitor = useMemo(() => PerformanceMonitor.getInstance(), []);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = monitoringManager.addEventListener((event) => {
      if (event.type === 'metric' && event.tags?.metricName?.startsWith(componentName)) {
        setMetrics(prev => [...prev, event.data]);
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [componentName]);

  const measurePerformance = useCallback(async <T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    setLoading(true);
    try {
      const result = await performanceMonitor.measureAsync(
        `${componentName}_${name}`,
        fn,
        metadata
      );
      return result;
    } finally {
      setLoading(false);
    }
  }, [performanceMonitor, componentName]);

  const recordMetric = useCallback((name: string, value: number, unit: string, tags?: Record<string, string>) => {
    monitoringManager.recordPerformanceMetric({
      id: `${name}_${Date.now()}`,
      name: `${componentName}_${name}`,
      value,
      unit,
      timestamp: Date.now(),
      tags: { ...tags, component: componentName }
    });
  }, [componentName]);

  const getMetricSummary = useCallback((metricName: string) => {
    return performanceMonitor.getMetricsSummary(`${componentName}_${metricName}`);
  }, [performanceMonitor, componentName]);

  return {
    metrics,
    thresholds,
    loading,
    measurePerformance,
    recordMetric,
    getMetricSummary,
    performanceMonitor
  };
}

// Health Check Hook
export function useHealthCheck(serviceId: string) {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [lastCheck, setLastCheck] = useState<number>(0);
  const [checking, setChecking] = useState(false);

  const performHealthCheck = useCallback(async () => {
    setChecking(true);
    try {
      const status = monitoringManager.getHealthStatus(serviceId);
      if (Array.isArray(status)) {
        const serviceStatus = status.find(s => s.id === serviceId);
        setHealthStatus(serviceStatus || null);
      } else {
        setHealthStatus(status);
      }
      setLastCheck(Date.now());
    } finally {
      setChecking(false);
    }
  }, [serviceId]);

  useEffect(() => {
    const unsubscribe = monitoringManager.addEventListener((event) => {
      if (event.type === 'health' && event.tags?.checkId === serviceId) {
        setHealthStatus(event.data);
        setLastCheck(Date.now());
      }
    });

    // Initial health check
    performHealthCheck();

    return unsubscribe;
  }, [serviceId, performHealthCheck]);

  const isHealthy = healthStatus?.status === 'healthy';
  const isWarning = healthStatus?.status === 'warning';
  const isCritical = healthStatus?.status === 'critical';

  return {
    healthStatus,
    lastCheck,
    checking,
    isHealthy,
    isWarning,
    isCritical,
    performHealthCheck
  };
}

// Resource Monitoring Hook
export function useResourceMonitoring() {
  const [resources, setResources] = useState<ResourceUsage | null>(null);
  const [history, setHistory] = useState<ResourceUsage[]>([]);
  const historyRef = useRef<ResourceUsage[]>([]);

  useEffect(() => {
    const unsubscribe = monitoringManager.addEventListener((event) => {
      if (event.type === 'metric' && event.tags?.resource) {
        // Update resources based on incoming metrics
        updateResourceMetrics();
      }
    });

    const interval = setInterval(updateResourceMetrics, 30000); // Update every 30 seconds
    updateResourceMetrics(); // Initial update

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const updateResourceMetrics = useCallback(() => {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in (window as any).performance) {
      const memory = (window as any).performance.memory;
      const memoryPercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

      const newResources: ResourceUsage = {
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

      setResources(newResources);

      // Keep history (last 100 entries)
      historyRef.current = [...historyRef.current.slice(-99), newResources];
      setHistory(historyRef.current);
    }
  }, []);

  const getResourceTrend = useCallback((resource: keyof ResourceUsage) => {
    if (history.length < 2) return 'stable';

    const recent = history.slice(-5);
    const values = recent.map(h => h[resource].percentage);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const current = resources?.[resource].percentage || 0;

    if (current > avg * 1.1) return 'increasing';
    if (current < avg * 0.9) return 'decreasing';
    return 'stable';
  }, [history, resources]);

  return {
    resources,
    history,
    getResourceTrend,
    isLoading: !resources
  };
}

// Service Status Hook
export function useServiceStatus() {
  const [services, setServices] = useState<ServiceDependency[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshServices = useCallback(async () => {
    setLoading(true);
    try {
      const serviceDependencies = monitoringManager.getServiceDependencies();
      setServices(serviceDependencies);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshServices();

    const unsubscribe = monitoringManager.addEventListener((event) => {
      if (event.type === 'health') {
        refreshServices();
      }
    });

    return unsubscribe;
  }, [refreshServices]);

  const getServiceStatus = useCallback((serviceId: string) => {
    return services.find(s => s.id === serviceId);
  }, [services]);

  const getHealthyServices = useCallback(() => {
    return services.filter(s => s.healthStatus === 'healthy');
  }, [services]);

  const getDegradedServices = useCallback(() => {
    return services.filter(s => s.healthStatus === 'degraded');
  }, [services]);

  const getUnhealthyServices = useCallback(() => {
    return services.filter(s => s.healthStatus === 'unhealthy');
  }, [services]);

  return {
    services,
    loading,
    refreshServices,
    getServiceStatus,
    getHealthyServices,
    getDegradedServices,
    getUnhealthyServices
  };
}

// Alert Management Hook
export function useAlertManagement() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const allAlerts = monitoringManager.getAlerts();
      setAlerts(allAlerts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAlerts();

    const unsubscribe = monitoringManager.addEventListener((event) => {
      if (event.type === 'alert') {
        refreshAlerts();
      }
    });

    return unsubscribe;
  }, [refreshAlerts]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    monitoringManager.updateAlert(alertId, {
      status: 'acknowledged',
      acknowledgedBy: 'user',
      acknowledgedAt: Date.now()
    });
    refreshAlerts();
  }, [refreshAlerts]);

  const resolveAlert = useCallback((alertId: string) => {
    monitoringManager.updateAlert(alertId, {
      status: 'resolved',
      resolvedAt: Date.now()
    });
    refreshAlerts();
  }, [refreshAlerts]);

  const getAlertsBySeverity = useCallback((severity: AlertSeverity) => {
    return alerts.filter(alert => alert.severity === severity);
  }, [alerts]);

  const getActiveAlerts = useCallback(() => {
    return alerts.filter(alert => alert.status === 'active');
  }, [alerts]);

  return {
    alerts,
    loading,
    refreshAlerts,
    acknowledgeAlert,
    resolveAlert,
    getAlertsBySeverity,
    getActiveAlerts
  };
}

// Incident Response Hook
export function useIncidentManagement() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const allIncidents = monitoringManager.getIncidents();
      setIncidents(allIncidents);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshIncidents();

    const unsubscribe = monitoringManager.addEventListener((event) => {
      if (event.type === 'incident') {
        refreshIncidents();
      }
    });

    return unsubscribe;
  }, [refreshIncidents]);

  const createIncident = useCallback((incidentData: Partial<Incident>) => {
    const incident = monitoringManager.createIncident(incidentData);
    refreshIncidents();
    return incident;
  }, [refreshIncidents]);

  const updateIncident = useCallback((incidentId: string, updates: Partial<Incident>) => {
    const incident = incidents.find(i => i.id === incidentId);
    if (incident) {
      Object.assign(incident, updates, { updatedAt: Date.now() });
      // Note: In a real implementation, you'd call an update method on the monitoring manager
      setIncidents([...incidents]);
    }
  }, [incidents]);

  const getIncidentsByStatus = useCallback((status: Incident['status']) => {
    return incidents.filter(incident => incident.status === status);
  }, [incidents]);

  const getActiveIncidents = useCallback(() => {
    return incidents.filter(incident => incident.status === 'open' || incident.status === 'in_progress');
  }, [incidents]);

  return {
    incidents,
    loading,
    refreshIncidents,
    createIncident,
    updateIncident,
    getIncidentsByStatus,
    getActiveIncidents
  };
}

// Monitoring Dashboard Hook
export function useMonitoringDashboard() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: Date.now() - 60 * 60 * 1000, // 1 hour ago
    end: Date.now(),
    interval: 60000 // 1 minute
  });

  const { healthStatus: systemHealth } = useHealthCheck('system_health');
  const { resources } = useResourceMonitoring();
  const { alerts, getActiveAlerts } = useAlertManagement();
  const { incidents, getActiveIncidents } = useIncidentManagement();
  const { metrics } = usePerformanceMonitoring('dashboard');

  const refreshDashboard = useCallback(async () => {
    setLoading(true);
    try {
      // Refresh all monitoring data
      const overview = monitoringManager.getSystemOverview();

      // Update widgets with latest data
      const updatedWidgets = widgets.map(widget => {
        switch (widget.type) {
          case 'health':
            return {
              ...widget,
              data: overview.health
            };
          case 'metric':
            return {
              ...widget,
              data: monitoringManager.getPerformanceMetrics(widget.config?.metric, timeRange)
            };
          case 'alert':
            return {
              ...widget,
              data: getActiveAlerts()
            };
          case 'incident':
            return {
              ...widget,
              data: getActiveIncidents()
            };
          default:
            return widget;
        }
      });

      setWidgets(updatedWidgets);
    } finally {
      setLoading(false);
    }
  }, [widgets, timeRange, getActiveAlerts, getActiveIncidents]);

  useEffect(() => {
    refreshDashboard();

    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshDashboard, 30000);
    return () => clearInterval(interval);
  }, [refreshDashboard]);

  const updateTimeRange = useCallback((newTimeRange: TimeRange) => {
    setTimeRange(newTimeRange);
  }, []);

  const addWidget = useCallback((widget: DashboardWidget) => {
    setWidgets(prev => [...prev, widget]);
  }, []);

  const removeWidget = useCallback((widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  }, []);

  const getDashboardStats = useCallback(() => {
    const activeAlerts = getActiveAlerts();
    const activeIncidents = getActiveIncidents();
    const isHealthy = systemHealth?.status === 'healthy';

    return {
      totalAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
      totalIncidents: activeIncidents.length,
      systemHealth: systemHealth?.status || 'unknown',
      isSystemHealthy: isHealthy,
      lastUpdate: new Date().toISOString()
    };
  }, [getActiveAlerts, getActiveIncidents, systemHealth]);

  return {
    widgets,
    loading,
    timeRange,
    systemHealth,
    resources,
    metrics,
    alerts: getActiveAlerts(),
    incidents: getActiveIncidents(),
    refreshDashboard,
    updateTimeRange,
    addWidget,
    removeWidget,
    getDashboardStats
  };
}

// Network Monitoring Hook
export function useNetworkMonitoring() {
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [networkMetrics, setNetworkMetrics] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const networkMonitor = NetworkMonitor.getInstance();

    const unsubscribe = networkMonitor.subscribe((info) => {
      setNetworkInfo(info);
      setIsOnline(info.online);
      setNetworkMetrics(networkMonitor.getMetrics());
    });

    return unsubscribe;
  }, []);

  const waitForConnection = useCallback(async (timeout = 30000) => {
    if (isOnline) return true;

    return new Promise((resolve) => {
      const unsubscribe = monitoringManager.addEventListener((event) => {
        if (event.type === 'health' && event.tags?.checkId === 'network_health') {
          if (event.data.status === 'healthy') {
            unsubscribe();
            resolve(true);
          }
        }
      });

      setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeout);
    });
  }, [isOnline]);

  const getOptimalConfig = useCallback(() => {
    if (!networkInfo) return { timeout: 30000, retryCount: 3, batchSize: 5 };

    const quality = networkInfo.quality;
    switch (quality) {
      case 'excellent':
        return { timeout: 30000, retryCount: 2, batchSize: 10 };
      case 'good':
        return { timeout: 45000, retryCount: 3, batchSize: 8 };
      case 'fair':
        return { timeout: 60000, retryCount: 4, batchSize: 5 };
      case 'poor':
        return { timeout: 90000, retryCount: 5, batchSize: 3 };
      default:
        return { timeout: 30000, retryCount: 3, batchSize: 5 };
    }
  }, [networkInfo]);

  return {
    networkInfo,
    networkMetrics,
    isOnline,
    waitForConnection,
    getOptimalConfig
  };
}

// Configuration Hook
export function useMonitoringConfig() {
  const [config, setConfig] = useState<MonitoringConfig | null>(null);

  const updateConfig = useCallback((newConfig: Partial<MonitoringConfig>) => {
    monitoringManager.updateConfig(newConfig);
    setConfig(prev => prev ? { ...prev, ...newConfig } : null);
  }, []);

  const refreshConfig = useCallback(() => {
    // In a real implementation, you'd fetch the current config
    const overview = monitoringManager.getSystemOverview();
    setConfig({
      enabled: true,
      samplingRate: 1.0,
      retentionPeriod: 7 * 24 * 60 * 60 * 1000,
      alerting: {
        enabled: true,
        defaultChannels: [],
        suppressionRules: []
      },
      performance: {
        thresholds: {},
        aggregationInterval: 60000
      },
      health: {
        checkInterval: 30000,
        timeout: 10000,
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
    });
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  return {
    config,
    updateConfig,
    refreshConfig
  };
}

// Error Monitoring Hook
export function useErrorMonitoring() {
  const [errors, setErrors] = useState<any[]>([]);
  const [errorMetrics, setErrorMetrics] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = errorHandler.onError((error) => {
      setErrors(prev => [...prev, error]);
      setErrorMetrics(errorHandler.getMetrics());
    });

    return unsubscribe;
  }, []);

  const getRecentErrors = useCallback((minutes = 60) => {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return errors.filter(error => error.timestamp >= cutoff);
  }, [errors]);

  const getErrorFrequency = useCallback(() => {
    return errorMetrics?.errorFrequency || 0;
  }, [errorMetrics]);

  const getSystemHealthScore = useCallback(() => {
    return errorMetrics?.systemHealthScore || 100;
  }, [errorMetrics]);

  return {
    errors,
    errorMetrics,
    getRecentErrors,
    getErrorFrequency,
    getSystemHealthScore
  };
}

// Export all hooks
export {
  usePerformanceMonitoring,
  useHealthCheck,
  useResourceMonitoring,
  useServiceStatus,
  useAlertManagement,
  useIncidentManagement,
  useMonitoringDashboard,
  useNetworkMonitoring,
  useMonitoringConfig,
  useErrorMonitoring
};