# Comprehensive Monitoring System

The kid-friendly-ai project includes a comprehensive monitoring system that provides real-time system health monitoring, performance metrics collection, error tracking, alert management, incident response, and capacity planning.

## Overview

The monitoring system consists of 8 core components:

1. **Type Definitions** (`src/types/monitoring.ts`) - Complete TypeScript interfaces for all monitoring concepts
2. **Monitoring Manager** (`src/utils/monitoringManager.ts`) - Centralized monitoring management and coordination
3. **React Hooks** (`src/hooks/useMonitoring.ts`) - React integration hooks for components
4. **Health Checker** (`src/utils/healthChecker.ts`) - Comprehensive health checking utilities
5. **Alert Manager** (`src/utils/alertManager.ts`) - Multi-channel alerting and notification system
6. **Monitoring Dashboard** (`src/components/monitoringDashboard.tsx`) - Real-time monitoring dashboard
7. **Incident Manager** (`src/utils/incidentManager.ts`) - Incident response and management system
8. **Capacity Planner** (`src/utils/capacityPlanner.ts`) - Resource forecasting and optimization

## Features

### 🏥 Health Monitoring
- System health status monitoring
- Service dependency health checks
- Database connectivity monitoring
- API endpoint health verification
- Network connectivity checking
- Resource threshold monitoring

### 📊 Performance Metrics
- Real-time performance metric collection
- Web Vitals monitoring (LCP, FID, CLS, etc.)
- Memory usage tracking
- CPU utilization monitoring
- Network performance analysis
- Custom metric recording

### 🚨 Alert Management
- Multi-channel notifications (Email, Slack, SMS, Webhook, PagerDuty)
- Configurable alert rules and thresholds
- Alert deduplication and suppression
- Escalation policies
- Alert acknowledgment and resolution workflows

### 🔥 Incident Management
- Automatic incident creation from alerts
- Incident correlation and merging
- Timeline tracking and action management
- Post-mortem generation
- Incident analytics and trend analysis
- Communication workflows

### 📈 Capacity Planning
- Resource usage trend analysis
- Growth forecasting with multiple models
- Scaling recommendations
- Cost optimization insights
- Bottleneck identification
- Performance prediction

### 🎛️ Monitoring Dashboard
- Real-time system status visualization
- Performance metrics charts
- Resource usage displays
- Alert notification center
- Incident management interface
- System topology visualization
- Capacity planning insights

## Quick Start

### 1. Basic Usage in Components

```typescript
import { usePerformanceMonitoring, useHealthCheck } from '../hooks/useMonitoring';

function MyComponent() {
  const { measurePerformance, recordMetric } = usePerformanceMonitoring('MyComponent');
  const { healthStatus, isHealthy } = useHealthCheck('my_service');

  const handleExpensiveOperation = async () => {
    return measurePerformance('expensive_operation', async () => {
      // Your expensive operation here
      await someAsyncOperation();

      // Record custom metrics
      recordMetric('operation_success', 1, 'count');

      return result;
    });
  };

  return (
    <div>
      {isHealthy ? '✅ Service Healthy' : '⚠️ Service Issues'}
      <button onClick={handleExpensiveOperation}>Run Operation</button>
    </div>
  );
}
```

### 2. Using the Monitoring Dashboard

```typescript
import MonitoringDashboard from '../components/monitoringDashboard';

function AdminDashboard() {
  return (
    <MonitoringDashboard
      refreshInterval={30000}
      showSystemTopology={true}
      showIncidentManagement={true}
      showCapacityPlanning={true}
    />
  );
}
```

### 3. Creating Custom Alerts

```typescript
import { createAlert } from '../utils/monitoringManager';

// Create a custom alert
createAlert({
  ruleId: 'custom_high_memory',
  name: 'High Memory Usage Detected',
  description: 'Memory usage has exceeded the threshold',
  severity: 'warning',
  status: 'active',
  metric: 'memory_usage',
  value: 85.2,
  threshold: 80,
  channels: [emailChannel, slackChannel]
});
```

### 4. Managing Incidents

```typescript
import { createIncident, resolveIncident } from '../utils/incidentManager';

// Create an incident
const incident = createIncident({
  title: 'API Service Degradation',
  description: 'Response times have increased significantly',
  severity: 'error',
  category: 'performance',
  impact: {
    scope: 'service',
    affectedUsers: 1000,
    businessImpact: 'medium'
  },
  createdBy: 'system'
});

// Resolve the incident
resolveIncident(incident.id, 'Fixed the database query performance issue', 'admin');
```

## Configuration

### Alert Configuration

```typescript
// Configure alert channels
const emailChannel = {
  id: 'email_notifications',
  name: 'Email Notifications',
  type: 'email' as const,
  enabled: true,
  config: {
    email: 'alerts@example.com'
  }
};

const slackChannel = {
  id: 'slack_notifications',
  name: 'Slack Notifications',
  type: 'slack' as const,
  enabled: true,
  config: {
    webhook: 'https://hooks.slack.com/services/...',
    channel: '#alerts'
  }
};
```

### Monitoring Configuration

```typescript
import { monitoringManager } from '../utils/monitoringManager';

// Update monitoring configuration
monitoringManager.updateConfig({
  alerting: {
    enabled: true,
    defaultChannels: [emailChannel, slackChannel],
    suppressionRules: []
  },
  performance: {
    thresholds: {
      responseTime: { warning: 1000, critical: 5000, unit: 'ms', comparison: 'greater_than' },
      errorRate: { warning: 1, critical: 5, unit: '%', comparison: 'greater_than' }
    },
    aggregationInterval: 60000
  }
});
```

## API Reference

### Core Classes

#### MonitoringManager
Central coordinator for all monitoring activities.

```typescript
// Get instance
const manager = monitoringManager;

// Record a metric
manager.recordPerformanceMetric(metric);

// Get system overview
const overview = manager.getSystemOverview();

// Update configuration
manager.updateConfig(config);
```

#### HealthChecker
Manages health checks for services and dependencies.

```typescript
import { healthChecker } from '../utils/healthChecker';

// Register a health check
healthChecker.registerHealthCheck({
  name: 'Database Health',
  type: 'database',
  timeout: 5000,
  interval: 30000,
  retries: 3,
  threshold: { responseTime: 1000, errorRate: 1, availability: 99 }
});

// Get health summary
const summary = healthChecker.getHealthSummary();
```

#### AlertManager
Handles alert creation, notification, and management.

```typescript
import { alertManager } from '../utils/alertManager';

// Create an alert rule
alertManager.createAlertRule({
  id: 'high_cpu_usage',
  name: 'High CPU Usage',
  condition: {
    metric: 'cpu_usage',
    operator: 'gt',
    value: 80,
    duration: 300000
  },
  severity: 'warning',
  enabled: true
});

// Acknowledge an alert
alertManager.acknowledgeAlert(alertId, 'admin', 'Investigating the issue');
```

#### IncidentManager
Manages incident lifecycle and response.

```typescript
import { incidentManager } from '../utils/incidentManager';

// Create an incident
const incident = incidentManager.createIncident({
  title: 'Service Outage',
  description: 'Main service is unavailable',
  severity: 'critical',
  category: 'availability'
});

// Add action items
incidentManager.addAction(incident.id, {
  type: 'investigation',
  description: 'Check service logs',
  assignedTo: 'admin'
});
```

#### CapacityPlanner
Provides capacity planning and forecasting.

```typescript
import { capacityPlanner } from '../utils/capacityPlanner';

// Perform capacity analysis
const analysis = capacityPlanner.performCapacityAnalysis();

// Generate a capacity report
const report = capacityPlanner.generateCapacityReport({
  start: Date.now() - (7 * 24 * 60 * 60 * 1000), // 7 days ago
  end: Date.now()
});

// Get scaling recommendations
const recommendations = capacityPlanner.getScalingRecommendations();
```

### React Hooks

#### usePerformanceMonitoring
Monitor component performance.

```typescript
const {
  metrics,
  loading,
  measurePerformance,
  recordMetric,
  getMetricSummary
} = usePerformanceMonitoring('ComponentName');
```

#### useHealthCheck
Monitor service health.

```typescript
const {
  healthStatus,
  isHealthy,
  checking,
  performHealthCheck
} = useHealthCheck('serviceId');
```

#### useResourceMonitoring
Monitor system resources.

```typescript
const {
  resources,
  history,
  getResourceTrend
} = useResourceMonitoring();
```

#### useAlertManagement
Manage alerts in components.

```typescript
const {
  alerts,
  acknowledgeAlert,
  resolveAlert,
  getActiveAlerts
} = useAlertManagement();
```

#### useIncidentManagement
Manage incidents in components.

```typescript
const {
  incidents,
  createIncident,
  updateIncident,
  getActiveIncidents
} = useIncidentManagement();
```

#### useMonitoringDashboard
Dashboard management hook.

```typescript
const {
  widgets,
  loading,
  refreshDashboard,
  updateTimeRange,
  getDashboardStats
} = useMonitoringDashboard();
```

## Integration Examples

### Adding Custom Metrics

```typescript
// In your API route or service
import { recordMetric } from '../utils/monitoringManager';

export async function apiHandler(req, res) {
  const startTime = Date.now();

  try {
    const result = await yourBusinessLogic();

    // Record success metric
    recordMetric({
      id: `api_success_${Date.now()}`,
      name: 'api_success_rate',
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      tags: { endpoint: req.path, method: req.method }
    });

    res.json(result);
  } catch (error) {
    // Record error metric
    recordMetric({
      id: `api_error_${Date.now()}`,
      name: 'api_error_rate',
      value: 1,
      unit: 'count',
      timestamp: Date.now(),
      tags: { endpoint: req.path, error: error.message }
    });

    res.status(500).json({ error: 'Internal server error' });
  } finally {
    // Record response time
    const responseTime = Date.now() - startTime;
    recordMetric({
      id: `api_response_time_${Date.now()}`,
      name: 'api_response_time',
      value: responseTime,
      unit: 'ms',
      timestamp: Date.now(),
      tags: { endpoint: req.path }
    });
  }
}
```

### Monitoring Database Connections

```typescript
import { healthChecker } from '../utils/healthChecker';

// Register database health check
healthChecker.registerHealthCheck({
  name: 'Database Connection',
  type: 'database',
  timeout: 5000,
  interval: 30000,
  retries: 3,
  threshold: { responseTime: 1000, errorRate: 1, availability: 99 }
});

// Your database service with monitoring
class DatabaseService {
  async query(sql: string) {
    const startTime = Date.now();

    try {
      const result = await pool.query(sql);

      // Record query performance
      recordMetric({
        id: `db_query_${Date.now()}`,
        name: 'db_query_time',
        value: Date.now() - startTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: { operation: 'query' }
      });

      return result;
    } catch (error) {
      // Record database errors
      recordMetric({
        id: `db_error_${Date.now()}`,
        name: 'db_error_count',
        value: 1,
        unit: 'count',
        timestamp: Date.now(),
        tags: { error: error.message }
      });

      throw error;
    }
  }
}
```

### Setting Up Alert Notifications

```typescript
import { alertManager } from '../utils/alertManager';

// Configure Slack notifications
const slackChannel = {
  id: 'slack_alerts',
  name: 'Slack Alerts',
  type: 'slack' as const,
  enabled: true,
  config: {
    webhook: process.env.SLACK_WEBHOOK_URL,
    channel: '#monitoring'
  }
};

alertManager.addChannel(slackChannel);

// Configure email notifications
const emailChannel = {
  id: 'email_alerts',
  name: 'Email Alerts',
  type: 'email' as const,
  enabled: true,
  config: {
    email: 'alerts@yourcompany.com'
  }
};

alertManager.addChannel(emailChannel);

// Create critical alert rule
alertManager.createAlertRule({
  id: 'critical_system_failure',
  name: 'Critical System Failure',
  description: 'System has experienced a critical failure',
  condition: {
    metric: 'system_health',
    operator: 'eq',
    value: 0, // Critical status
    duration: 60000 // 1 minute
  },
  severity: 'critical',
  channels: [slackChannel, emailChannel],
  enabled: true,
  cooldown: 300000 // 5 minutes
});
```

## Best Practices

### 1. Metric Naming Conventions
- Use consistent naming: `component_action_unit` (e.g., `api_response_time_ms`)
- Include units in metric names when possible
- Use tags for additional context rather than creating many metrics

### 2. Alert Configuration
- Set appropriate thresholds to avoid alert fatigue
- Use different severity levels appropriately
- Configure cooldown periods to prevent spam
- Set up escalation policies for critical alerts

### 3. Performance Monitoring
- Monitor key user journeys and business metrics
- Track both technical and business KPIs
- Use percentiles (P95, P99) rather than averages for response times
- Monitor error rates, not just absolute error counts

### 4. Incident Management
- Document clear incident response procedures
- Use templates for common incident types
- Conduct post-mortems for significant incidents
- Track and follow up on action items

### 5. Capacity Planning
- Regularly review capacity forecasts
- Set up automated scaling where possible
- Monitor cost trends and optimization opportunities
- Plan for seasonal traffic patterns

## Troubleshooting

### Common Issues

**High Memory Usage**
- Check for memory leaks in custom components
- Review metric retention settings
- Monitor garbage collection patterns

**Alert Spam**
- Review alert thresholds and cooldown periods
- Check for duplicate alert rules
- Configure suppression rules for known issues

**Performance Impact**
- Monitor sampling rates and adjust as needed
- Use asynchronous metric recording where possible
- Review aggregation intervals

**Dashboard Loading Issues**
- Check time range and data volume
- Verify monitoring service connectivity
- Review browser console for errors

## Integration with Existing Systems

### External Monitoring Tools
The monitoring system can integrate with external tools through:

- **Webhook notifications** for custom integrations
- **Metric export** for Prometheus, Grafana, etc.
- **Alert forwarding** to PagerDuty, Opsgenie, etc.
- **Log aggregation** with ELK stack or similar

### API Endpoints
The system provides several API endpoints:

- `/api/health` - Health status and metrics
- `/api/alerts` - Alert management
- `/api/incidents` - Incident management
- `/api/metrics` - Performance metrics
- `/api/capacity` - Capacity planning data

## Contributing

When contributing to the monitoring system:

1. Follow the established code patterns and conventions
2. Add comprehensive tests for new functionality
3. Update documentation for new features
4. Consider performance implications of changes
5. Test monitoring changes in a staging environment

## License

This monitoring system is part of the kid-friendly-ai project and follows the same license terms.