/**
 * Error type definitions for the kid-friendly-ai project
 * Provides comprehensive error classification and handling infrastructure
 */

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Error categories
export enum ErrorCategory {
  NETWORK = 'network',
  API = 'api',
  UI = 'ui',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATABASE = 'database',
  FILE_SYSTEM = 'file_system',
  MEMORY = 'memory',
  PERFORMANCE = 'performance',
  AUDIO = 'audio',
  SPEECH = 'speech',
  GAME = 'game',
  PARENTAL_CONTROLS = 'parental_controls',
  UNKNOWN = 'unknown'
}

// Error recovery strategies
export enum ErrorRecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  SKIP = 'skip',
  LOG_ONLY = 'log_only',
  NOTIFY_USER = 'notify_user',
  NOTIFY_PARENT = 'notify_parent',
  RESTART_COMPONENT = 'restart_component',
  RELOAD_PAGE = 'reload_page',
  CLEAR_CACHE = 'clear_cache',
  RESET_STATE = 'reset_state'
}

// Error classification
export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  userVisible: boolean;
  retryable: boolean;
  recoveryStrategies: ErrorRecoveryStrategy[];
  timeout?: number;
  maxRetries?: number;
}

// Error context
export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  timestamp: number;
  userAgent?: string;
  url?: string;
  additionalData?: Record<string, any>;
  userInteraction?: {
    type: string;
    target: string;
    timestamp: number;
  };
}

// Base error interface
export interface AppError extends Error {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly context?: ErrorContext;
  readonly recoveryStrategies: ErrorRecoveryStrategy[];
  readonly originalError?: Error;
  readonly timestamp: number;
  readonly id: string;
}

// Network error
export interface NetworkError extends AppError {
  readonly category: ErrorCategory.NETWORK;
  readonly statusCode?: number;
  readonly url?: string;
  readonly method?: string;
  readonly timeout?: boolean;
}

// API error
export interface ApiError extends AppError {
  readonly category: ErrorCategory.API;
  readonly endpoint?: string;
  readonly statusCode?: number;
  readonly response?: any;
}

// UI error
export interface UIError extends AppError {
  readonly category: ErrorCategory.UI;
  readonly component?: string;
  readonly element?: string;
  readonly eventType?: string;
}

// Validation error
export interface ValidationError extends AppError {
  readonly category: ErrorCategory.VALIDATION;
  readonly field?: string;
  readonly value?: any;
  readonly validationRule?: string;
}

// Game error
export interface GameError extends AppError {
  readonly category: ErrorCategory.GAME;
  readonly gameType?: string;
  readonly level?: number;
  readonly gameState?: any;
}

// Audio error
export interface AudioError extends AppError {
  readonly category: ErrorCategory.AUDIO;
  readonly audioType?: string;
  readonly duration?: number;
  readonly format?: string;
}

// Speech error
export interface SpeechError extends AppError {
  readonly category: ErrorCategory.SPEECH;
  readonly speechType?: 'recognition' | 'synthesis';
  readonly language?: string;
  readonly confidence?: number;
}

// Error boundary configuration
export interface ErrorBoundaryConfig {
  fallbackComponent?: React.ComponentType<{ error: AppError; retry: () => void }>;
  onError?: (error: AppError, errorInfo: React.ErrorInfo) => void;
  retryCount?: number;
  resetTimeout?: number;
  logErrors?: boolean;
  notifyParents?: boolean;
  severityThreshold?: ErrorSeverity;
}

// Error logging configuration
export interface ErrorLoggingConfig {
  enabled: boolean;
  level: ErrorSeverity;
  maxLogSize: number;
  logToConsole: boolean;
  logToServer: boolean;
  serverEndpoint?: string;
  includeStackTrace: boolean;
  includeContext: boolean;
  samplingRate: number;
}

// Error analytics configuration
export interface ErrorAnalyticsConfig {
  enabled: boolean;
  trackFrequency: boolean;
  trackPatterns: boolean;
  trackUserImpact: boolean;
  trackRecoverySuccess: boolean;
  aggregationInterval: number;
  maxStoredErrors: number;
}

// Error recovery configuration
export interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  timeout: number;
  enableAutomaticRecovery: boolean;
  enableUserInitiatedRecovery: boolean;
  recoveryStrategies: Partial<Record<ErrorCategory, ErrorRecoveryStrategy[]>>;
}

// Error display configuration
export interface ErrorDisplayConfig {
  showToUser: boolean;
  animate: boolean;
  soundEffects: boolean;
  accessibilityMode: boolean;
  language: string;
  ageGroup: '3-5' | '6-8' | '9-12';
  parentalNotification: boolean;
  helpOptions: boolean;
}

// Error metrics
export interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
  userImpactScore: number;
  systemHealthScore: number;
  lastErrorTime: number;
  errorFrequency: number;
}

// Error event
export interface ErrorEvent {
  id: string;
  error: AppError;
  context: ErrorContext;
  recoveryAttempt?: {
    strategy: ErrorRecoveryStrategy;
    success: boolean;
    duration: number;
  };
  userAction?: {
    type: string;
    timestamp: number;
  };
}

// Error report
export interface ErrorReport {
  id: string;
  timestamp: number;
  error: AppError;
  context: ErrorContext;
  stackTrace?: string;
  userSession: {
    id: string;
    duration: number;
    interactions: number;
  };
  systemInfo: {
    userAgent: string;
    url: string;
    memory?: any;
    connectivity?: string;
  };
  recovery: {
    attempted: boolean;
    strategy?: ErrorRecoveryStrategy;
    successful: boolean;
    duration: number;
  };
}

// Error statistics
export interface ErrorStatistics {
  period: {
    start: number;
    end: number;
  };
  totalErrors: number;
  uniqueErrors: number;
  errorRate: number;
  topErrors: Array<{
    error: AppError;
    count: number;
    percentage: number;
  }>;
  categoryDistribution: Record<ErrorCategory, number>;
  severityDistribution: Record<ErrorSeverity, number>;
  recoveryStats: {
    totalAttempts: number;
    successfulRecoveries: number;
    averageRecoveryTime: number;
    successRate: number;
  };
  userImpact: {
    affectedUsers: number;
    averageErrorsPerUser: number;
    userSatisfactionImpact: number;
  };
}