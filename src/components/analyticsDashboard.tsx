/**
 * Analytics Dashboard Component
 * Comprehensive analytics dashboard with real-time metrics, visualizations, and insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAnalytics, useRealTimeAnalytics } from '../hooks/useAnalytics';
import { analyticsManager, analyticsProcessor } from '../utils/analyticsManager';
import {
  Dashboard,
  DashboardWidget,
  RealTimeMetrics,
  AnalyticsReport,
  PrivacySettings,
  DashboardLayout,
  DashboardPermissions
} from '../types/analytics';

interface AnalyticsDashboardProps {
  dashboardId?: string;
  initialLayout?: DashboardLayout;
  widgets?: DashboardWidget[];
  permissions?: DashboardPermissions;
  refreshInterval?: number;
  enableRealTime?: boolean;
  enableExport?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
}

interface DashboardState {
  metrics: RealTimeMetrics;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  selectedTimeRange: string;
  selectedMetrics: string[];
  filters: Record<string, any>;
  exportFormat: 'json' | 'csv' | 'pdf';
  isExporting: boolean;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  dashboardId = 'default',
  initialLayout,
  widgets = [],
  permissions,
  refreshInterval = 30000,
  enableRealTime = true,
  enableExport = true,
  theme = 'light',
  className = ''
}) => {
  const { isInitialized, privacySettings, config } = useAnalytics({
    autoTrack: true,
    debugMode: false,
  });

  const { metrics: realTimeMetrics, isLoading: realTimeLoading, error: realTimeError } = useRealTimeAnalytics({
    enabled: enableRealTime,
    updateInterval: refreshInterval,
  });

  const [state, setState] = useState<DashboardState>({
    metrics: {
      activeUsers: 0,
      currentPageViews: 0,
      eventsPerSecond: 0,
      averageSessionDuration: 0,
      bounceRate: 0,
      topPages: [],
      topEvents: [],
      topReferrers: [],
      conversions: 0,
    },
    isInitialized: false,
    isLoading: true,
    error: null,
    selectedTimeRange: '24h',
    selectedMetrics: ['activeUsers', 'currentPageViews', 'conversions'],
    filters: {},
    exportFormat: 'json',
    isExporting: false,
  });

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  useEffect(() => {
    initializeDashboard();
  }, [dashboardId, widgets, initialLayout, permissions]);

  useEffect(() => {
    if (realTimeMetrics && enableRealTime) {
      setState(prev => ({
        ...prev,
        metrics: realTimeMetrics,
        isLoading: realTimeLoading,
        error: realTimeError?.message || null,
      }));
    }
  }, [realTimeMetrics, realTimeLoading, realTimeError, enableRealTime]);

  const initializeDashboard = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const defaultLayout: DashboardLayout = {
        columns: 12,
        rows: 8,
        spacing: 16,
        responsive: true,
      };

      const defaultPermissions: DashboardPermissions = {
        view: ['admin', 'analyst'],
        edit: ['admin'],
        share: ['admin'],
        public: false,
      };

      const newDashboard: Dashboard = {
        id: dashboardId,
        name: 'Analytics Dashboard',
        description: 'Comprehensive analytics and monitoring dashboard',
        widgets: widgets.length > 0 ? widgets : getDefaultWidgets(),
        layout: initialLayout || defaultLayout,
        permissions: permissions || defaultPermissions,
        created: new Date(),
        updated: new Date(),
      };

      setDashboard(newDashboard);

      if (isInitialized) {
        await loadDashboardData();
      }

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize dashboard',
      }));
    }
  }, [dashboardId, widgets, initialLayout, permissions, isInitialized]);

  const loadDashboardData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Load real-time metrics
      const metrics = await analyticsManager.getRealTimeMetrics();

      setState(prev => ({
        ...prev,
        metrics,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard data',
      }));
    }
  }, []);

  const handleTimeRangeChange = useCallback((timeRange: string) => {
    setState(prev => ({ ...prev, selectedTimeRange: timeRange }));
    loadDashboardData();
  }, [loadDashboardData]);

  const handleMetricToggle = useCallback((metric: string) => {
    setState(prev => ({
      ...prev,
      selectedMetrics: prev.selectedMetrics.includes(metric)
        ? prev.selectedMetrics.filter(m => m !== metric)
        : [...prev.selectedMetrics, metric],
    }));
  }, []);

  const handleFilterChange = useCallback((field: string, value: any) => {
    setState(prev => ({
      ...prev,
      filters: {
        ...prev.filters,
        [field]: value,
      },
    }));
  }, []);

  const handleExport = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isExporting: true, error: null }));

      const report = await analyticsManager.generateReport(
        {
          start: getDateRangeStart(state.selectedTimeRange),
          end: new Date(),
        },
        state.selectedMetrics,
        {
          format: state.exportFormat,
          includeCharts: true,
          filters: state.filters,
        }
      );

      // Download the report
      downloadReport(report, state.exportFormat);

      setState(prev => ({ ...prev, isExporting: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isExporting: false,
        error: error instanceof Error ? error.message : 'Failed to export report',
      }));
    }
  }, [state.selectedTimeRange, state.selectedMetrics, state.filters, state.exportFormat]);

  const renderWidget = useCallback((widget: DashboardWidget) => {
    switch (widget.type) {
      case 'metric':
        return <MetricWidget key={widget.id} widget={widget} />;
      case 'chart':
        return <ChartWidget key={widget.id} widget={widget} />;
      case 'table':
        return <TableWidget key={widget.id} widget={widget} />;
      case 'funnel':
        return <FunnelWidget key={widget.id} widget={widget} />;
      case 'cohort':
        return <CohortWidget key={widget.id} widget={widget} />;
      default:
        return <div key={widget.id}>Unknown widget type: {widget.type}</div>;
    }
  }, []);

  if (state.isLoading && !state.isInitialized) {
    return (
      <div className={`analytics-dashboard loading ${className}`}>
        <div className="loading-spinner">Loading analytics dashboard...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={`analytics-dashboard error ${className}`}>
        <div className="error-message">
          <h3>Error Loading Dashboard</h3>
          <p>{state.error}</p>
          <button onClick={initializeDashboard}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`analytics-dashboard ${theme} ${className}`}>
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h1>{dashboard?.name || 'Analytics Dashboard'}</h1>
          {dashboard?.description && (
            <p className="dashboard-description">{dashboard.description}</p>
          )}
        </div>

        <div className="dashboard-controls">
          {/* Time Range Selector */}
          <div className="time-range-selector">
            <select
              value={state.selectedTimeRange}
              onChange={(e) => handleTimeRangeChange(e.target.value)}
              className="time-range-select"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>

          {/* Metric Selector */}
          <div className="metric-selector">
            {['activeUsers', 'currentPageViews', 'conversions', 'bounceRate', 'averageSessionDuration'].map(metric => (
              <label key={metric} className="metric-checkbox">
                <input
                  type="checkbox"
                  checked={state.selectedMetrics.includes(metric)}
                  onChange={() => handleMetricToggle(metric)}
                />
                {formatMetricName(metric)}
              </label>
            ))}
          </div>

          {/* Export Controls */}
          {enableExport && (
            <div className="export-controls">
              <select
                value={state.exportFormat}
                onChange={(e) => setState(prev => ({ ...prev, exportFormat: e.target.value as any }))}
                className="export-format-select"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
              <button
                onClick={handleExport}
                disabled={state.isExporting}
                className="export-button"
              >
                {state.isExporting ? 'Exporting...' : 'Export Report'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Metrics Overview */}
      {enableRealTime && (
        <div className="real-time-metrics">
          <h2>Real-time Metrics</h2>
          <div className="metrics-grid">
            <MetricCard
              title="Active Users"
              value={state.metrics.activeUsers}
              trend="up"
              icon="👥"
            />
            <MetricCard
              title="Page Views"
              value={state.metrics.currentPageViews}
              trend="up"
              icon="👁️"
            />
            <MetricCard
              title="Conversions"
              value={state.metrics.conversions}
              trend="stable"
              icon="🎯"
            />
            <MetricCard
              title="Bounce Rate"
              value={`${(state.metrics.bounceRate * 100).toFixed(1)}%`}
              trend="down"
              icon="📉"
            />
          </div>
        </div>
      )}

      {/* Privacy Settings Notice */}
      {privacySettings && (
        <div className="privacy-notice">
          <h3>Data Privacy</h3>
          <p>
            Analytics level: {privacySettings.level} |
            Data collection: {privacySettings.dataCollection ? 'Enabled' : 'Disabled'} |
            Retention: {privacySettings.retentionPeriod} days
          </p>
        </div>
      )}

      {/* Error Display */}
      {state.error && (
        <div className="error-notification">
          <p>{state.error}</p>
          <button onClick={() => setState(prev => ({ ...prev, error: null }))}>
            Dismiss
          </button>
        </div>
      )}

      {/* Dashboard Widgets */}
      <div className="dashboard-widgets">
        {dashboard?.widgets.map(renderWidget)}
      </div>

      {/* Footer */}
      <div className="dashboard-footer">
        <div className="footer-info">
          <p>Last updated: {new Date().toLocaleString()}</p>
          <p>Data retention: {config.retentionPeriod} days</p>
        </div>
        <div className="footer-links">
          <button onClick={() => window.open('/privacy-policy', '_blank')}>
            Privacy Policy
          </button>
          <button onClick={() => window.open('/analytics-settings', '_blank')}>
            Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// Widget Components
const MetricWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const [value, setValue] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');

  useEffect(() => {
    // Simulate metric data
    const interval = setInterval(() => {
      setValue(Math.floor(Math.random() * 1000));
      setTrend(Math.random() > 0.5 ? 'up' : 'down');
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="widget metric-widget" style={widget.layout}>
      <h3>{widget.title}</h3>
      <div className="metric-value">{value.toLocaleString()}</div>
      <div className={`metric-trend ${trend}`}>
        {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
      </div>
      {widget.description && (
        <p className="widget-description">{widget.description}</p>
      )}
    </div>
  );
};

const ChartWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    // Simulate chart data
    const generateData = () => {
      return Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        value: Math.floor(Math.random() * 100),
      }));
    };

    setData(generateData());
    const interval = setInterval(() => setData(generateData()), 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="widget chart-widget" style={widget.layout}>
      <h3>{widget.title}</h3>
      <div className="chart-container">
        <div className="chart-placeholder">
          {/* Simple chart visualization */}
          {data.map((point, index) => (
            <div
              key={index}
              className="chart-bar"
              style={{
                height: `${point.value}%`,
                width: `${100 / data.length}%`,
              }}
            />
          ))}
        </div>
      </div>
      {widget.description && (
        <p className="widget-description">{widget.description}</p>
      )}
    </div>
  );
};

const TableWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    // Simulate table data
    const generateData = () => {
      return Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        value: Math.floor(Math.random() * 1000),
        change: (Math.random() - 0.5) * 100,
      }));
    };

    setData(generateData());
    const interval = setInterval(() => setData(generateData()), 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="widget table-widget" style={widget.layout}>
      <h3>{widget.title}</h3>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.value.toLocaleString()}</td>
                <td className={row.change > 0 ? 'positive' : 'negative'}>
                  {row.change > 0 ? '+' : ''}{row.change.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {widget.description && (
        <p className="widget-description">{widget.description}</p>
      )}
    </div>
  );
};

const FunnelWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const [funnelData, setFunnelData] = useState([
    { stage: 'Awareness', value: 1000, percentage: 100 },
    { stage: 'Interest', value: 750, percentage: 75 },
    { stage: 'Consideration', value: 500, percentage: 50 },
    { stage: 'Decision', value: 250, percentage: 25 },
    { stage: 'Action', value: 100, percentage: 10 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFunnelData(prev => prev.map(stage => ({
        ...stage,
        value: Math.max(50, stage.value + Math.floor((Math.random() - 0.5) * 100)),
      })));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="widget funnel-widget" style={widget.layout}>
      <h3>{widget.title}</h3>
      <div className="funnel-container">
        {funnelData.map((stage, index) => (
          <div key={index} className="funnel-stage">
            <div className="funnel-bar" style={{ width: `${stage.percentage}%` }}>
              <div className="funnel-label">
                <span>{stage.stage}</span>
                <span>{stage.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {widget.description && (
        <p className="widget-description">{widget.description}</p>
      )}
    </div>
  );
};

const CohortWidget: React.FC<{ widget: DashboardWidget }> = ({ widget }) => {
  const [cohortData, setCohortData] = useState<any[]>([]);

  useEffect(() => {
    // Simulate cohort data
    const generateCohortData = () => {
      return Array.from({ length: 5 }, (_, week) => ({
        week: `Week ${week + 1}`,
        retention: Array.from({ length: 8 }, (_, period) => ({
          period: period + 1,
          rate: Math.max(20, 100 - (period * 10) + Math.floor(Math.random() * 20)),
        })),
      }));
    };

    setCohortData(generateCohortData());
    const interval = setInterval(() => setCohortData(generateCohortData()), 60000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="widget cohort-widget" style={widget.layout}>
      <h3>{widget.title}</h3>
      <div className="cohort-container">
        <div className="cohort-grid">
          {cohortData.map((cohort, rowIndex) => (
            <div key={rowIndex} className="cohort-row">
              <div className="cohort-label">{cohort.week}</div>
              {cohort.retention.map((period: any, colIndex: number) => (
                <div
                  key={colIndex}
                  className="cohort-cell"
                  style={{ backgroundColor: `rgba(59, 130, 246, ${period.rate / 100})` }}
                >
                  {period.rate}%
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {widget.description && (
        <p className="widget-description">{widget.description}</p>
      )}
    </div>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  trend: 'up' | 'down' | 'stable';
  icon?: string;
}> = ({ title, value, trend, icon }) => {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <div className="metric-icon">{icon}</div>
        <div className="metric-title">{title}</div>
      </div>
      <div className="metric-value">{value}</div>
      <div className={`metric-indicator ${trend}`}>
        {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
      </div>
    </div>
  );
};

// Utility functions
const getDefaultWidgets = (): DashboardWidget[] => {
  return [
    {
      id: 'active-users',
      type: 'metric',
      title: 'Active Users',
      description: 'Number of currently active users',
      data: { current: 0, previous: 0 },
      options: { format: 'number' },
      layout: { x: 0, y: 0, width: 3, height: 2 },
    },
    {
      id: 'page-views',
      type: 'metric',
      title: 'Page Views',
      description: 'Total page views in selected time period',
      data: { current: 0, previous: 0 },
      options: { format: 'number' },
      layout: { x: 3, y: 0, width: 3, height: 2 },
    },
    {
      id: 'conversion-rate',
      type: 'metric',
      title: 'Conversion Rate',
      description: 'Percentage of users who convert',
      data: { current: 0, previous: 0 },
      options: { format: 'percentage' },
      layout: { x: 6, y: 0, width: 3, height: 2 },
    },
    {
      id: 'bounce-rate',
      type: 'metric',
      title: 'Bounce Rate',
      description: 'Percentage of single-page sessions',
      data: { current: 0, previous: 0 },
      options: { format: 'percentage' },
      layout: { x: 9, y: 0, width: 3, height: 2 },
    },
    {
      id: 'traffic-chart',
      type: 'chart',
      title: 'Traffic Overview',
      description: 'Website traffic over time',
      data: { labels: [], datasets: [] },
      options: { type: 'line', responsive: true },
      layout: { x: 0, y: 2, width: 6, height: 3 },
    },
    {
      id: 'top-pages',
      type: 'table',
      title: 'Top Pages',
      description: 'Most visited pages',
      data: [],
      options: { sortable: true, searchable: true },
      layout: { x: 6, y: 2, width: 6, height: 3 },
    },
    {
      id: 'conversion-funnel',
      type: 'funnel',
      title: 'Conversion Funnel',
      description: 'User conversion funnel stages',
      data: [],
      options: { animated: true },
      layout: { x: 0, y: 5, width: 6, height: 3 },
    },
    {
      id: 'cohort-analysis',
      type: 'cohort',
      title: 'Cohort Analysis',
      description: 'User retention by cohort',
      data: [],
      options: { heatMap: true },
      layout: { x: 6, y: 5, width: 6, height: 3 },
    },
  ];
};

const formatMetricName = (metric: string): string => {
  return metric
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const getDateRangeStart = (timeRange: string): Date => {
  const now = new Date();
  switch (timeRange) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
};

const downloadReport = (report: AnalyticsReport, format: string) => {
  let content: string;
  let filename: string;
  let mimeType: string;

  switch (format) {
    case 'json':
      content = JSON.stringify(report, null, 2);
      filename = `analytics-report-${Date.now()}.json`;
      mimeType = 'application/json';
      break;
    case 'csv':
      content = convertReportToCSV(report);
      filename = `analytics-report-${Date.now()}.csv`;
      mimeType = 'text/csv';
      break;
    case 'pdf':
      // In a real implementation, this would generate a PDF
      content = JSON.stringify(report, null, 2);
      filename = `analytics-report-${Date.now()}.json`;
      mimeType = 'application/json';
      break;
    default:
      content = JSON.stringify(report, null, 2);
      filename = `analytics-report-${Date.now()}.json`;
      mimeType = 'application/json';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const convertReportToCSV = (report: AnalyticsReport): string => {
  // Simple CSV conversion for demonstration
  const headers = ['Metric', 'Value', 'Timestamp'];
  const rows = [
    ['Report ID', report.id, report.created.toISOString()],
    ['Type', report.type, report.updated.toISOString()],
  ];

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

export default AnalyticsDashboard;