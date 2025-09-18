/**
 * Content Management System Types
 * Provides comprehensive type definitions for content lifecycle management
 */

// Content Metadata Interfaces
export interface ContentMetadata {
  id: string;
  title: string;
  description: string;
  category: ContentCategory;
  tags: string[];
  author: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  expiresAt?: Date;
  ageRange: AgeRange;
  difficulty: DifficultyLevel;
  estimatedTime: number; // in minutes
  language: string;
  isPremium: boolean;
  downloadCount: number;
  viewCount: number;
  rating: ContentRating;
  status: ContentStatus;
}

export interface ContentRating {
  average: number;
  count: number;
  breakdown: {
    [key: number]: number; // rating -> count
  };
  userRating?: number;
}

export interface AgeRange {
  min: number;
  max: number;
}

// Content Types
export type ContentCategory =
  | 'animals'
  | 'science'
  | 'math'
  | 'reading'
  | 'art'
  | 'music'
  | 'history'
  | 'geography'
  | 'technology'
  | 'life-skills'
  | 'social-emotional'
  | 'physical-education';

export type DifficultyLevel = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';
export type ContentStatus = 'draft' | 'review' | 'published' | 'archived' | 'deprecated';

// Content Update Types
export interface ContentUpdate {
  id: string;
  contentId: string;
  type: UpdateType;
  version: string;
  description: string;
  changes: ContentChange[];
  size: number; // in bytes
  checksum: string;
  isRequired: boolean;
  priority: UpdatePriority;
  scheduledAt?: Date;
  appliedAt?: Date;
  rollbackVersion?: string;
  status: UpdateStatus;
}

export type UpdateType = 'feature' | 'bugfix' | 'content' | 'localization' | 'security' | 'performance';
export type UpdatePriority = 'low' | 'medium' | 'high' | 'critical';
export type UpdateStatus = 'pending' | 'downloading' | 'installing' | 'completed' | 'failed' | 'rolled-back';

export interface ContentChange {
  type: 'add' | 'modify' | 'remove';
  path: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
}

// Content Validation Types
export interface ContentValidation {
  id: string;
  contentId: string;
  timestamp: Date;
  validator: string;
  checks: ValidationCheck[];
  overallScore: number; // 0-100
  status: ValidationStatus;
  recommendations: string[];
  issues: ValidationIssue[];
}

export type ValidationStatus = 'passed' | 'warning' | 'failed' | 'pending';

export interface ValidationCheck {
  name: string;
  description: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface ValidationIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  location?: string;
  suggestion?: string;
}

// Content Distribution Types
export interface ContentDistribution {
  id: string;
  contentId: string;
  strategy: DistributionStrategy;
  cdnEndpoints: string[];
  geographicOptimization: GeoOptimization;
  compressionSettings: CompressionSettings;
  cachingStrategy: CachingStrategy;
  performanceMetrics: DistributionMetrics;
  failoverConfig: FailoverConfig;
}

export type DistributionStrategy = 'cdn' | 'p2p' | 'hybrid' | 'direct';
export type GeoOptimization = 'enabled' | 'disabled' | 'regional';

export interface CompressionSettings {
  enabled: boolean;
  algorithm: 'gzip' | 'brotli' | 'zstd';
  level: number;
  threshold: number; // in bytes
}

export interface CachingStrategy {
  client: CacheConfig;
  server: CacheConfig;
  cdn: CacheConfig;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // in seconds
  maxSize: number; // in bytes
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
}

export interface DistributionMetrics {
  deliveryTime: number; // in milliseconds
  successRate: number; // 0-1
  errorRate: number; // 0-1
  bandwidthUsage: number; // in bytes
  cacheHitRate: number; // 0-1
  geographicDistribution: {
    [region: string]: number;
  };
}

export interface FailoverConfig {
  enabled: boolean;
  backupEndpoints: string[];
  healthCheckInterval: number; // in seconds
  maxRetries: number;
  retryDelay: number; // in milliseconds
}

// Content Analytics Types
export interface ContentAnalytics {
  id: string;
  contentId: string;
  timestamp: Date;
  period: AnalyticsPeriod;
  metrics: AnalyticsMetrics;
  engagement: EngagementMetrics;
  performance: PerformanceMetrics;
  userFeedback: UserFeedback;
  trends: TrendData[];
}

export type AnalyticsPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface AnalyticsMetrics {
  views: number;
  uniqueViews: number;
  completions: number;
  averageTimeSpent: number; // in seconds
  dropoffRate: number; // 0-1
  retentionRate: number; // 0-1
  shares: number;
  downloads: number;
}

export interface EngagementMetrics {
  clickThroughRate: number; // 0-1
  interactionRate: number; // 0-1
  completionRate: number; // 0-1
  replayRate: number; // 0-1
  favoriteCount: number;
  bookmarkCount: number;
  commentCount: number;
  ratingCount: number;
}

export interface PerformanceMetrics {
  loadTime: number; // in milliseconds
  errorRate: number; // 0-1
  crashRate: number; // 0-1
  batteryImpact: number; // 0-1
  memoryUsage: number; // in bytes
  networkUsage: number; // in bytes
  responsiveness: number; // 0-1
}

export interface UserFeedback {
  averageRating: number;
  ratingDistribution: {
    [key: number]: number;
  };
  sentimentScore: number; // -1 to 1
  commonIssues: string[];
  featureRequests: string[];
  satisfactionScore: number; // 0-1
}

export interface TrendData {
  metric: string;
  period: AnalyticsPeriod;
  data: {
    timestamp: Date;
    value: number;
  }[];
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  changeRate: number; // percentage
}

// Content Moderation Types
export interface ContentModeration {
  id: string;
  contentId: string;
  moderator: string;
  timestamp: Date;
  status: ModerationStatus;
  checks: ModerationCheck[];
  score: SafetyScore;
  action: ModerationAction;
  notes?: string;
}

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged' | 'under-review';
export type ModerationAction = 'none' | 'approve' | 'reject' | 'edit' | 'escalate' | 'quarantine';

export interface ModerationCheck {
  type: ModerationCheckType;
  passed: boolean;
  score: number;
  details: string;
  flaggedContent?: string[];
}

export type ModerationCheckType =
  | 'inappropriate-content'
  | 'age-appropriateness'
  | 'safety'
  | 'educational-value'
  | 'quality'
  | 'bias-detection'
  | 'copyright'
  | 'accessibility';

export interface SafetyScore {
  overall: number; // 0-100
  categories: {
    [key: string]: number;
  };
  riskLevel: RiskLevel;
  recommendations: string[];
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Content Versioning Types
export interface ContentVersion {
  id: string;
  contentId: string;
  version: string;
  previousVersion?: string;
  changes: VersionChange[];
  metadata: ContentMetadata;
  validation?: ContentValidation;
  size: number; // in bytes
  checksum: string;
  isStable: boolean;
  isDeprecated: boolean;
  releaseNotes?: string;
  compatibility: {
    minAppVersion: string;
    maxAppVersion: string;
  };
}

export interface VersionChange {
  type: 'added' | 'modified' | 'removed' | 'fixed';
  component: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  files?: string[];
}

// Content Performance Types
export interface ContentPerformance {
  id: string;
  contentId: string;
  timestamp: Date;
  metrics: PerformanceMetrics;
  optimization: OptimizationData;
  benchmarks: BenchmarkData;
  recommendations: PerformanceRecommendation[];
}

export interface OptimizationData {
  loadTimeOptimization: number; // percentage
  sizeReduction: number; // percentage
  cacheEfficiency: number; // 0-1
  bandwidthEfficiency: number; // 0-1
  cpuOptimization: number; // percentage
  memoryOptimization: number; // percentage
}

export interface BenchmarkData {
  category: string;
  metric: string;
  value: number;
  target: number;
  unit: string;
  comparison: 'above' | 'below' | 'at' | 'exceeds';
}

export interface PerformanceRecommendation {
  type: 'load' | 'size' | 'cache' | 'network' | 'render' | 'memory';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  estimatedImprovement: number; // percentage
  implementation: string;
}

// Content Search and Filtering Types
export interface ContentSearchOptions {
  query?: string;
  categories?: ContentCategory[];
  ageRange?: AgeRange;
  difficulty?: DifficultyLevel;
  tags?: string[];
  sortBy?: SearchSortOption;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  filters?: SearchFilter[];
}

export type SearchSortOption =
  | 'relevance'
  | 'popularity'
  | 'rating'
  | 'date'
  | 'title'
  | 'duration'
  | 'downloads';

export interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
  value: any;
}

export interface ContentSearchResult {
  items: ContentMetadata[];
  total: number;
  page: number;
  pageSize: number;
  facets: SearchFacet[];
  suggestions: string[];
}

export interface SearchFacet {
  field: string;
  label: string;
  options: FacetOption[];
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  selected: boolean;
}

// Content Personalization Types
export interface ContentPersonalization {
  userId: string;
  preferences: UserPreferences;
  learningPath: LearningPath;
  recommendations: ContentRecommendation[];
  adaptiveContent: AdaptiveContentSettings;
}

export interface UserPreferences {
  favoriteCategories: ContentCategory[];
  preferredDifficulty: DifficultyLevel;
  interests: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  sessionDuration: number; // in minutes
  contentLanguage: string;
  accessibility: AccessibilitySettings;
}

export interface AccessibilitySettings {
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  highContrast: boolean;
  screenReader: boolean;
  subtitles: boolean;
  simplifiedInterface: boolean;
  reducedMotion: boolean;
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  levels: LearningLevel[];
  progress: number; // 0-1
  estimatedCompletion: Date;
}

export interface LearningLevel {
  id: string;
  name: string;
  description: string;
  contentIds: string[];
  prerequisites?: string[];
  isCompleted: boolean;
  progress: number; // 0-1
  timeSpent: number; // in minutes
}

export interface ContentRecommendation {
  contentId: string;
  reason: string;
  confidence: number; // 0-1
  personalizedScore: number; // 0-1
  category: string;
  tags: string[];
}

export interface AdaptiveContentSettings {
  enabled: boolean;
  difficultyAdjustment: boolean;
  pacingAdjustment: boolean;
  contentVariation: boolean;
  feedbackStyle: 'encouraging' | 'instructional' | 'neutral';
}

// Content Backup and Recovery Types
export interface ContentBackup {
  id: string;
  timestamp: Date;
  type: BackupType;
  scope: BackupScope;
  size: number; // in bytes
  checksum: string;
  location: string;
  compressionRatio: number;
  encryption: boolean;
  verification: BackupVerification;
  retention: BackupRetention;
}

export type BackupType = 'full' | 'incremental' | 'differential';
export type BackupScope = 'content' | 'metadata' | 'analytics' | 'settings' | 'all';

export interface BackupVerification {
  status: 'success' | 'failed' | 'pending';
  errors: string[];
  warnings: string[];
  integrityCheck: boolean;
}

export interface BackupRetention {
  policy: RetentionPolicy;
  maxBackups: number;
  retentionPeriod: number; // in days
  autoDelete: boolean;
}

export type RetentionPolicy = 'keep-all' | 'keep-latest' | 'keep-period' | 'smart';

// Content A/B Testing Types
export interface ContentABTest {
  id: string;
  name: string;
  description: string;
  status: ABTestStatus;
  variants: ABTestVariant[];
  metrics: ABTestMetric[];
  startDate: Date;
  endDate?: Date;
  targetAudience: ABTestAudience;
  results?: ABTestResults;
}

export type ABTestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type ABTestVariantType = 'A' | 'B' | 'C' | 'D';

export interface ABTestVariant {
  id: string;
  name: string;
  type: ABTestVariantType;
  contentId: string;
  description: string;
  changes: string[];
  trafficAllocation: number; // percentage
  isControl: boolean;
}

export interface ABTestMetric {
  name: string;
  type: 'engagement' | 'completion' | 'satisfaction' | 'performance';
  target: number;
  unit: string;
}

export interface ABTestAudience {
  size: number; // percentage
  criteria: AudienceCriteria[];
  segment?: string;
}

export interface AudienceCriteria {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
  value: any;
}

export interface ABTestResults {
  winner?: ABTestVariantType;
  confidence: number; // 0-1
  significance: number; // 0-1
  variantResults: {
    [key in ABTestVariantType]: ABTestVariantResult;
  };
  insights: string[];
  recommendations: string[];
}

export interface ABTestVariantResult {
  participants: number;
  metrics: {
    [metricName: string]: {
      value: number;
      change: number; // percentage
      confidence: number; // 0-1
    };
  };
  conversionRate: number; // 0-1
  improvement: number; // percentage
}

// Error Types
export interface ContentError extends Error {
  code: string;
  type: 'validation' | 'download' | 'installation' | 'moderation' | 'performance' | 'general';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  timestamp: Date;
  context?: any;
}

// Event Types
export interface ContentEvent {
  id: string;
  type: ContentEventType;
  timestamp: Date;
  userId?: string;
  contentId: string;
  sessionId: string;
  data: any;
  metadata?: any;
}

export type ContentEventType =
  | 'view'
  | 'start'
  | 'complete'
  | 'pause'
  | 'resume'
  | 'rate'
  | 'favorite'
  | 'share'
  | 'download'
  | 'error'
  | 'search'
  | 'filter'
  | 'recommendation'
  | 'ab-test-impression'
  | 'ab-test-conversion';

// Export all types
export * from './content';