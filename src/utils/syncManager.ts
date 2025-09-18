/**
 * Data synchronization utilities for the kid-friendly-ai project
 * Provides intelligent conflict resolution, incremental sync, and background coordination
 */

import type {
  SyncConfig,
  SyncResult,
  Conflict,
  ConflictResolution,
  ConflictResolutionStrategy,
  OfflineOperation,
  OfflineError,
  OfflineErrorType
} from '../types/offline';
import { getOfflineStorage } from './offlineStorage';
import { getOfflineQueue } from './offlineQueue';

interface SyncContext {
  timestamp: number;
  sessionId: string;
  deviceId: string;
  networkInfo: {
    effectiveType: string;
    downlink: number;
    rtt: number;
  };
}

interface SyncBatch {
  id: string;
  operations: OfflineOperation[];
  timestamp: number;
  priority: number;
}

class SyncManager {
  private config: SyncConfig;
  private storage: ReturnType<typeof getOfflineStorage>;
  private queue: ReturnType<typeof getOfflineQueue>;
  private isSyncing = false;
  private syncInterval: number | null = null;
  private sessionId: string;
  private deviceId: string;
  private conflictResolvers: Map<string, Function> = new Map();

  constructor(config: SyncConfig) {
    this.config = config;
    this.storage = getOfflineStorage();
    this.queue = getOfflineQueue();
    this.sessionId = this._generateSessionId();
    this.deviceId = this._getDeviceId();
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
    await this.queue.initialize();

    if (this.config.autoSync) {
      this.startAutoSync();
    }

    if (this.config.backgroundSync && 'serviceWorker' in navigator) {
      await this._setupBackgroundSync();
    }

    console.log('Sync manager initialized');
  }

  // Main sync operations
  async syncNow(options: {
    force?: boolean;
    batchId?: string;
    types?: string[];
  } = {}): Promise<SyncResult> {
    if (this.isSyncing && !options.force) {
      throw new Error('Sync already in progress');
    }

    const startTime = Date.now();
    const context: SyncContext = {
      timestamp: startTime,
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      networkInfo: await this._getNetworkInfo()
    };

    this.isSyncing = true;

    try {
      console.log('Starting synchronization...');

      // Get pending operations
      const operations = await this._getPendingOperations(options.types);

      if (operations.length === 0) {
        return {
          success: true,
          syncedItems: 0,
          failedItems: 0,
          conflicts: [],
          duration: Date.now() - startTime,
          timestamp: startTime
        };
      }

      // Process in batches
      const batches = this._createBatches(operations);
      let totalSynced = 0;
      let totalFailed = 0;
      const allConflicts: Conflict[] = [];

      for (const batch of batches) {
        const batchResult = await this._syncBatch(batch, context);
        totalSynced += batchResult.syncedItems;
        totalFailed += batchResult.failedItems;
        allConflicts.push(...batchResult.conflicts);
      }

      const result: SyncResult = {
        success: totalFailed === 0,
        syncedItems: totalSynced,
        failedItems: totalFailed,
        conflicts: allConflicts,
        duration: Date.now() - startTime,
        timestamp: startTime
      };

      console.log(`Synchronization completed: ${totalSynced} synced, ${totalFailed} failed`);
      return result;
    } catch (error) {
      console.error('Synchronization failed:', error);
      throw this._createError(OfflineErrorType.SYNC_ERROR, 'Synchronization failed', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Conflict resolution
  registerConflictResolver(type: string, resolver: (conflict: Conflict) => Promise<ConflictResolution>): void {
    this.conflictResolvers.set(type, resolver);
  }

  async resolveConflict(conflict: Conflict, resolution?: ConflictResolution): Promise<ConflictResolution> {
    try {
      // Use provided resolution or try automatic resolution
      if (resolution) {
        const resolved = await this._applyResolution(conflict, resolution);
        await this._storeResolution(conflict, resolved);
        return resolved;
      }

      // Try automatic resolution based on strategy
      const autoResolution = await this._autoResolveConflict(conflict);
      if (autoResolution) {
        await this._storeResolution(conflict, autoResolution);
        return autoResolution;
      }

      // Use registered resolver
      const resolver = this.conflictResolvers.get(conflict.type);
      if (resolver) {
        const manualResolution = await resolver(conflict);
        await this._storeResolution(conflict, manualResolution);
        return manualResolution;
      }

      throw new Error(`No resolver available for conflict type: ${conflict.type}`);
    } catch (error) {
      throw this._createError(OfflineErrorType.CONFLICT_ERROR, 'Conflict resolution failed', error);
    }
  }

  // Batch operations
  async createBatch(operations: OfflineOperation[], priority: number = 1): Promise<string> {
    const batch: SyncBatch = {
      id: this._generateBatchId(),
      operations,
      timestamp: Date.now(),
      priority
    };

    await this.storage.store('syncBatches', batch, batch.id);
    return batch.id;
  }

  async getBatch(batchId: string): Promise<SyncBatch | null> {
    return await this.storage.retrieve<SyncBatch>('syncBatches', batchId);
  }

  async listBatches(): Promise<SyncBatch[]> {
    return await this.storage.retrieveAll<SyncBatch>('syncBatches');
  }

  async deleteBatch(batchId: string): Promise<void> {
    await this.storage.remove('syncBatches', batchId);
  }

  // Auto-sync management
  startAutoSync(): void {
    if (this.syncInterval) return;

    this.syncInterval = window.setInterval(
      () => this._autoSyncCheck(),
      this.config.syncInterval
    ) as unknown as number;

    console.log('Auto-sync started');
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync stopped');
    }
  }

  // Status and monitoring
  async getStatus(): Promise<{
    isOnline: boolean;
    isSyncing: boolean;
    lastSyncTime: number | null;
    pendingOperations: number;
    conflicts: Conflict[];
  }> {
    const isOnline = navigator.onLine;
    const pendingOperations = (await this.queue.getAll({ status: 'pending' as any })).length;
    const conflicts = await this.storage.retrieveAll<Conflict>('conflicts');
    const lastSyncTime = await this.storage.getLocal<number>('lastSyncTime');

    return {
      isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime,
      pendingOperations,
      conflicts
    };
  }

  async getConflicts(): Promise<Conflict[]> {
    return await this.storage.retrieveAll<Conflict>('conflicts');
  }

  async clearConflicts(): Promise<void> {
    await this.storage.clear('conflicts');
  }

  // Private helper methods
  private async _getPendingOperations(types?: string[]): Promise<OfflineOperation[]> {
    const operations = await this.queue.getAll({
      status: 'pending' as any
    });

    if (types && types.length > 0) {
      return operations.filter(op => types.includes(op.type));
    }

    return operations;
  }

  private _createBatches(operations: OfflineOperation[]): SyncBatch[] {
    const batches: SyncBatch[] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < operations.length; i += batchSize) {
      const batchOperations = operations.slice(i, i + batchSize);
      batches.push({
        id: this._generateBatchId(),
        operations: batchOperations,
        timestamp: Date.now(),
        priority: 1
      });
    }

    return batches;
  }

  private async _syncBatch(batch: SyncBatch, context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    let syncedItems = 0;
    let failedItems = 0;
    const conflicts: Conflict[] = [];

    try {
      // Check network connectivity
      if (!navigator.onLine) {
        throw new Error('Network is offline');
      }

      // Simulate batch sync - in real implementation, this would be an API call
      const syncResults = await this._executeBatchSync(batch.operations, context);

      // Process results
      for (const result of syncResults) {
        if (result.success) {
          syncedItems++;
          await this.queue.update(result.operationId, {
            status: 'completed' as any
          });
        } else {
          failedItems++;
          if (result.conflict) {
            conflicts.push(result.conflict);
            await this._storeConflict(result.conflict);
          }
        }
      }

      // Remove batch
      await this.deleteBatch(batch.id);

      return {
        success: failedItems === 0,
        syncedItems,
        failedItems,
        conflicts,
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    } catch (error) {
      console.error('Batch sync failed:', error);
      return {
        success: false,
        syncedItems,
        failedItems: batch.operations.length - syncedItems,
        conflicts,
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  }

  private async _executeBatchSync(
    operations: OfflineOperation[],
    context: SyncContext
  ): Promise<Array<{
    operationId: string;
    success: boolean;
    conflict?: Conflict;
  }>> {
    // Simulate API call - in real implementation, this would call your backend
    const results = [];

    for (const operation of operations) {
      try {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

        // Simulate random conflict for demonstration
        if (Math.random() < 0.1) { // 10% chance of conflict
          const conflict: Conflict = {
            id: this._generateConflictId(),
            type: operation.type,
            localData: operation.data,
            serverData: { ...operation.data, modified: true },
            timestamp: Date.now()
          };

          results.push({
            operationId: operation.id,
            success: false,
            conflict
          });
        } else {
          results.push({
            operationId: operation.id,
            success: true
          });
        }
      } catch (error) {
        results.push({
          operationId: operation.id,
          success: false
        });
      }
    }

    return results;
  }

  private async _autoResolveConflict(conflict: Conflict): Promise<ConflictResolution | null> {
    try {
      switch (this.config.conflictResolution) {
        case ConflictResolutionStrategy.CLIENT_WINS:
          return {
            strategy: ConflictResolutionStrategy.CLIENT_WINS,
            resolvedData: conflict.localData,
            timestamp: Date.now()
          };

        case ConflictResolutionStrategy.SERVER_WINS:
          return {
            strategy: ConflictResolutionStrategy.SERVER_WINS,
            resolvedData: conflict.serverData,
            timestamp: Date.now()
          };

        case ConflictResolutionStrategy.TIMESTAMP_WINS:
          const clientTimestamp = (conflict.localData as any).timestamp || 0;
          const serverTimestamp = (conflict.serverData as any).timestamp || 0;
          const winner = clientTimestamp > serverTimestamp ? 'local' : 'server';

          return {
            strategy: ConflictResolutionStrategy.TIMESTAMP_WINS,
            resolvedData: winner === 'local' ? conflict.localData : conflict.serverData,
            timestamp: Date.now()
          };

        case ConflictResolutionStrategy.MERGE:
          try {
            const merged = this._mergeData(conflict.localData, conflict.serverData);
            return {
              strategy: ConflictResolutionStrategy.MERGE,
              resolvedData: merged,
              timestamp: Date.now()
            };
          } catch (error) {
            // Fall back to client wins if merge fails
            return {
              strategy: ConflictResolutionStrategy.CLIENT_WINS,
              resolvedData: conflict.localData,
              timestamp: Date.now()
            };
          }

        default:
          return null;
      }
    } catch (error) {
      console.warn('Auto-resolution failed:', error);
      return null;
    }
  }

  private _mergeData(local: any, server: any): any {
    // Simple merge strategy - in real implementation, this would be more sophisticated
    if (typeof local !== 'object' || typeof server !== 'object') {
      return local; // Can't merge primitives, use local
    }

    const merged = { ...server };

    for (const key in local) {
      if (local.hasOwnProperty(key)) {
        if (typeof local[key] === 'object' && typeof server[key] === 'object') {
          merged[key] = this._mergeData(local[key], server[key]);
        } else {
          merged[key] = local[key];
        }
      }
    }

    return merged;
  }

  private async _applyResolution(conflict: Conflict, resolution: ConflictResolution): Promise<ConflictResolution> {
    // In a real implementation, this would update the server with the resolved data
    console.log(`Applying resolution for conflict ${conflict.id}: ${resolution.strategy}`);
    return resolution;
  }

  private async _storeConflict(conflict: Conflict): Promise<void> {
    await this.storage.store('conflicts', conflict, conflict.id);
  }

  private async _storeResolution(conflict: Conflict, resolution: ConflictResolution): Promise<void> {
    const resolvedConflict = {
      ...conflict,
      resolution,
      resolvedAt: Date.now()
    };
    await this.storage.store('resolvedConflicts', resolvedConflict, conflict.id);
    await this.storage.remove('conflicts', conflict.id);
  }

  private async _setupBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in (window as any).ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-operations');
        console.log('Background sync registered');
      } catch (error) {
        console.warn('Failed to register background sync:', error);
      }
    }
  }

  private async _autoSyncCheck(): Promise<void> {
    if (this.isSyncing || !navigator.onLine) return;

    try {
      const status = await this.getStatus();
      if (status.pendingOperations > 0) {
        console.log(`Auto-sync triggered: ${status.pendingOperations} pending operations`);
        await this.syncNow();
      }
    } catch (error) {
      console.warn('Auto-sync check failed:', error);
    }
  }

  private async _getNetworkInfo(): Promise<{
    effectiveType: string;
    downlink: number;
    rtt: number;
  }> {
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      return {
        effectiveType: conn.effectiveType || 'unknown',
        downlink: conn.downlink || 0,
        rtt: conn.rtt || 0
      };
    }

    return {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0
    };
  }

  private _generateSessionId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private _generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private _generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private _getDeviceId(): string {
    // Generate or retrieve device ID for identification
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
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
    this.stopAutoSync();
  }
}

// Export singleton instance
let syncManagerInstance: SyncManager | null = null;

export function getSyncManager(config?: SyncConfig): SyncManager {
  if (!syncManagerInstance) {
    const defaultConfig: SyncConfig = {
      autoSync: true,
      syncInterval: 30000, // 30 seconds
      batchSize: 10,
      retryDelay: 5000, // 5 seconds
      maxRetries: 3,
      conflictResolution: ConflictResolutionStrategy.CLIENT_WINS,
      backgroundSync: true
    };

    syncManagerInstance = new SyncManager(config || defaultConfig);
  }

  return syncManagerInstance;
}

// Export for testing
export { SyncManager };