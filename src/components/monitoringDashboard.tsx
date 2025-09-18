/**
 * Comprehensive monitoring dashboard for the kid-friendly-ai application
 * Provides real-time system status, performance metrics visualization,
 * resource usage displays, service health indicators, alert notifications,
 * incident management, and system topology visualization
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  HealthStatus,
  PerformanceMetric,
  ResourceUsage,
  Alert,
  Incident,
  ServiceDependency,
  DashboardWidget,
  TimeRange,
  AlertSeverity
} from '../types/monitoring';
import {
  useMonitoringDashboard,
  useHealthCheck,
  useResourceMonitoring,
  useAlertManagement,
  useIncidentManagement,
  useNetworkMonitoring,
  useServiceStatus
} from '../hooks/useMonitoring';
import { monitoringManager } from '../utils/monitoringManager';

interface MonitoringDashboardProps {
  refreshInterval?: number;
  showSystemTopology?: boolean;
  showIncidentManagement?: boolean;
  showCapacityPlanning?: boolean;
}

interface MetricChartProps {
  title: string;
  metrics: PerformanceMetric[];
  unit: string;
  thresholds?: { warning: number; critical: number };
  height?: number;
}

interface HealthIndicatorProps {
  status: HealthStatus['status'];
  title: string;
  description?: string;
  size?: 'small' | 'medium' | 'large';
}

interface AlertCardProps {
  alert: Alert;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}

interface IncidentCardProps {
  incident: Incident;
  onUpdate: (id: string, updates: Partial<Incident>) => void;
}

const MetricChart: React.FC<MetricChartProps> = ({ title, metrics, unit, thresholds, height = 200 }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || metrics.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate dimensions
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;

    // Find min and max values
    const values = metrics.map(m => m.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i * chartHeight) / 5;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Draw value labels
      const value = maxValue - (i * valueRange) / 5;
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(1), padding - 10, y + 4);
    }

    // Draw threshold lines
    if (thresholds) {
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const warningY = padding + ((maxValue - thresholds.warning) / valueRange) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding, warningY);
      ctx.lineTo(width - padding, warningY);
      ctx.stroke();

      ctx.strokeStyle = '#f44336';
      const criticalY = padding + ((maxValue - thresholds.critical) / valueRange) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding, criticalY);
      ctx.lineTo(width - padding, criticalY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw data points and lines
    if (metrics.length > 1) {
      ctx.strokeStyle = '#2196f3';
      ctx.lineWidth = 2;
      ctx.beginPath();

      metrics.forEach((metric, index) => {
        const x = padding + (index / (metrics.length - 1)) * chartWidth;
        const y = padding + ((maxValue - metric.value) / valueRange) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw data points
      ctx.fillStyle = '#2196f3';
      metrics.forEach((metric, index) => {
        const x = padding + (index / (metrics.length - 1)) * chartWidth;
        const y = padding + ((maxValue - metric.value) / valueRange) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${title} (${unit})`, width / 2, 20);

    // Draw time range
    if (metrics.length > 0) {
      const startTime = new Date(metrics[0].timestamp).toLocaleTimeString();
      const endTime = new Date(metrics[metrics.length - 1].timestamp).toLocaleTimeString();
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText(`${startTime} - ${endTime}`, width / 2, height - 10);
    }
  }, [title, metrics, unit, thresholds, height]);

  return (
    <div className="metric-chart">
      <canvas ref={canvasRef} width={400} height={height} />
    </div>
  );
};

const HealthIndicator: React.FC<HealthIndicatorProps> = ({ status, title, description, size = 'medium' }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'healthy': return '#4caf50';
      case 'warning': return '#ff9800';
      case 'critical': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'healthy': return '✓';
      case 'warning': return '⚠';
      case 'critical': return '✗';
      default: return '?';
    }
  };

  const sizeClasses = {
    small: 'w-8 h-8 text-sm',
    medium: 'w-12 h-12 text-lg',
    large: 'w-16 h-16 text-2xl'
  };

  return (
    <div className="health-indicator">
      <div className={`flex items-center space-x-3 ${size === 'large' ? 'flex-col' : ''}`}>
        <div className={`flex items-center justify-center rounded-full text-white font-bold ${sizeClasses[size]}`} style={{ backgroundColor: getStatusColor() }}>
          {getStatusIcon()}
        </div>
        <div>
          <h3 className={`font-semibold ${size === 'large' ? 'text-center' : ''}`}>{title}</h3>
          {description && <p className="text-sm text-gray-600">{description}</p>}
          <span className="text-xs font-medium capitalize" style={{ color: getStatusColor() }}>
            {status}
          </span>
        </div>
      </div>
    </div>
  );
};

const AlertCard: React.FC<AlertCardProps> = ({ alert, onAcknowledge, onResolve }) => {
  const getSeverityColor = () => {
    switch (alert.severity) {
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-700';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getStatusColor = () => {
    switch (alert.status) {
      case 'active': return 'bg-red-500';
      case 'acknowledged': return 'bg-yellow-500';
      case 'resolved': return 'bg-green-500';
      case 'suppressed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getSeverityColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
            <h3 className="font-semibold">{alert.name}</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize">
              {alert.severity}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize">
              {alert.status}
            </span>
          </div>
          <p className="text-sm mb-2">{alert.description}</p>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Metric: {alert.metric}</div>
            <div>Value: {alert.value} / Threshold: {alert.threshold}</div>
            <div>Time: {new Date(alert.timestamp).toLocaleString()}</div>
          </div>
        </div>
        <div className="flex space-x-2 ml-4">
          {alert.status === 'active' && (
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="px-3 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Acknowledge
            </button>
          )}
          {alert.status !== 'resolved' && (
            <button
              onClick={() => onResolve(alert.id)}
              className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            >
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onUpdate }) => {
  const getSeverityColor = () => {
    switch (incident.severity) {
      case 'critical': return 'bg-red-100 border-red-300';
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = () => {
    switch (incident.status) {
      case 'open': return 'bg-red-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'resolved': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getSeverityColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
            <h3 className="font-semibold">{incident.title}</h3>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize">
              {incident.severity}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize">
              {incident.status}
            </span>
          </div>
          <p className="text-sm mb-3">{incident.description}</p>
          <div className="text-xs text-gray-600 space-y-1 mb-3">
            <div>Created: {new Date(incident.createdAt).toLocaleString()}</div>
            <div>Impact: {incident.impact.businessImpact} - {incident.impact.scope}</div>
            <div>Alerts: {incident.alerts.length}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {incident.status === 'open' && (
              <button
                onClick={() => onUpdate(incident.id, { status: 'in_progress', updatedAt: Date.now() })}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Start Investigation
              </button>
            )}
            {incident.status === 'in_progress' && (
              <button
                onClick={() => onUpdate(incident.id, { status: 'resolved', resolvedAt: Date.now(), updatedAt: Date.now() })}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
              >
                Mark Resolved
              </button>
            )}
            {incident.status === 'resolved' && (
              <button
                onClick={() => onUpdate(incident.id, { status: 'closed', closedAt: Date.now(), updatedAt: Date.now() })}
                className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Close Incident
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ResourceUsageWidget: React.FC<{ resources: ResourceUsage | null }> = ({ resources }) => {
  if (!resources) {
    return <div className="text-center text-gray-500 py-8">Loading resource data...</div>;
  }

  const ResourceBar: React.FC<{ name: string; value: number; total: number; unit: string }> = ({ name, value, total, unit }) => {
    const percentage = (value / total) * 100;
    const getBarColor = () => {
      if (percentage > 90) return 'bg-red-500';
      if (percentage > 70) return 'bg-yellow-500';
      return 'bg-green-500';
    };

    return (
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">{name}</span>
          <span>{value.toFixed(1)}{unit} / {total}{unit} ({percentage.toFixed(1)}%)</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className={`h-2 rounded-full ${getBarColor()}`} style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <ResourceBar name="Memory" value={resources.memory.used} total={resources.memory.total} unit={resources.memory.unit} />
      <ResourceBar name="CPU" value={resources.cpu.used} total={resources.cpu.total} unit={resources.cpu.unit} />
      <ResourceBar name="Disk" value={resources.disk.used} total={resources.disk.total} unit={resources.disk.unit} />
      <ResourceBar name="Network" value={resources.network.used} total={resources.network.total} unit={resources.network.unit} />
    </div>
  );
};

const SystemTopology: React.FC<{ services: ServiceDependency[] }> = ({ services }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || services.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Simple node positioning
    const nodePositions = services.map((service, index) => ({
      x: 100 + (index % 3) * 150,
      y: 100 + Math.floor(index / 3) * 120,
      service
    }));

    // Draw connections
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    nodePositions.forEach(pos => {
      if (pos.service.dependencies) {
        pos.service.dependencies.forEach(depId => {
          const targetPos = nodePositions.find(p => p.service.id === depId);
          if (targetPos) {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(targetPos.x, targetPos.y);
            ctx.stroke();
          }
        });
      }
    });

    // Draw nodes
    nodePositions.forEach(pos => {
      const statusColor = pos.service.healthStatus === 'healthy' ? '#4caf50' :
                          pos.service.healthStatus === 'degraded' ? '#ff9800' : '#f44336';

      // Draw node circle
      ctx.fillStyle = statusColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 30, 0, 2 * Math.PI);
      ctx.fill();

      // Draw node border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw node label
      ctx.fillStyle = '#333';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pos.service.name, pos.x, pos.y + 50);
    });
  }, [services]);

  return (
    <div className="system-topology">
      <h3 className="text-lg font-semibold mb-4">System Topology</h3>
      <canvas ref={canvasRef} width={600} height={400} className="border rounded-lg bg-white" />
    </div>
  );
};

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  refreshInterval = 30000,
  showSystemTopology = true,
  showIncidentManagement = true,
  showCapacityPlanning = true
}) => {
  const {
    widgets,
    loading,
    timeRange,
    systemHealth,
    resources,
    metrics,
    alerts,
    incidents,
    refreshDashboard,
    updateTimeRange,
    getDashboardStats
  } = useMonitoringDashboard();

  const { services, getServiceStatus } = useServiceStatus();
  const { isOnline: networkOnline } = useNetworkMonitoring();

  const dashboardStats = useMemo(() => getDashboardStats(), [getDashboardStats]);

  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'incidents' | 'topology' | 'performance'>('overview');

  const timeRangeOptions = [
    { value: '5m', label: '5 minutes', duration: 5 * 60 * 1000 },
    { value: '15m', label: '15 minutes', duration: 15 * 60 * 1000 },
    { value: '1h', label: '1 hour', duration: 60 * 60 * 1000 },
    { value: '6h', label: '6 hours', duration: 6 * 60 * 60 * 1000 },
    { value: '24h', label: '24 hours', duration: 24 * 60 * 60 * 1000 }
  ];

  const handleTimeRangeChange = (value: string) => {
    setSelectedTimeRange(value);
    const option = timeRangeOptions.find(opt => opt.value === value);
    if (option) {
      updateTimeRange({
        start: Date.now() - option.duration,
        end: Date.now(),
        interval: Math.max(option.duration / 100, 60000)
      });
    }
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    // In a real implementation, you'd call the alert manager
    console.log('Acknowledging alert:', alertId);
  };

  const handleResolveAlert = (alertId: string) => {
    // In a real implementation, you'd call the alert manager
    console.log('Resolving alert:', alertId);
  };

  const handleUpdateIncident = (incidentId: string, updates: any) => {
    // In a real implementation, you'd call the incident manager
    console.log('Updating incident:', incidentId, updates);
  };

  useEffect(() => {
    const interval = setInterval(refreshDashboard, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshDashboard, refreshInterval]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* System Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">System Health</p>
              <p className="text-2xl font-bold capitalize">{dashboardStats.systemHealth}</p>
            </div>
            <HealthIndicator status={systemHealth?.status || 'unknown'} title="System" size="small" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Alerts</p>
              <p className="text-2xl font-bold">{dashboardStats.totalAlerts}</p>
            </div>
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 font-bold">🚨</span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Incidents</p>
              <p className="text-2xl font-bold">{dashboardStats.totalIncidents}</p>
            </div>
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 font-bold">🔥</span>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Network Status</p>
              <p className="text-2xl font-bold capitalize">{networkOnline ? 'Online' : 'Offline'}</p>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${networkOnline ? 'bg-green-100' : 'bg-red-100'}`}>
              <span className={networkOnline ? 'text-green-600' : 'text-red-600'}>{networkOnline ? '🌐' : '❌'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Usage */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Resource Usage</h3>
        <ResourceUsageWidget resources={resources} />
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Response Time</h3>
          <MetricChart
            title="Response Time"
            metrics={metrics.filter(m => m.name.includes('response_time'))}
            unit="ms"
            thresholds={{ warning: 1000, critical: 5000 }}
          />
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Memory Usage</h3>
          <MetricChart
            title="Memory Usage"
            metrics={metrics.filter(m => m.name.includes('memory_usage'))}
            unit="%"
            thresholds={{ warning: 80, critical: 90 }}
          />
        </div>
      </div>

      {/* System Topology */}
      {showSystemTopology && (
        <div className="bg-white p-6 rounded-lg shadow">
          <SystemTopology services={services} />
        </div>
      )}
    </div>
  );

  const renderAlertsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Alerts ({alerts.length})</h3>
        <button
          onClick={refreshDashboard}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>
      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No active alerts</div>
      ) : (
        <div className="space-y-4">
          {alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledgeAlert}
              onResolve={handleResolveAlert}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderIncidentsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Incidents ({incidents.length})</h3>
        <button
          onClick={refreshDashboard}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>
      {incidents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No active incidents</div>
      ) : (
        <div className="space-y-4">
          {incidents.map(incident => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onUpdate={handleUpdateIncident}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderTopologyTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">System Topology</h3>
        <button
          onClick={refreshDashboard}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>
      <SystemTopology services={services} />
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">API Response Time</h3>
          <MetricChart
            title="API Response Time"
            metrics={metrics.filter(m => m.name.includes('api'))}
            unit="ms"
            thresholds={{ warning: 1000, critical: 5000 }}
          />
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Error Rate</h3>
          <MetricChart
            title="Error Rate"
            metrics={metrics.filter(m => m.name.includes('error'))}
            unit="%"
            thresholds={{ warning: 1, critical: 5 }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="monitoring-dashboard space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Monitoring Dashboard</h1>
            <p className="text-gray-600 mt-1">Real-time system health, performance, and alerts</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={selectedTimeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={refreshDashboard}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'alerts', label: `Alerts (${dashboardStats.totalAlerts})` },
              { key: 'incidents', label: `Incidents (${dashboardStats.totalIncidents})` },
              { key: 'topology', label: 'Topology' },
              { key: 'performance', label: 'Performance' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'alerts' && renderAlertsTab()}
          {activeTab === 'incidents' && renderIncidentsTab()}
          {activeTab === 'topology' && renderTopologyTab()}
          {activeTab === 'performance' && renderPerformanceTab()}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white p-4 rounded-lg shadow text-center text-sm text-gray-500">
        <p>Last updated: {new Date(dashboardStats.lastUpdate).toLocaleString()}</p>
        <p className="mt-1">Monitoring data refreshes every {refreshInterval / 1000} seconds</p>
      </div>
    </div>
  );
};

export default MonitoringDashboard;