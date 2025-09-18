/**
 * Example usage of the comprehensive monitoring system
 * Demonstrates how to integrate monitoring into your components
 */

import React, { useEffect, useState } from 'react';
import {
  usePerformanceMonitoring,
  useHealthCheck,
  useResourceMonitoring,
  useAlertManagement,
  useIncidentManagement,
  useMonitoringDashboard,
  useNetworkMonitoring
} from '../hooks/useMonitoring';
import {
  recordMetric,
  createAlert,
  createIncident,
  getHealthStatus,
  getAlerts,
  getIncidents
} from '../utils/monitoringManager';
import MonitoringDashboard from '../components/monitoringDashboard';

const MonitoringExample: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'example' | 'dashboard'>('example');

  // Performance monitoring for this component
  const {
    metrics,
    loading,
    measurePerformance,
    recordMetric,
    getMetricSummary
  } = usePerformanceMonitoring('MonitoringExample');

  // Health check for a sample service
  const {
    healthStatus,
    isHealthy,
    performHealthCheck
  } = useHealthCheck('example_service');

  // Resource monitoring
  const {
    resources,
    getResourceTrend
  } = useResourceMonitoring();

  // Alert management
  const {
    alerts,
    acknowledgeAlert,
    resolveAlert
  } = useAlertManagement();

  // Incident management
  const {
    incidents,
    createIncident: createNewIncident
  } = useIncidentManagement();

  // Network monitoring
  const {
    isOnline,
    networkInfo,
    getOptimalConfig
  } = useNetworkMonitoring();

  // Example of custom performance monitoring
  const handleExpensiveOperation = async () => {
    return measurePerformance('expensive_operation', async () => {
      // Simulate expensive operation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Record custom metrics
      recordMetric('operation_success', 1, 'count');
      recordMetric('operation_duration', 2000, 'ms');

      return { success: true, data: 'Operation completed' };
    });
  };

  // Example of triggering alerts
  const triggerTestAlert = () => {
    createAlert({
      ruleId: 'test_rule',
      name: 'Test Alert',
      description: 'This is a test alert triggered from the monitoring example',
      severity: 'warning',
      status: 'active',
      metric: 'test_metric',
      value: 85,
      threshold: 80,
      channels: []
    });
  };

  // Example of creating incidents
  const createTestIncident = () => {
    createNewIncident({
      title: 'Test Incident',
      description: 'This is a test incident for demonstration purposes',
      severity: 'error',
      category: 'performance',
      impact: {
        scope: 'feature',
        affectedUsers: 100,
        businessImpact: 'low'
      },
      createdBy: 'demo_user'
    });
  };

  // Monitor component metrics
  useEffect(() => {
    // Record component mount metric
    recordMetric('component_mount', 1, 'count');

    // Simulate periodic metrics
    const interval = setInterval(() => {
      recordMetric('active_users', Math.floor(Math.random() * 1000), 'users');
      recordMetric('api_calls', Math.floor(Math.random() * 100), 'count');
    }, 5000);

    return () => {
      clearInterval(interval);
      recordMetric('component_unmount', 1, 'count');
    };
  }, [recordMetric]);

  const performanceSummary = getMetricSummary('expensive_operation');
  const memoryTrend = getResourceTrend('memory');
  const optimalConfig = getOptimalConfig();

  return (
    <div className="monitoring-example p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Monitoring System Example</h1>
        <p className="text-gray-600 mb-4">
          This example demonstrates the comprehensive monitoring capabilities of the kid-friendly-ai system.
        </p>

        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTab('example')}
            className={`px-4 py-2 rounded ${
              activeTab === 'example'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Usage Examples
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded ${
              activeTab === 'dashboard'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Monitoring Dashboard
          </button>
        </div>
      </div>

      {activeTab === 'example' && (
        <div className="space-y-6">
          {/* System Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">Network Status</h3>
              <div className={`text-lg font-bold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </div>
              {networkInfo && (
                <div className="text-sm text-gray-600 mt-1">
                  {networkInfo.effectiveType} - {networkInfo.downlink} Mbps
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">Service Health</h3>
              <div className={`text-lg font-bold ${
                isHealthy ? 'text-green-600' :
                healthStatus?.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {healthStatus?.status || 'Unknown'}
              </div>
              <button
                onClick={performHealthCheck}
                className="mt-2 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Check Health
              </button>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">Resource Usage</h3>
              {resources?.memory && (
                <div className="text-sm">
                  <div>Memory: {resources.memory.percentage.toFixed(1)}%</div>
                  <div className={`text-xs ${memoryTrend === 'increasing' ? 'text-red-600' : 'text-green-600'}`}>
                    Trend: {memoryTrend}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-semibold mb-2">Active Alerts</h3>
              <div className="text-lg font-bold text-red-600">{alerts.length}</div>
              <div className="text-sm text-gray-600">Critical incidents: {incidents.filter(i => i.severity === 'critical').length}</div>
            </div>
          </div>

          {/* Performance Monitoring */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Performance Monitoring</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="font-medium mb-2">Expensive Operation Metrics</h3>
                {performanceSummary.count > 0 && (
                  <div className="text-sm space-y-1">
                    <div>Count: {performanceSummary.count}</div>
                    <div>Average: {performanceSummary.avg.toFixed(2)}ms</div>
                    <div>Min: {performanceSummary.min.toFixed(2)}ms</div>
                    <div>Max: {performanceSummary.max.toFixed(2)}ms</div>
                    <div>P95: {performanceSummary.p95.toFixed(2)}ms</div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium mb-2">Network Optimization</h3>
                <div className="text-sm space-y-1">
                  <div>Timeout: {optimalConfig.timeout}ms</div>
                  <div>Retry Count: {optimalConfig.retryCount}</div>
                  <div>Batch Size: {optimalConfig.batchSize}</div>
                  <div>Compression: {optimalConfig.useCompression ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleExpensiveOperation}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Running...' : 'Run Expensive Operation'}
              </button>
            </div>
          </div>

          {/* Alert Management */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Alert & Incident Management</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="font-medium mb-2">Active Alerts ({alerts.length})</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {alerts.length === 0 ? (
                    <p className="text-sm text-gray-500">No active alerts</p>
                  ) : (
                    alerts.map(alert => (
                      <div key={alert.id} className="p-2 border rounded text-sm">
                        <div className="font-medium">{alert.name}</div>
                        <div className="text-gray-600">{alert.severity}</div>
                        <div className="flex space-x-2 mt-1">
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            className="px-2 py-1 text-xs bg-yellow-500 text-white rounded"
                          >
                            Acknowledge
                          </button>
                          <button
                            onClick={() => resolveAlert(alert.id)}
                            className="px-2 py-1 text-xs bg-green-500 text-white rounded"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Active Incidents ({incidents.length})</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {incidents.length === 0 ? (
                    <p className="text-sm text-gray-500">No active incidents</p>
                  ) : (
                    incidents.map(incident => (
                      <div key={incident.id} className="p-2 border rounded text-sm">
                        <div className="font-medium">{incident.title}</div>
                        <div className="text-gray-600">{incident.severity} - {incident.status}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(incident.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={triggerTestAlert}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                Create Test Alert
              </button>
              <button
                onClick={createTestIncident}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Create Test Incident
              </button>
            </div>
          </div>

          {/* Recent Metrics */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Recent Metrics ({metrics.length})</h2>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {metrics.slice(-10).map((metric, index) => (
                <div key={index} className="p-2 border rounded text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{metric.name}</span>
                    <span className="text-gray-600">{metric.value} {metric.unit}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(metric.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <MonitoringDashboard
          refreshInterval={30000}
          showSystemTopology={true}
          showIncidentManagement={true}
          showCapacityPlanning={true}
        />
      )}
    </div>
  );
};

export default MonitoringExample;