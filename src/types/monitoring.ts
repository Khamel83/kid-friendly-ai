/**
 * Monitoring system type definitions for kid-friendly-ai
 * Defines interfaces for system health, performance metrics, alerts, and incident management
 */

// Health Status Interfaces
export interface HealthStatus {
  id: string;
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  timestamp: number;
  description: string;
  metrics: HealthMetrics;
  dependencies: HealthDependency[];
  checks: HealthCheck[];
}

export interface HealthMetrics {
  availability: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  resourceUsage: ResourceUsage;
}

export interface HealthDependency {
  id: string;
  name: string;
  type: 'database' | 'api' | 'service' | 'external' | 'internal';
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: number;
  responseTime: number;
  error?: string;
}

export interface HealthCheck {
  id: string;
  name: string;
  type: 'readiness' | 'liveness' | 'custom';
  status: 'pass' | 'fail' | 'timeout';
  duration: number;
  timestamp: number;
  details?: Record<string, any>;
}

// Performance Metric Types
export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
  threshold?: PerformanceThreshold;
}

export interface PerformanceThreshold {
  warning: number;
  critical: number;
  unit: string;
  comparison: 'greater_than' | 'less_than' | 'equals';
  duration?: number;
}

export interface PerformanceAggregation {
  name: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
  p50: number;
  p90: number;
  p95: | number;
  p99: number;
  timestamp: number;
}

// Resource Monitoring Types
export interface ResourceUsage {
  cpu: ResourceMetric;
  memory: ResourceMetric;
  disk: ResourceMetric;
  network: ResourceMetric;
  custom?: Record<string, ResourceMetric>;
}

export interface ResourceMetric {
  used: number;
  available: number;
  total: number;
  percentage: number;
  unit: string;
  trend: 'increasing' | 'decreasing' | 'stable';
}

// Alert Configuration Types
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  channels: AlertChannel[];
  enabled: boolean;
  cooldown: number;
  lastTriggered?: number;
  triggerCount: number;
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
  value: number;
  duration?: number;
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'count';
}

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AlertChannel {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'slack' | 'webhook' | 'pagerduty';
  config: AlertChannelConfig;
  enabled: boolean;
}

export interface AlertChannelConfig {
  email?: string;
  webhook?: string;
  slack?: {
    webhook: string;
    channel: string;
  };
  sms?: {
    phoneNumber: string;
    provider: string;
  };
  pagerduty?: {
    serviceKey: string;
    escalationPolicy: string;
  };
}

export interface Alert {
  id: string;
  ruleId: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed';
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
  channels: AlertChannel[];
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolvedAt?: number;
  metadata?: Record<string, any>;
}

// Incident Management Types
export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  impact: IncidentImpact;
  category: IncidentCategory;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  closedAt?: number;
  assignee?: string;
  alerts: string[];
  timeline: IncidentTimelineEntry[];
  actions: IncidentAction[];
  rootCause?: string;
  resolution?: string;
  postMortem?: PostMortem;
}

export interface IncidentImpact {
  scope: 'system' | 'service' | 'feature' | 'user';
  affectedUsers: number;
  businessImpact: 'low' | 'medium' | 'high' | 'critical';
  slaBreach?: boolean;
}

export type IncidentCategory =
  | 'performance'
  | 'availability'
  | 'security'
  | 'data'
  | 'infrastructure'
  | 'deployment'
  | 'user_error';

export interface IncidentTimelineEntry {
  timestamp: number;
  type: 'created' | 'updated' | 'assigned' | 'escalated' | 'resolved' | 'comment';
  message: string;
  user: string;
  details?: Record<string, any>;
}

export interface IncidentAction {
  id: string;
  type: 'investigation' | 'mitigation' | 'resolution' | 'communication';
  description: string;
  assignedTo: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: number;
  completedAt?: number;
  result?: string;
}

export interface PostMortem {
  summary: string;
  timeline: string;
  rootCause: string;
  impact: string;
  resolution: string;
  lessonsLearned: string[];
  actionItems: PostMortemAction[];
  createdAt: number;
  author: string;
}

export interface PostMortemAction {
  id: string;
  description: string;
  assignee: string;
  dueDate: number;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: number;
}

// Service Dependency Types
export interface ServiceDependency {
  id: string;
  name: string;
  type: 'internal' | 'external' | 'database' | 'cache' | 'queue';
  endpoint?: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastChecked: number;
  responseTime: number;
  errorRate: number;
  sla: {
    uptime: number;
    responseTime: number;
  };
  dependencies?: string[];
}

// Monitoring Dashboard Types
export interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  refreshInterval: number;
  timeRange: TimeRange;
  filters?: Record<string, any>;
}

export interface DashboardLayout {
  type: 'grid' | 'flex';
  columns: number;
  rows?: number;
  gap: number;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'health' | 'alert' | 'incident' | 'custom';
  title: string;
  position: WidgetPosition;
  size: WidgetSize;
  config: WidgetConfig;
  data?: any;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetConfig {
  metric?: string;
  chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  timeRange?: TimeRange;
  aggregation?: string;
  thresholds?: PerformanceThreshold[];
  filters?: Record<string, any>;
}

export interface TimeRange {
  start: number;
  end: number;
  interval?: number;
}

// Alert Response Types
export interface AlertResponse {
  id: string;
  alertId: string;
  responder: string;
  action: 'acknowledged' | 'suppressed' | 'resolved' | 'escalated';
  timestamp: number;
  message?: string;
  details?: Record<string, any>;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  levels: EscalationLevel[];
  repeatInterval: number;
  maxEscalations: number;
}

export interface EscalationLevel {
  level: number;
  timeout: number;
  targets: string[];
  channels: AlertChannel[];
}

// Capacity Planning Types
export interface CapacityMetrics {
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  requests: number;
  responseTime: number;
  users: number;
  cost?: number;
}

export interface CapacityForecast {
  metric: string;
  currentValue: number;
  forecastedValue: number;
  timeframe: string;
  confidence: number;
  recommendations: string[];
  risk: 'low' | 'medium' | 'high';
  actionRequired: boolean;
}

export interface ScalingRecommendation {
  type: 'horizontal' | 'vertical' | 'auto';
  resource: string;
  currentValue: number;
  recommendedValue: number;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: {
    performance: number;
    cost: number;
  };
  timeframe: string;
}

// Monitoring Events
export interface MonitoringEvent {
  id: string;
  type: 'metric' | 'health' | 'alert' | 'incident' | 'custom';
  source: string;
  timestamp: number;
  data: any;
  tags: Record<string, string>;
  severity?: AlertSeverity;
}

// System Topology
export interface SystemTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  metadata: {
    version: string;
    lastUpdated: number;
  };
}

export interface TopologyNode {
  id: string;
  name: string;
  type: 'service' | 'database' | 'cache' | 'queue' | 'external';
  status: 'healthy' | 'warning' | 'critical';
  position: { x: number; y: number };
  metrics: HealthMetrics;
  dependencies?: string[];
}

export interface TopologyEdge {
  source: string;
  target: string;
  type: 'sync' | 'async';
  status: 'healthy' | 'degraded' | 'failed';
  metrics: {
    latency: number;
    errorRate: number;
    throughput: number;
  };
}

// Monitoring Configuration
export interface MonitoringConfig {
  enabled: boolean;
  samplingRate: number;
  retentionPeriod: number;
  alerting: {
    enabled: boolean;
    defaultChannels: AlertChannel[];
    suppressionRules: SuppressionRule[];
  };
  performance: {
    thresholds: Record<string, PerformanceThreshold>;
    aggregationInterval: number;
  };
  health: {
    checkInterval: number;
    timeout: number;
    retryCount: number;
  };
  incidents: {
    autoCreate: boolean;
    autoAssign: boolean;
    escalationPolicy?: string;
  };
  capacity: {
    forecastingEnabled: boolean;
    alertThresholds: {
      cpu: number;
      memory: number;
      disk: number;
    };
  };
}

export interface SuppressionRule {
  id: string;
  name: string;
  condition: AlertCondition;
  duration: number;
  reason: string;
  createdBy: string;
  createdAt: number;
  active: boolean;
}

// Export all types
export type {
  HealthStatus,
  HealthMetrics,
  HealthDependency,
  HealthCheck,
  PerformanceMetric,
  PerformanceThreshold,
  PerformanceAggregation,
  ResourceUsage,
  ResourceMetric,
  AlertRule,
  AlertCondition,
  AlertSeverity,
  AlertChannel,
  AlertChannelConfig,
  Alert,
  Incident,
  IncidentImpact,
  IncidentCategory,
  IncidentTimelineEntry,
  IncidentAction,
  PostMortem,
  PostMortemAction,
  ServiceDependency,
  DashboardConfig,
  DashboardLayout,
  DashboardWidget,
  WidgetPosition,
  WidgetSize,
  WidgetConfig,
  TimeRange,
  AlertResponse,
  EscalationPolicy,
  EscalationLevel,
  CapacityMetrics,
  CapacityForecast,
  ScalingRecommendation,
  MonitoringEvent,
  SystemTopology,
  TopologyNode,
  TopologyEdge,
  MonitoringConfig,
  SuppressionRule
};