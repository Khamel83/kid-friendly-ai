/**
 * Centralized offline management for the kid-friendly-ai project
 * Provides unified interface for all offline functionality with monitoring and analytics
 */

import type {
  OfflineConfig,
  OfflineState,
  ConnectionQuality,
  OfflineEvent,
  OfflineEventType,
  SyncResult,
  QueueStats,
  OfflineOperation,
  OfflineError,
  OfflineErrorType,
  NetworkInfo,
  StorageInfo
} from '../types/offline';
import { getOfflineStorage } from './offlineStorage';
import { getOfflineQueue } from './offlineQueue';
import { getOfflineCache } from './offlineCache';
import { getSyncManager } from './syncManager';

interface OfflineManagerOptions {
  autoInitialize?: boolean;
  enableMonitoring?: boolean;
  enableAnalytics?: boolean;
  eventHistoryLimit?: number;
}

interface MonitoringMetrics {
  uptime: number;
  offlineTime: number;
  syncOperations: number;
  cacheHits: number;
  cacheMisses: number;
  failedOperations: number;
  averageResponseTime: number;
  lastMetricsReset: number;
}

class OfflineManager {
  private config: OfflineConfig;
  private storage: ReturnType<typeof getOfflineStorage>;
  private queue: ReturnType<typeof getOfflineQueue>;
  private cache: ReturnType<typeof getOfflineCache>;
  private syncManager: ReturnType<typeof getSyncManager>;

  // State management
  private state: OfflineState;
  private isInitialized = false;
  private isMonitoring = false;

  // Event handling
  private eventListeners: Map<string, Function[]> = new Map();
  private eventHistory: OfflineEvent[] = [];

  // Monitoring
  private metrics: MonitoringMetrics;
  private monitoringInterval: number | null = null;
  private networkCheckInterval: number | null = null;

  // Options
  private options: OfflineManagerOptions;

  constructor(config: OfflineConfig, options: OfflineManagerOptions = {}) {
    this.config = config;
    this.options = {
      autoInitialize: true,
      enableMonitoring: true,
      enableAnalytics: true,
      eventHistoryLimit: 100,
      ...options
    };

    this.state = this._initializeState();
    this.metrics = this._initializeMetrics();

    // Initialize components
    this.storage = getOfflineStorage(config.storage, config.encryption);
    this.queue = getOfflineQueue(config.queue);
    this.cache = getOfflineCache(config.cache);
    this.syncManager = getSyncManager(config.sync);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing offline manager...');

      // Initialize all components
      await Promise.all([
        this.storage.initialize(),
        this.queue.initialize(),
        this.cache.initialize(),
        this.syncManager.initialize()
      ]);

      // Set up network monitoring
      this._setupNetworkMonitoring();

      // Set up event listeners
      this._setupEventListeners();

      // Start monitoring if enabled
      if (this.options.enableMonitoring) {
        this.startMonitoring();
      }

      // Set up service worker communication
      await this._setupServiceWorkerCommunication();

      this.isInitialized = true;
      this._emitEvent({
        type: OfflineEventType.OFFLINE_DETECTED,
        timestamp: Date.now(),
        source: 'system',
        data: { initialized: true }
      });

      console.log('Offline manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline manager:', error);
      throw this._createError(OfflineErrorType.STORAGE_ERROR, 'Offline manager initialization failed', error);
    }
  }

  // State management
  getState(): OfflineState {
    return { ...this.state };
  }

  async updateState(updates: Partial<OfflineState>): Promise<void> {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...updates };

    // Detect state changes
    if (previousState.isOnline !== this.state.isOnline) {
      this._emitEvent({
        type: this.state.isOnline ? OfflineEventType.ONLINE_DETECTED : OfflineEventType.OFFLINE_DETECTED,
        timestamp: Date.now(),
        source: 'system',
        data: { previousState, currentState: this.state }
      });
    }

    // Persist state changes
    await this.storage.setLocal('offlineState', this.state);
  }

  // Queue operations
  async queueOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    this._ensureInitialized();

    try {
      const operationId = await this.queue.add(operation);
      await this.updateState({
        pendingOperations: (await this.queue.getStats()).pendingOperations
      });

      this._emitEvent({
        type: OfflineEventType.OPERATION_QUEUED,
        timestamp: Date.now(),
        source: 'user',
        data: { operationId, type: operation.type }
      });

      return operationId;
    } catch (error) {
      throw this._createError(OfflineErrorType.QUEUE_ERROR, 'Failed to queue operation', error);
    }
  }

  async getQueueStats(): Promise<QueueStats> {
    this._ensureInitialized();
    return await this.queue.getStats();
  }

  async clearQueue(): Promise<void> {
    this._ensureInitialized();
    await this.queue.clear();
    await this.updateState({ pendingOperations: 0 });
  }

  // Sync operations
  async syncNow(options: { force?: boolean; types?: string[] } = {}): Promise<SyncResult> {
    this._ensureInitialized();

    try {
      await this.updateState({ isSyncing: true, syncProgress: 0 });

      this._emitEvent({
        type: OfflineEventType.SYNC_STARTED,
        timestamp: Date.now(),
        source: 'user',
        data: { options }
      });

      const result = await this.syncManager.syncNow(options);

      await this.updateState({
        isSyncing: false,
        syncProgress: 100,
        lastSyncTime: Date.now(),
        pendingOperations: (await this.queue.getStats()).pendingOperations
      });

      this._emitEvent({
        type: result.success ? OfflineEventType.SYNC_COMPLETED : OfflineEventType.SYNC_FAILED,
        timestamp: Date.now(),
        source: 'system',
        data: { result }
      });

      this._updateMetrics({
        syncOperations: this.metrics.syncOperations + result.syncedItems,
        failedOperations: this.metrics.failedOperations + result.failedItems
      });

      return result;
    } catch (error) {
      await this.updateState({ isSyncing: false });

      this._emitEvent({
        type: OfflineEventType.SYNC_FAILED,
        timestamp: Date.now(),
        source: 'system',
        data: { error }
      });

      throw this._createError(OfflineErrorType.SYNC_ERROR, 'Synchronization failed', error);
    }
  }

  // Cache operations
  async cacheSet<T>(key: string, value: T, options?: any): Promise<void> {
    this._ensureInitialized();
    return await this.cache.set(key, value, options);
  }

  async cacheGet<T>(key: string, options?: any): Promise<T | null> {
    this._ensureInitialized();
    return await this.cache.get(key, options);
  }

  async cacheRemove(key: string): Promise<void> {
    this._ensureInitialized();
    return await this.cache.remove(key);
  }

  async cacheClear(): Promise<void> {
    this._ensureInitialized();
    return await this.cache.clear();
  }

  // Storage operations
  async getStorageInfo(): Promise<StorageInfo> {
    this._ensureInitialized();
    const info = await this.storage.getStorageInfo();
    await this.updateState({ storageInfo: info });
    return info;
  }

  async createBackup(): Promise<string> {
    this._ensureInitialized();
    return await this.storage.backup();
  }

  async restoreBackup(backupData: string): Promise<void> {
    this._ensureInitialized();
    return await this.storage.restore(backupData);
  }

  // Conflict resolution
  async resolveConflicts(): Promise<void> {
    this._ensureInitialized();

    const conflicts = await this.syncManager.getConflicts();
    for (const conflict of conflicts) {
      await this.syncManager.resolveConflict(conflict);
    }

    this._emitEvent({
      type: OfflineEventType.CONFLICT_RESOLVED,
      timestamp: Date.now(),
      source: 'system',
      data: { resolvedConflicts: conflicts.length }
    });
  }

  // Monitoring and analytics
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = window.setInterval(
      () => this._updateMetrics(),
      30000 // Update every 30 seconds
    ) as unknown as number;

    console.log('Offline monitoring started');
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Offline monitoring stopped');
  }

  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  async getAnalytics(): Promise<{
    uptime: number;
    offlineTime: number;
    syncEfficiency: number;
    cacheHitRate: number;
    averageResponseTime: number;
    reliability: number;
  }> {
    const cacheStats = await this.cache.getStats();
    const queueStats = await this.queue.getStats();

    return {
      uptime: this.metrics.uptime,
      offlineTime: this.metrics.offlineTime,
      syncEfficiency: this.metrics.syncOperations / Math.max(1, this.metrics.failedOperations),
      cacheHitRate: cacheStats.hitRate,
      averageResponseTime: this.metrics.averageResponseTime,
      reliability: queueStats.completedOperations / Math.max(1, queueStats.totalOperations)
    };
  }

  // Event handling
  on(event: OfflineEventType, callback: (event: OfflineEvent) => void): () => void {
    const eventType = event;
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }

    const listeners = this.eventListeners.get(eventType)!;
    listeners.push(callback);

    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  getEventHistory(): OfflineEvent[] {
    return [...this.eventHistory];
  }

  clearEventHistory(): void {
    this.eventHistory = [];
  }

  // Diagnostics
  async getDiagnostics(): Promise<{
    initialized: boolean;
    state: OfflineState;
    metrics: MonitoringMetrics;
    storageInfo: StorageInfo;
    queueStats: QueueStats;
    conflicts: any[];
    lastEvents: OfflineEvent[];
  }> {
    return {
      initialized: this.isInitialized,
      state: this.state,
      metrics: this.metrics,
      storageInfo: await this.getStorageInfo(),
      queueStats: await this.getQueueStats(),
      conflicts: await this.syncManager.getConflicts(),
      lastEvents: this.eventHistory.slice(-10)
    };
  }

  async runDiagnostics(): Promise<{
    storage: boolean;
    queue: boolean;
    cache: boolean;
    sync: boolean;
    network: boolean;
    overall: boolean;
  }> {
    const results = {
      storage: false,
      queue: false,
      cache: false,
      sync: false,
      network: false,
      overall: false
    };

    try {
      // Test storage
      await this.storage.setLocal('diagnostic_test', { timestamp: Date.now() });
      const testValue = await this.storage.getLocal('diagnostic_test');
      results.storage = !!testValue;
      await this.storage.removeLocal('diagnostic_test');

      // Test queue
      const queueStats = await this.queue.getStats();
      results.queue = true;

      // Test cache
      await this.cache.set('diagnostic_test', { test: true });
      const cachedValue = await this.cache.get('diagnostic_test');
      results.cache = !!cachedValue;
      await this.cache.remove('diagnostic_test');

      // Test sync
      const syncStatus = await this.syncManager.getStatus();
      results.sync = true;

      // Test network
      results.network = navigator.onLine;

      results.overall = Object.values(results).every(result => result === true);
    } catch (error) {
      console.error('Diagnostics failed:', error);
    }

    return results;
  }

  // Private helper methods
  private _ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Offline manager not initialized. Call initialize() first.');
    }
  }

  private _initializeState(): OfflineState {
    return {
      isOnline: navigator.onLine,
      isOffline: !navigator.onLine,
      connectionQuality: this._getConnectionQuality(),
      lastSyncTime: null,
      pendingOperations: 0,
      failedOperations: 0,
      isSyncing: false,
      syncProgress: 0,
      networkInfo: this._getNetworkInfo(),
      storageInfo: {
        used: 0,
        total: 0,
        available: 0,
        quota: 0,
        usage: 0
      }
    };
  }

  private _initializeMetrics(): MonitoringMetrics {
    return {
      uptime: 0,
      offlineTime: 0,
      syncOperations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      lastMetricsReset: Date.now()
    };
  }

  private _setupNetworkMonitoring(): void {
    // Online/offline event listeners
    window.addEventListener('online', () => this._handleOnline());
    window.addEventListener('offline', () => this._handleOffline());

    // Network information API if available
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      conn.addEventListener('change', () => this._handleNetworkChange());
    }

    // Periodic network check
    this.networkCheckInterval = window.setInterval(
      () => this._checkNetworkStatus(),
      10000 // Check every 10 seconds
    ) as unknown as number;
  }

  private _setupEventListeners(): void {
    // Queue events
    this.queue.on('operation_completed', (operation: OfflineOperation) => {
      this._emitEvent({
        type: OfflineEventType.OPERATION_COMPLETED,
        timestamp: Date.now(),
        source: 'system',
        data: { operation }
      });
    });

    this.queue.on('operation_failed', (data: any) => {
      this._emitEvent({
        type: OfflineEventType.OPERATION_FAILED,
        timestamp: Date.now(),
        source: 'system',
        data
      });
    });

    // Cache events could be added here
  }

  private async _setupServiceWorkerCommunication(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this._handleServiceWorkerMessage(event.data);
        });

        // Send initial state to service worker
        registration.active?.postMessage({
          type: 'offline_status',
          data: this.state,
          timestamp: Date.now()
        });
      } catch (error) {
        console.warn('Failed to setup service worker communication:', error);
      }
    }
  }

  private _handleOnline(): void {
    this.updateState({
      isOnline: true,
      isOffline: false,
      connectionQuality: this._getConnectionQuality(),
      networkInfo: this._getNetworkInfo()
    });

    // Auto-sync when coming back online
    if (this.config.sync.autoSync) {
      setTimeout(() => this.syncNow(), 2000);
    }
  }

  private _handleOffline(): void {
    this.updateState({
      isOnline: false,
      isOffline: true,
      connectionQuality: ConnectionQuality.OFFLINE,
      networkInfo: this._getNetworkInfo()
    });
  }

  private _handleNetworkChange(): void {
    this.updateState({
      connectionQuality: this._getConnectionQuality(),
      networkInfo: this._getNetworkInfo()
    });

    this._emitEvent({
      type: OfflineEventType.NETWORK_QUALITY_CHANGED,
      timestamp: Date.now(),
      source: 'system',
      data: { connectionQuality: this.state.connectionQuality }
    });
  }

  private _handleServiceWorkerMessage(message: any): void {
    switch (message.type) {
      case 'sync_request':
        this.syncNow({ force: true });
        break;
      case 'cache_update':
        // Handle cache update from service worker
        break;
      default:
        console.log('Received service worker message:', message);
    }
  }

  private async _checkNetworkStatus(): Promise<void> {
    try {
      // Try to fetch a small resource to check connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });

      const wasOnline = this.state.isOnline;
      const isOnline = response.ok;

      if (wasOnline !== isOnline) {
        if (isOnline) {
          this._handleOnline();
        } else {
          this._handleOffline();
        }
      }
    } catch (error) {
      if (this.state.isOnline) {
        this._handleOffline();
      }
    }
  }

  private _getConnectionQuality(): ConnectionQuality {
    if (!navigator.onLine) return ConnectionQuality.OFFLINE;

    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      const effectiveType = conn.effectiveType;

      switch (effectiveType) {
        case '4g': return ConnectionQuality.EXCELLENT;
        case '3g': return ConnectionQuality.GOOD;
        case '2g': return ConnectionQuality.FAIR;
        case 'slow-2g':
        case '2g': return ConnectionQuality.POOR;
        default: return ConnectionQuality.GOOD;
      }
    }

    return ConnectionQuality.GOOD;
  }

  private _getNetworkInfo(): NetworkInfo {
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      return {
        effectiveType: conn.effectiveType || 'unknown',
        downlink: conn.downlink || 0,
        rtt: conn.rtt || 0,
        saveData: conn.saveData || false,
        type: conn.type
      };
    }

    return {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false
    };
  }

  private _emitEvent(event: OfflineEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.options.eventHistoryLimit!) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => callback(event));
    }
  }

  private _updateMetrics(updates: Partial<MonitoringMetrics> = {}): void {
    const now = Date.now();
    const elapsed = now - this.metrics.lastMetricsReset;

    this.metrics = {
      ...this.metrics,
      ...updates,
      uptime: elapsed,
      offlineTime: this.state.isOffline ? this.metrics.offlineTime + (now - this.metrics.lastMetricsReset) : this.metrics.offlineTime,
      lastMetricsReset: now
    };
  }

  private _createError(type: OfflineErrorType, message: string, cause?: any): OfflineError {
    const error = new Error(message) as OfflineError;
    error.type = type;
    error.recoverable = true;
    error.details = { cause };
    return error;
  }

  // Cleanup
  destroy(): void {
    this.stopMonitoring();

    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
      this.networkCheckInterval = null;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Offline manager destroyed');
  }
}

// Export singleton instance
let offlineManagerInstance: OfflineManager | null = null;

export function getOfflineManager(config?: OfflineConfig, options?: OfflineManagerOptions): OfflineManager {
  if (!offlineManagerInstance) {
    const defaultConfig: OfflineConfig = {
      enabled: true,
      storage: {
        indexedDB: {
          dbName: 'kidFriendlyAI_Offline',
          version: 1,
          stores: {
            operations: {
              keyPath: 'id',
              autoIncrement: false,
              indexes: {
                timestamp: { keyPath: 'timestamp', unique: false, multiEntry: false },
                type: { keyPath: 'type', unique: false, multiEntry: false },
                status: { keyPath: 'status', unique: false, multiEntry: false }
              }
            },
            conversations: {
              keyPath: 'id',
              autoIncrement: true,
              indexes: {
                timestamp: { keyPath: 'timestamp', unique: false, multiEntry: false }
              }
            },
            gameProgress: {
              keyPath: 'id',
              autoIncrement: true,
              indexes: {
                gameId: { keyPath: 'gameId', unique: false, multiEntry: false },
                timestamp: { keyPath: 'timestamp', unique: false, multiEntry: false }
              }
            },
            stickers: {
              keyPath: 'id',
              autoIncrement: true,
              indexes: {
                earned: { keyPath: 'earned', unique: false, multiEntry: false }
              }
            },
            cache: {
              keyPath: 'key',
              autoIncrement: false,
              indexes: {
                timestamp: { keyPath: 'timestamp', unique: false, multiEntry: false },
                expiry: { keyPath: 'expiry', unique: false, multiEntry: false }
              }
            }
          }
        },
        localStorage: {
          prefix: 'kidFriendlyAI_',
          maxItems: 1000
        },
        cache: {
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          maxSize: 50 * 1024 * 1024, // 50MB
          strategy: 'cache_first' as any
        }
      },
      sync: {
        autoSync: true,
        syncInterval: 30000, // 30 seconds
        batchSize: 10,
        retryDelay: 5000, // 5 seconds
        maxRetries: 3,
        conflictResolution: 'client_wins' as any,
        backgroundSync: true
      },
      queue: {
        maxSize: 1000,
        processingDelay: 5000, // 5 seconds
        retryBackoff: {
          initialDelay: 1000, // 1 second
          maxDelay: 300000, // 5 minutes
          multiplier: 2,
          jitter: true
        },
        persistence: true,
        compression: true
      },
      cache: {
        defaultStrategy: 'cache_first' as any,
        maxSize: 50 * 1024 * 1024, // 50MB
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        compression: true,
        versioning: true,
        prefetching: {
          enabled: true,
          strategy: 'adaptive' as any,
          maxConcurrent: 3,
          conditions: [
            { type: 'network', condition: 'effectiveType', value: '4g' },
            { type: 'storage', condition: 'available', value: 10 * 1024 * 1024 }
          ]
        }
      },
      encryption: {
        enabled: false,
        algorithm: 'AES-GCM',
        keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
        sensitiveDataOnly: true
      },
      events: {
        enabled: true,
        maxHistory: 100
      },
      monitoring: {
        enabled: true,
        interval: 30000 // 30 seconds
      }
    };

    offlineManagerInstance = new OfflineManager(config || defaultConfig, options);
  }

  return offlineManagerInstance;
}

// Export for testing
export { OfflineManager };