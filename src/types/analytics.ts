/**
 * Analytics Type Definitions
 * Comprehensive type system for analytics data structures and interfaces
 */

// Core Analytics Types
export interface AnalyticsEvent {
  id: string;
  timestamp: Date;
  type: string;
  category: string;
  userId?: string;
  sessionId: string;
  deviceId?: string;
  eventData: Record<string, any>;
  metadata?: Record<string, any>;
  privacyLevel: PrivacyLevel;
}

export interface UserSession {
  id: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  pageViews: number;
  events: AnalyticsEvent[];
  deviceInfo: DeviceInfo;
  locationInfo?: LocationInfo;
  referrer?: string;
  campaign?: CampaignInfo;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  screenResolution: string;
  viewportSize: string;
  timezone: string;
  language: string;
  isOnline: boolean;
  connectionType: ConnectionType;
}

export interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  timezone: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface CampaignInfo {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

// Privacy Types
export type PrivacyLevel = 'anonymous' | 'pseudonymous' | 'identifiable';

export interface PrivacySettings {
  level: PrivacyLevel;
  dataCollection: boolean;
  behavioralTracking: boolean;
  locationTracking: boolean;
  deviceTracking: boolean;
  cookieConsent: boolean;
  personalization: boolean;
  thirdPartySharing: boolean;
  retentionPeriod: number;
}

export interface UserConsent {
  id: string;
  userId?: string;
  timestamp: Date;
  privacySettings: PrivacySettings;
  ipAddress?: string;
  userAgent?: string;
  version: string;
  validUntil: Date;
}

// Performance Metrics
export interface PerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  memoryUsage: number;
  networkLatency: number;
  apiResponseTime: number;
  renderTime: number;
  scriptExecutionTime: number;
  resourceLoadTime: number;
}

// User Behavior Types
export interface UserBehavior {
  clickStream: ClickEvent[];
  scrollEvents: ScrollEvent[];
  navigationEvents: NavigationEvent[];
  interactionEvents: InteractionEvent[];
  conversionEvents: ConversionEvent[];
  abandonmentEvents: AbandonmentEvent[];
  engagementEvents: EngagementEvent[];
  errorEvents: ErrorEvent[];
}

export interface ClickEvent {
  timestamp: Date;
  elementId?: string;
  elementClass?: string;
  elementText?: string;
  x: number;
  y: number;
  page: string;
  context?: string;
}

export interface ScrollEvent {
  timestamp: Date;
  page: string;
  scrollPercentage: number;
  scrollDirection: 'up' | 'down';
  section?: string;
}

export interface NavigationEvent {
  timestamp: Date;
  from: string;
  to: string;
  method: 'click' | 'form' | 'back' | 'forward' | 'refresh';
  duration?: number;
}

export interface InteractionEvent {
  timestamp: Date;
  type: 'hover' | 'focus' | 'blur' | 'input' | 'change' | 'select';
  elementId?: string;
  elementClass?: string;
  value?: string;
  page: string;
}

export interface ConversionEvent {
  timestamp: Date;
  type: string;
  value: number;
  currency?: string;
  funnelStage: string;
  attribution: AttributionInfo;
  metadata?: Record<string, any>;
}

export interface AbandonmentEvent {
  timestamp: Date;
  page: string;
  formId?: string;
  step: number;
  totalSteps: number;
  reason?: string;
}

export interface EngagementEvent {
  timestamp: Date;
  type: 'view' | 'read' | 'watch' | 'listen' | 'play' | 'pause' | 'stop';
  duration: number;
  progress: number;
  contentId?: string;
  contentType?: string;
}

export interface ErrorEvent {
  timestamp: Date;
  type: string;
  message: string;
  stack?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  userId?: string;
}

// Funnel Analytics
export interface FunnelAnalytics {
  id: string;
  name: string;
  stages: FunnelStage[];
  conversionRate: number;
  dropoffRate: number;
  averageTimeInFunnel: number;
  totalEntries: number;
  totalConversions: number;
  created: Date;
  updated: Date;
}

export interface FunnelStage {
  id: string;
  name: string;
  order: number;
  entries: number;
  exits: number;
  conversions: number;
  dropoffRate: number;
  averageTime: number;
  conditions: FunnelCondition[];
}

export interface FunnelCondition {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';
  value: any;
}

// Cohort Analysis
export interface CohortAnalysis {
  id: string;
  name: string;
  type: 'acquisition' | 'behavior' | 'demographic' | 'custom';
  criteria: CohortCriteria;
  users: string[];
  metrics: CohortMetrics;
  created: Date;
  period: CohortPeriod;
}

export interface CohortCriteria {
  field: string;
  operator: 'equals' | 'in' | 'contains' | 'greater_than' | 'less_than';
  value: any | any[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface CohortMetrics {
  retentionRate: number;
  engagementRate: number;
  conversionRate: number;
  lifetimeValue: number;
  averageSessionDuration: number;
  churnRate: number;
  repeatUsage: number;
}

export interface CohortPeriod {
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  intervals: number;
  currentInterval: number;
}

// A/B Testing
export interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  variants: TestVariant[];
  metrics: TestMetrics;
  targeting: TestTargeting;
  results: TestResult[];
  startDate: Date;
  endDate?: Date;
  winner?: string;
}

export interface TestVariant {
  id: string;
  name: string;
  configuration: Record<string, any>;
  trafficPercentage: number;
  isActive: boolean;
}

export interface TestMetrics {
  primary: string;
  secondary: string[];
  statisticalSignificance: number;
  minimumSampleSize: number;
  power: number;
  confidenceLevel: number;
}

export interface TestTargeting {
  audience: string[];
  percentage: number;
  conditions: TargetCondition[];
  duration: number;
}

export interface TargetCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  value: any;
}

export interface TestResult {
  variantId: string;
  metricName: string;
  value: number;
  improvement: number;
  confidence: number;
  significance: boolean;
  sampleSize: number;
  standardError: number;
}

// Analytics Configuration
export interface AnalyticsConfig {
  enabled: boolean;
  trackingId?: string;
  endpoint?: string;
  batchSize: number;
  batchInterval: number;
  maxEventsPerSession: number;
  retentionPeriod: number;
  privacyLevel: PrivacyLevel;
  samplingRate: number;
  debugMode: boolean;
  offlineMode: boolean;
  compression: boolean;
  encryption: boolean;
}

export interface AnalyticsProvider {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  mappings: EventMapping[];
}

export interface EventMapping {
  fromEvent: string;
  toEvent: string;
  transformations: Transformation[];
}

export interface Transformation {
  field: string;
  type: 'rename' | 'extract' | 'combine' | 'calculate' | 'filter';
  config: Record<string, any>;
}

// Real-time Analytics
export interface RealTimeMetrics {
  activeUsers: number;
  currentPageViews: number;
  eventsPerSecond: number;
  averageSessionDuration: number;
  bounceRate: number;
  topPages: PageMetric[];
  topEvents: EventMetric[];
  topReferrers: ReferrerMetric[];
  conversions: number;
  revenue?: number;
}

export interface PageMetric {
  path: string;
  views: number;
  uniqueViews: number;
  averageTime: number;
  bounceRate: number;
}

export interface EventMetric {
  type: string;
  count: number;
  uniqueUsers: number;
  averageValue?: number;
}

export interface ReferrerMetric {
  source: string;
  visits: number;
  conversionRate: number;
}

// Reporting Types
export interface AnalyticsReport {
  id: string;
  name: string;
  type: 'summary' | 'detailed' | 'custom';
  period: ReportPeriod;
  filters: ReportFilter[];
  metrics: ReportMetric[];
  visualizations: Visualization[];
  created: Date;
  updated: Date;
  scheduled?: ReportSchedule;
  delivery?: DeliveryConfig;
}

export interface ReportPeriod {
  start: Date;
  end: Date;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
}

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

export interface ReportMetric {
  name: string;
  type: 'count' | 'sum' | 'average' | 'percentage' | 'rate' | 'ratio';
  field: string;
  format?: string;
}

export interface Visualization {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'table';
  title: string;
  data: any;
  options: Record<string, any>;
}

export interface ReportSchedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  timezone: string;
  active: boolean;
  nextRun: Date;
}

export interface DeliveryConfig {
  type: 'email' | 'webhook' | 'download' | 'export';
  recipients?: string[];
  format: 'json' | 'csv' | 'pdf' | 'excel';
  compression: boolean;
  encryption: boolean;
}

// Attribution Types
export interface AttributionInfo {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  term?: string;
  touchpoints: AttributionTouchpoint[];
  model: AttributionModel;
  value?: number;
}

export interface AttributionTouchpoint {
  timestamp: Date;
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  interactionType: string;
  value?: number;
}

export interface AttributionModel {
  type: 'last_click' | 'first_click' | 'linear' | 'time_decay' | 'position_based';
  weights?: number[];
  lookbackWindow: number;
}

// Connection Types
export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'unknown';

// Utility Types
export interface AnalyticsResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  dateRange?: {
    start: Date;
    end: Date;
  };
  userId?: string;
  sessionId?: string;
  eventType?: string;
  category?: string;
  deviceType?: string;
  location?: string;
  customFilters?: Record<string, any>;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'excel' | 'pdf' | 'xml';
  compression: boolean;
  encryption: boolean;
  includeMetadata: boolean;
  includeSensitiveData: boolean;
}

// Dashboard Component Types
export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'map' | 'funnel' | 'cohort';
  title: string;
  description?: string;
  data: any;
  options: Record<string, any>;
  layout: WidgetLayout;
  refreshInterval?: number;
}

export interface WidgetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  permissions: DashboardPermissions;
  created: Date;
  updated: Date;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  spacing: number;
  responsive: boolean;
}

export interface DashboardPermissions {
  view: string[];
  edit: string[];
  share: string[];
  public: boolean;
}

// Event Processing Types
export interface EventProcessor {
  id: string;
  name: string;
  type: 'filter' | 'transform' | 'aggregate' | 'enrich' | 'validate';
  config: Record<string, any>;
  conditions: ProcessorCondition[];
  order: number;
  enabled: boolean;
}

export interface ProcessorCondition {
  field: string;
  operator: 'exists' | 'equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface EventPipeline {
  id: string;
  name: string;
  processors: EventProcessor[];
  enabled: boolean;
  created: Date;
  updated: Date;
}

// Data Quality Types
export interface DataQualityReport {
  id: string;
  timestamp: Date;
  totalEvents: number;
  validEvents: number;
  invalidEvents: number;
  qualityScore: number;
  issues: DataQualityIssue[];
  recommendations: string[];
}

export interface DataQualityIssue {
  type: 'missing_field' | 'invalid_format' | 'duplicate_event' | 'out_of_range' | 'schema_violation';
  field?: string;
  eventIds: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestedAction: string;
}

// Security and Audit Types
export interface AuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: 'unauthorized_access' | 'data_breach' | 'suspicious_activity' | 'privacy_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedResources: string[];
  actionTaken: string;
  resolved: boolean;
}