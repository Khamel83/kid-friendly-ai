/**
 * React hooks for offline functionality in the kid-friendly-ai project
 * Provides easy-to-use hooks for managing offline state and operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  OfflineState,
  OfflineEvent,
  OfflineEventType,
  SyncResult,
  QueueStats,
  OfflineOperation,
  OfflineOperationHandler,
  ConflictResolver,
  OfflineManagerHook,
  ConnectionQuality,
  OperationStatus,
  OperationType
} from '../types/offline';
import { getOfflineManager } from '../utils/offlineManager';

interface UseOfflineManagerOptions {
  autoInitialize?: boolean;
  enableStateUpdates?: boolean;
  enableEventListeners?: boolean;
  syncOnOnline?: boolean;
  debounceMs?: number;
}

interface UseOfflineManagerResult extends OfflineManagerHook {
  // Extended state
  diagnostics: {
    storageInfo: any;
    queueStats: QueueStats | null;
    lastSync: Date | null;
    eventHistory: OfflineEvent[];
    metrics: any;
  };

  // Extended actions
  addOperation: (type: OperationType, data: any, priority?: number) => Promise<string>;
  removeOperation: (operationId: string) => Promise<void>;
  updateOperation: (operationId: string, updates: any) => Promise<void>;
  getOperation: (operationId: string) => Promise<OfflineOperation | null>;
  prefetchData: (key: string, url: string) => Promise<void>;
  warmupCache: (keys: string[]) => Promise<void>;

  // Advanced operations
  registerOperationHandler: (type: OperationType, handler: OfflineOperationHandler) => () => void;
  registerConflictResolver: (type: string, resolver: ConflictResolver) => () => void;
  exportData: () => Promise<string>;
  importData: (data: string) => Promise<void>;

  // Debug utilities
  runDiagnostics: () => Promise<any>;
  resetMetrics: () => void;
  getDetailedAnalytics: () => Promise<any>;
}

export function useOfflineManager(
  options: UseOfflineManagerOptions = {}
): UseOfflineManagerResult {
  const {
    autoInitialize = true,
    enableStateUpdates = true,
    enableEventListeners = true,
    syncOnOnline = true,
    debounceMs = 300
  } = options;

  // State
  const [state, setState] = useState<OfflineState>({
    isOnline: true,
    isOffline: false,
    connectionQuality: ConnectionQuality.GOOD,
    lastSyncTime: null,
    pendingOperations: 0,
    failedOperations: 0,
    isSyncing: false,
    syncProgress: 0,
    networkInfo: {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false
    },
    storageInfo: {
      used: 0,
      total: 0,
      available: 0,
      quota: 0,
      usage: 0
    }
  });

  const [diagnostics, setDiagnostics] = useState({
    storageInfo: null as any,
    queueStats: null as QueueStats | null,
    lastSync: null as Date | null,
    eventHistory: [] as OfflineEvent[],
    metrics: null as any
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const managerRef = useRef<ReturnType<typeof getOfflineManager> | null>(null);
  const stateUpdateTimer = useRef<number | null>(null);
  const cleanupCallbacks = useRef<(() => void)[]>([]);

  // Initialize offline manager
  useEffect(() => {
    if (autoInitialize && !isInitialized) {
      const initializeManager = async () => {
        try {
          const manager = getOfflineManager();
          managerRef.current = manager;
          await manager.initialize();

          setIsInitialized(true);
          setError(null);

          // Set up event listeners if enabled
          if (enableEventListeners) {
            setupEventListeners(manager);
          }

          // Set up periodic diagnostics updates
          setupDiagnosticsUpdates(manager);

          console.log('Offline manager hook initialized');
        } catch (err) {
          console.error('Failed to initialize offline manager:', err);
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      };

      initializeManager();
    }

    return () => {
      cleanup();
    };
  }, [autoInitialize, isInitialized, enableEventListeners]);

  // Setup event listeners
  const setupEventListeners = useCallback((manager: ReturnType<typeof getOfflineManager>) => {
    const cleanupFunctions: (() => void)[] = [];

    // State change events
    cleanupFunctions.push(
      manager.on(OfflineEventType.OFFLINE_DETECTED, (event) => {
        if (enableStateUpdates) {
          debouncedStateUpdate(manager);
        }
      })
    );

    cleanupFunctions.push(
      manager.on(OfflineEventType.ONLINE_DETECTED, (event) => {
        if (enableStateUpdates) {
          debouncedStateUpdate(manager);
        }

        // Auto-sync when coming online
        if (syncOnOnline) {
          setTimeout(() => {
            manager.syncNow().catch(console.error);
          }, 2000);
        }
      })
    );

    cleanupFunctions.push(
      manager.on(OfflineEventType.SYNC_STARTED, (event) => {
        if (enableStateUpdates) {
          debouncedStateUpdate(manager);
        }
      })
    );

    cleanupFunctions.push(
      manager.on(OfflineEventType.SYNC_COMPLETED, (event) => {
        if (enableStateUpdates) {
          debouncedStateUpdate(manager);
          setDiagnostics(prev => ({
            ...prev,
            lastSync: new Date(event.timestamp)
          }));
        }
      })
    );

    cleanupFunctions.push(
      manager.on(OfflineEventType.SYNC_FAILED, (event) => {
        if (enableStateUpdates) {
          debouncedStateUpdate(manager);
        }
      })
    );

    cleanupFunctions.push(
      manager.on(OfflineEventType.OPERATION_COMPLETED, (event) => {
        if (enableStateUpdates) {
          debouncedStateUpdate(manager);
        }
      })
    );

    cleanupFunctions.push(
      manager.on(OfflineEventType.OPERATION_FAILED, (event) => {
        if (enableStateUpdates) {
          debouncedStateUpdate(manager);
        }
      })
    );

    cleanupFunctions.push(
      manager.on(OfflineEventType.NETWORK_QUALITY_CHANGED, (event) => {
        if (enableStateUpdates) {
          debouncedStateUpdate(manager);
        }
      })
    );

    cleanupCallbacks.current = cleanupFunctions;
  }, [enableStateUpdates, syncOnOnline]);

  // Setup diagnostics updates
  const setupDiagnosticsUpdates = useCallback((manager: ReturnType<typeof getOfflineManager>) => {
    const updateDiagnostics = async () => {
      try {
        const [storageInfo, queueStats, eventHistory, metrics] = await Promise.all([
          manager.getStorageInfo(),
          manager.getQueueStats(),
          Promise.resolve(manager.getEventHistory()),
          Promise.resolve(manager.getMetrics())
        ]);

        setDiagnostics({
          storageInfo,
          queueStats,
          eventHistory,
          metrics
        });
      } catch (err) {
        console.warn('Failed to update diagnostics:', err);
      }
    };

    // Initial update
    updateDiagnostics();

    // Periodic updates
    const interval = setInterval(updateDiagnostics, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Debounced state update
  const debouncedStateUpdate = useCallback((manager: ReturnType<typeof getOfflineManager>) => {
    if (stateUpdateTimer.current) {
      clearTimeout(stateUpdateTimer.current);
    }

    stateUpdateTimer.current = window.setTimeout(() => {
      const newState = manager.getState();
      setState(newState);
      stateUpdateTimer.current = null;
    }, debounceMs);
  }, [debounceMs]);

  // Core hook methods
  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      return await managerRef.current.syncNow();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Sync failed'));
      throw err;
    }
  }, []);

  const clearQueue = useCallback(async (): Promise<void> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      await managerRef.current.clearQueue();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Clear queue failed'));
      throw err;
    }
  }, []);

  const retryFailed = useCallback(async (): Promise<void> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      // This would be implemented in the queue manager
      console.log('Retrying failed operations');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Retry failed'));
      throw err;
    }
  }, []);

  const clearCache = useCallback(async (): Promise<void> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      await managerRef.current.cacheClear();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Clear cache failed'));
      throw err;
    }
  }, []);

  const getStats = useCallback(async (): Promise<QueueStats> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      return await managerRef.current.getQueueStats();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Get stats failed'));
      throw err;
    }
  }, []);

  // Event handlers
  const onOfflineChange = useCallback((callback: (isOffline: boolean) => void) => {
    if (!managerRef.current) {
      return () => {};
    }

    return managerRef.current.on(
      OfflineEventType.OFFLINE_DETECTED,
      (event) => callback(true)
    );
  }, []);

  const onSyncProgress = useCallback((callback: (progress: number) => void) => {
    if (!managerRef.current) {
      return () => {};
    }

    return managerRef.current.on(
      OfflineEventType.SYNC_STARTED,
      (event) => callback(0)
    );
  }, []);

  const onOperationComplete = useCallback((callback: (operation: OfflineOperation) => void) => {
    if (!managerRef.current) {
      return () => {};
    }

    return managerRef.current.on(
      OfflineEventType.OPERATION_COMPLETED,
      (event) => callback(event.data?.operation)
    );
  }, []);

  // Extended operations
  const addOperation = useCallback(async (
    type: OperationType,
    data: any,
    priority = 3
  ): Promise<string> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      return await managerRef.current.queueOperation({
        type,
        data,
        status: OperationStatus.PENDING,
        priority,
        maxRetries: 3,
        timestamp: Date.now(),
        retryCount: 0,
        id: '',
        metadata: {}
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Add operation failed'));
      throw err;
    }
  }, []);

  const removeOperation = useCallback(async (operationId: string): Promise<void> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      // This would be implemented in the queue manager
      console.log(`Removing operation ${operationId}`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Remove operation failed'));
      throw err;
    }
  }, []);

  const updateOperation = useCallback(async (operationId: string, updates: any): Promise<void> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      // This would be implemented in the queue manager
      console.log(`Updating operation ${operationId}`, updates);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Update operation failed'));
      throw err;
    }
  }, []);

  const getOperation = useCallback(async (operationId: string): Promise<OfflineOperation | null> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      // This would be implemented in the queue manager
      return null;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Get operation failed'));
      throw err;
    }
  }, []);

  const prefetchData = useCallback(async (key: string, url: string): Promise<void> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      await managerRef.current.cacheSet(key, { url, prefetched: true, timestamp: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Prefetch failed'));
      throw err;
    }
  }, []);

  const warmupCache = useCallback(async (keys: string[]): Promise<void> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      // This would warm up the cache with the specified keys
      console.log(`Warming up cache with ${keys.length} keys`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Cache warmup failed'));
      throw err;
    }
  }, []);

  // Advanced operations
  const registerOperationHandler = useCallback((
    type: OperationType,
    handler: OfflineOperationHandler
  ): () => void => {
    // This would register a custom operation handler
    console.log(`Registering handler for operation type: ${type}`);
    return () => {
      console.log(`Unregistering handler for operation type: ${type}`);
    };
  }, []);

  const registerConflictResolver = useCallback((
    type: string,
    resolver: ConflictResolver
  ): () => void => {
    if (!managerRef.current) {
      return () => {};
    }

    try {
      managerRef.current.syncManager.registerConflictResolver(type, resolver);
      return () => {
        // Cleanup would be implemented here
      };
    } catch (err) {
      console.error('Failed to register conflict resolver:', err);
      return () => {};
    }
  }, []);

  const exportData = useCallback(async (): Promise<string> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      return await managerRef.current.createBackup();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Export failed'));
      throw err;
    }
  }, []);

  const importData = useCallback(async (data: string): Promise<void> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      await managerRef.current.restoreBackup(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Import failed'));
      throw err;
    }
  }, []);

  // Debug utilities
  const runDiagnostics = useCallback(async (): Promise<any> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      return await managerRef.current.runDiagnostics();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Diagnostics failed'));
      throw err;
    }
  }, []);

  const resetMetrics = useCallback((): void => {
    if (!managerRef.current) {
      return;
    }

    try {
      setError(null);
      // This would reset the metrics
      console.log('Resetting metrics');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Reset metrics failed'));
    }
  }, []);

  const getDetailedAnalytics = useCallback(async (): Promise<any> => {
    if (!managerRef.current) {
      throw new Error('Offline manager not initialized');
    }

    try {
      setError(null);
      return await managerRef.current.getAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Get analytics failed'));
      throw err;
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (stateUpdateTimer.current) {
      clearTimeout(stateUpdateTimer.current);
      stateUpdateTimer.current = null;
    }

    cleanupCallbacks.current.forEach(cleanupFn => cleanupFn());
    cleanupCallbacks.current = [];

    if (managerRef.current) {
      managerRef.current.destroy();
      managerRef.current = null;
    }

    setIsInitialized(false);
  }, []);

  // Return hook interface
  return {
    // State
    state,
    isOnline: state.isOnline,
    isOffline: state.isOffline,
    isSyncing: state.isSyncing,
    syncProgress: state.syncProgress,
    pendingOperations: state.pendingOperations,
    connectionQuality: state.connectionQuality,

    // Actions
    syncNow,
    clearQueue,
    retryFailed,
    clearCache,
    getStats,

    // Event handlers
    onOfflineChange,
    onSyncProgress,
    onOperationComplete,

    // Extended state
    diagnostics,

    // Extended actions
    addOperation,
    removeOperation,
    updateOperation,
    getOperation,
    prefetchData,
    warmupCache,

    // Advanced operations
    registerOperationHandler,
    registerConflictResolver,
    exportData,
    importData,

    // Debug utilities
    runDiagnostics,
    resetMetrics,
    getDetailedAnalytics,

    // Internal state
    isInitialized,
    error
  };
}

// Specialized hooks for common use cases
export function useOfflineState() {
  const { state, isOnline, isOffline, connectionQuality } = useOfflineManager({
    enableEventListeners: true,
    enableStateUpdates: true
  });

  return { state, isOnline, isOffline, connectionQuality };
}

export function useSyncOperations() {
  const { syncNow, isSyncing, syncProgress, lastSyncTime } = useOfflineManager({
    enableEventListeners: true,
    enableStateUpdates: true
  });

  return { syncNow, isSyncing, syncProgress, lastSyncTime };
}

export function useOfflineQueue() {
  const {
    addOperation,
    pendingOperations,
    clearQueue,
    getStats,
    diagnostics
  } = useOfflineManager({
    enableEventListeners: true,
    enableStateUpdates: true
  });

  return {
    addOperation,
    pendingOperations,
    clearQueue,
    getStats,
    queueStats: diagnostics.queueStats
  };
}

export function useOfflineCache() {
  const {
    cacheSet,
    cacheGet,
    cacheRemove,
    cacheClear,
    prefetchData,
    warmupCache
  } = useOfflineManager();

  return {
    cacheSet,
    cacheGet,
    cacheRemove,
    cacheClear,
    prefetchData,
    warmupCache
  };
}

export function useOfflineDiagnostics() {
  const {
    diagnostics,
    runDiagnostics,
    getDetailedAnalytics,
    exportData,
    importData,
    resetMetrics
  } = useOfflineManager({
    enableEventListeners: true,
    enableStateUpdates: true
  });

  return {
    diagnostics,
    runDiagnostics,
    getDetailedAnalytics,
    exportData,
    importData,
    resetMetrics
  };
}