/**
 * Offline functionality type definitions for the kid-friendly-ai project
 * Provides comprehensive type safety for all offline operations
 */

// Base types for offline functionality
export interface OfflineOperation {
  id: string;
  type: OperationType;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: OperationPriority;
  data: any;
  status: OperationStatus;
  metadata?: Record<string, any>;
}

export enum OperationType {
  CONVERSATION_SAVE = 'conversation_save',
  SETTINGS_UPDATE = 'settings_update',
  GAME_PROGRESS = 'game_progress',
  STICKER_EARNED = 'sticker_earned',
  ACHIEVEMENT_UNLOCK = 'achievement_unlock',
  USER_PREFERENCE = 'user_preference',
  SYNC_REQUIRED = 'sync_required',
  CACHE_UPDATE = 'cache_update'
}

export enum OperationPriority {
  CRITICAL = 1,      // Must execute immediately
  HIGH = 2,         // Execute as soon as possible
  NORMAL = 3,       // Normal priority
  LOW = 4,          // Can wait
  BACKGROUND = 5   // Background tasks only
}

export enum OperationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled'
}

// Offline state management
export interface OfflineState {
  isOnline: boolean;
  isOffline: boolean;
  connectionQuality: ConnectionQuality;
  lastSyncTime: number | null;
  pendingOperations: number;
  failedOperations: number;
  isSyncing: boolean;
  syncProgress: number;
  networkInfo: NetworkInfo;
  storageInfo: StorageInfo;
}

export enum ConnectionQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  OFFLINE = 'offline'
}

export interface NetworkInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  type?: string;
}

export interface StorageInfo {
  used: number;
  total: number;
  available: number;
  quota: number;
  usage: number;
}

// Storage configuration types
export interface StorageConfig {
  indexedDB: {
    dbName: string;
    version: number;
    stores: Record<string, ObjectStoreConfig>;
  };
  localStorage: {
    prefix: string;
    maxItems: number;
  };
  cache: {
    maxAge: number;
    maxSize: number;
    strategy: CacheStrategy;
  };
}

export interface ObjectStoreConfig {
  keyPath: string;
  autoIncrement: boolean;
  indexes: Record<string, IndexConfig>;
}

export interface IndexConfig {
  keyPath: string;
  unique: boolean;
  multiEntry: boolean;
}

export enum CacheStrategy {
  CACHE_FIRST = 'cache_first',
  NETWORK_FIRST = 'network_first',
  STALE_WHILE_REVALIDATE = 'stale_while_revalidate',
  CACHE_ONLY = 'cache_only',
  NETWORK_ONLY = 'network_only'
}

// Synchronization types
export interface SyncConfig {
  autoSync: boolean;
  syncInterval: number;
  batchSize: number;
  retryDelay: number;
  maxRetries: number;
  conflictResolution: ConflictResolutionStrategy;
  backgroundSync: boolean;
}

export enum ConflictResolutionStrategy {
  CLIENT_WINS = 'client_wins',
  SERVER_WINS = 'server_wins',
  TIMESTAMP_WINS = 'timestamp_wins',
  MANUAL_RESOLUTION = 'manual_resolution',
  MERGE = 'merge'
}

export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  conflicts: Conflict[];
  duration: number;
  timestamp: number;
}

export interface Conflict {
  id: string;
  type: string;
  localData: any;
  serverData: any;
  resolution?: ConflictResolution;
  timestamp: number;
}

export interface ConflictResolution {
  strategy: ConflictResolutionStrategy;
  resolvedData: any;
  timestamp: number;
}

// Queue management types
export interface QueueConfig {
  maxSize: number;
  processingDelay: number;
  retryBackoff: RetryBackoffConfig;
  persistence: boolean;
  compression: boolean;
}

export interface RetryBackoffConfig {
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
  jitter: boolean;
}

export interface QueueStats {
  totalOperations: number;
  pendingOperations: number;
  processingOperations: number;
  completedOperations: number;
  failedOperations: number;
  averageProcessingTime: number;
  oldestOperation: number | null;
}

// Cache management types
export interface CacheConfig {
  defaultStrategy: CacheStrategy;
  maxSize: number;
  maxAge: number;
  compression: boolean;
  versioning: boolean;
  prefetching: PrefetchConfig;
}

export interface PrefetchConfig {
  enabled: boolean;
  strategy: PrefetchStrategy;
  maxConcurrent: number;
  conditions: PrefetchCondition[];
}

export enum PrefetchStrategy {
  AGGRESSIVE = 'aggressive',
  CONSERVATIVE = 'conservative',
  ADAPTIVE = 'adaptive'
}

export interface PrefetchCondition {
  type: 'network' | 'storage' | 'user_behavior';
  condition: string;
  value: any;
}

// Offline event types
export interface OfflineEvent {
  type: OfflineEventType;
  timestamp: number;
  data?: any;
  source: 'system' | 'user' | 'network' | 'storage';
}

export enum OfflineEventType {
  OFFLINE_DETECTED = 'offline_detected',
  ONLINE_DETECTED = 'online_detected',
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  OPERATION_QUEUED = 'operation_queued',
  OPERATION_COMPLETED = 'operation_completed',
  OPERATION_FAILED = 'operation_failed',
  CONFLICT_DETECTED = 'conflict_detected',
  CONFLICT_RESOLVED = 'conflict_resolved',
  STORAGE_QUOTA_EXCEEDED = 'storage_quota_exceeded',
  NETWORK_QUALITY_CHANGED = 'network_quality_changed'
}

// Service worker communication types
export interface ServiceWorkerMessage {
  type: ServiceWorkerMessageType;
  data?: any;
  timestamp: number;
}

export enum ServiceWorkerMessageType {
  SYNC_REQUEST = 'sync_request',
  SYNC_RESPONSE = 'sync_response',
  CACHE_UPDATE = 'cache_update',
  QUEUE_PROCESS = 'queue_process',
  OFFLINE_STATUS = 'offline_status',
  NETWORK_INFO = 'network_info'
}

// Data encryption types
export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyRotationInterval: number;
  sensitiveDataOnly: boolean;
}

// Performance monitoring types
export interface OfflineMetrics {
  syncOperations: number;
  syncDuration: number;
  cacheHitRate: number;
  queueProcessingTime: number;
  storageUsage: number;
  networkRequests: number;
  offlineTime: number;
}

// Configuration types
export interface OfflineConfig {
  enabled: boolean;
  storage: StorageConfig;
  sync: SyncConfig;
  queue: QueueConfig;
  cache: CacheConfig;
  encryption: EncryptionConfig;
  events: {
    enabled: boolean;
    maxHistory: number;
  };
  monitoring: {
    enabled: boolean;
    interval: number;
  };
}

// Hook return types
export interface OfflineManagerHook {
  state: OfflineState;
  isOnline: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  syncProgress: number;
  pendingOperations: number;
  connectionQuality: ConnectionQuality;

  // Actions
  syncNow: () => Promise<SyncResult>;
  clearQueue: () => Promise<void>;
  retryFailed: () => Promise<void>;
  clearCache: () => Promise<void>;
  getStats: () => Promise<QueueStats>;

  // Event handlers
  onOfflineChange: (callback: (isOffline: boolean) => void) => () => void;
  onSyncProgress: (callback: (progress: number) => void) => () => void;
  onOperationComplete: (callback: (operation: OfflineOperation) => void) => () => void;
}

// Component props
export interface OfflineIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showSyncButton?: boolean;
  showStats?: boolean;
  compact?: boolean;
  className?: string;
  onSync?: () => Promise<void>;
  onSettings?: () => void;
}

// Utility types
export type OfflineOperationHandler = (operation: OfflineOperation) => Promise<boolean>;
export type ConflictResolver = (conflict: Conflict) => Promise<ConflictResolution>;
export type CacheValidator = (data: any, metadata: any) => boolean;
export type NetworkConditionChecker = () => boolean;

// Error types
export interface OfflineError extends Error {
  type: OfflineErrorType;
  operation?: OfflineOperation;
  recoverable: boolean;
  details?: Record<string, any>;
}

export enum OfflineErrorType {
  STORAGE_ERROR = 'storage_error',
  NETWORK_ERROR = 'network_error',
  SYNC_ERROR = 'sync_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  CONFLICT_ERROR = 'conflict_error',
  QUEUE_ERROR = 'queue_error',
  CACHE_ERROR = 'cache_error',
  ENCRYPTION_ERROR = 'encryption_error'
}