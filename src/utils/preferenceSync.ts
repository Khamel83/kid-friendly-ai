/**
 * Preference Synchronization for Kid-Friendly AI
 * Handles cloud sync, conflict resolution, offline management, and device sync
 */

import {
  PreferenceSyncData,
  PreferenceDevice,
  PreferenceSyncState,
  PreferenceNotification,
  PreferenceBackup
} from '../types/preferences';
import { PreferencesManager } from './preferencesManager';
import { OfflineStorage } from './offlineStorage';
import { ErrorHandler } from './errorHandler';
import { SoundAccessibilityManager } from './soundAccessibility';

export interface PreferenceSyncConfig {
  enableCloudSync: boolean;
  syncInterval: number;
  maxRetries: number;
  conflictResolution: 'local' | 'remote' | 'merge' | 'manual';
  offlineSyncQueueSize: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  syncUrl?: string;
  apiKey?: string;
}

export interface SyncConflict {
  id: string;
  key: string;
  localValue: any;
  remoteValue: any;
  timestamp: Date;
  deviceId: string;
  resolved: boolean;
  resolution?: 'local' | 'remote' | 'merge' | 'custom';
  customValue?: any;
}

export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  key: string;
  value: any;
  timestamp: Date;
  retryCount: number;
  lastAttempt: Date;
}

export class PreferenceSyncManager {
  private static instance: PreferenceSyncManager;
  private preferencesManager: PreferencesManager;
  private storage: OfflineStorage;
  private errorHandler: ErrorHandler;
  private accessibilityManager: SoundAccessibilityManager;
  private config: PreferenceSyncConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private isOnline: boolean = true;
  private devices: Map<string, PreferenceDevice> = new Map();
  private conflicts: Map<string, SyncConflict> = new Map();
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing: boolean = false;
  private lastSyncTime: Date | null = null;
  private syncStats = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    conflictsResolved: 0,
    bytesTransferred: 0
  };

  constructor(
    preferencesManager: PreferencesManager,
    config: Partial<PreferenceSyncConfig> = {}
  ) {
    this.preferencesManager = preferencesManager;
    this.storage = OfflineStorage.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.accessibilityManager = SoundAccessibilityManager.getInstance();

    this.config = {
      enableCloudSync: true,
      syncInterval: 300000, // 5 minutes
      maxRetries: 3,
      conflictResolution: 'merge',
      offlineSyncQueueSize: 1000,
      enableCompression: true,
      enableEncryption: false,
      ...config
    };

    this.initialize();
  }

  static getInstance(
    preferencesManager: PreferencesManager,
    config?: Partial<PreferenceSyncConfig>
  ): PreferenceSyncManager {
    if (!PreferenceSyncManager.instance) {
      PreferenceSyncManager.instance = new PreferenceSyncManager(preferencesManager, config);
    }
    return PreferenceSyncManager.instance;
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadSyncState();
      await this.setupEventListeners();
      await this.setupAutoSync();
      await this.registerDevice();
      await this.startPeriodicSync();

      console.log('Preference Sync Manager initialized successfully');
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'SYNC_INIT_ERROR');
      console.error('Failed to initialize sync manager:', error);
    }
  }

  private async loadSyncState(): Promise<void> {
    try {
      const stored = await this.storage.get('preference-sync-state');
      if (stored) {
        const state = JSON.parse(stored);

        this.devices = new Map(state.devices || []);
        this.conflicts = new Map(state.conflicts || []);
        this.syncQueue = state.syncQueue || [];
        this.lastSyncTime = state.lastSyncTime ? new Date(state.lastSyncTime) : null;
        this.syncStats = state.syncStats || this.syncStats;
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'SYNC_STATE_LOAD_ERROR');
    }
  }

  private async saveSyncState(): Promise<void> {
    try {
      const state = {
        devices: Array.from(this.devices.entries()),
        conflicts: Array.from(this.conflicts.entries()),
        syncQueue: this.syncQueue,
        lastSyncTime: this.lastSyncTime,
        syncStats: this.syncStats
      };

      await this.storage.set('preference-sync-state', JSON.stringify(state));
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'SYNC_STATE_SAVE_ERROR');
    }
  }

  private async setupEventListeners(): Promise<void> {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Listen for preference changes
    // This would typically connect to the preferences manager's event system

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncPreferences();
      }
    });
  }

  private async setupAutoSync(): Promise<void> {
    if (this.config.enableCloudSync) {
      this.syncInterval = setInterval(() => {
        this.syncPreferences();
      }, this.config.syncInterval);
    }
  }

  private async startPeriodicSync(): Promise<void> {
    // Sync on startup
    await this.syncPreferences();

    // Periodic health check
    setInterval(() => {
      this.healthCheck();
    }, 60000); // Every minute
  }

  private async registerDevice(): Promise<void> {
    const device: PreferenceDevice = {
      id: this.getDeviceId(),
      name: this.getDeviceName(),
      type: this.getDeviceType(),
      platform: navigator.platform,
      browser: this.getBrowserName(),
      lastActive: new Date(),
      lastSync: new Date(),
      isOnline: true,
      isPrimary: false,
      preferences: {},
      capabilities: this.getDeviceCapabilities()
    };

    this.devices.set(device.id, device);
    await this.saveSyncState();
  }

  private getDeviceId(): string {
    const stored = localStorage.getItem('kid-friendly-ai-device-id');
    if (stored) return stored;

    const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('kid-friendly-ai-device-id', newId);
    return newId;
  }

  private getDeviceName(): string {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Linux')) return 'Linux PC';

    return 'Unknown Device';
  }

  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'web' {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Mobile') || userAgent.includes('iPhone')) return 'mobile';
    if (userAgent.includes('iPad') || userAgent.includes('Tablet')) return 'tablet';

    return 'desktop';
  }

  private getBrowserName(): string {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';

    return 'Unknown Browser';
  }

  private getDeviceCapabilities(): string[] {
    const capabilities: string[] = [];

    if ('Notification' in window) capabilities.push('notifications');
    if ('serviceWorker' in navigator) capabilities.push('offline');
    if ('caches' in window) capabilities.push('cache');
    if ('indexedDB' in window) capabilities.push('storage');
    if ('WebSocket' in window) capabilities.push('websocket');

    return capabilities;
  }

  private handleOnline(): void {
    this.isOnline = true;
    console.log('Device is online, resuming sync operations');

    // Update device status
    const device = this.devices.get(this.getDeviceId());
    if (device) {
      device.isOnline = true;
      device.lastActive = new Date();
    }

    // Process queued sync operations
    this.processSyncQueue();

    // Trigger immediate sync
    this.syncPreferences();
  }

  private handleOffline(): void {
    this.isOnline = false;
    console.log('Device is offline, pausing sync operations');

    // Update device status
    const device = this.devices.get(this.getDeviceId());
    if (device) {
      device.isOnline = false;
      device.lastActive = new Date();
    }
  }

  async syncPreferences(): Promise<boolean> {
    if (!this.config.enableCloudSync || this.isSyncing) {
      return false;
    }

    this.isSyncing = true;
    this.syncStats.totalSyncs++;

    try {
      if (!this.isOnline) {
        console.log('Device is offline, skipping sync');
        return false;
      }

      // Get current preferences
      const preferences = await this.preferencesManager.exportPreferences();
      const currentDevice = this.devices.get(this.getDeviceId());

      if (!currentDevice) {
        throw new Error('Device not registered');
      }

      // Prepare sync data
      const syncData: PreferenceSyncData = {
        id: this.generateSyncId(),
        userId: 'current-user', // Get from preferences manager
        deviceId: currentDevice.id,
        preferences: JSON.parse(preferences),
        timestamp: new Date(),
        operation: 'sync',
        conflictResolution: this.config.conflictResolution,
        lastSync: this.lastSyncTime || new Date(),
        syncStatus: 'syncing'
      };

      // Simulate cloud sync (in real implementation, this would be an API call)
      await this.simulateCloudSync(syncData);

      // Process sync queue
      await this.processSyncQueue();

      // Update last sync time
      this.lastSyncTime = new Date();
      currentDevice.lastSync = this.lastSyncTime;

      // Update stats
      this.syncStats.successfulSyncs++;

      // Save state
      await this.saveSyncState();

      // Trigger accessibility feedback
      this.accessibilityManager.triggerHapticFeedback('success');

      return true;

    } catch (error) {
      this.errorHandler.handleError(error as Error, 'SYNC_ERROR');
      this.syncStats.failedSyncs++;

      // Add to retry queue
      this.addToSyncQueue('update', 'sync-failed', { error: error instanceof Error ? error.message : 'Unknown error' });

      return false;

    } finally {
      this.isSyncing = false;
    }
  }

  private async simulateCloudSync(syncData: PreferenceSyncData): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Check for conflicts (simulation)
    const conflicts = await this.checkForConflicts(syncData);

    if (conflicts.length > 0) {
      await this.handleConflicts(conflicts);
    }

    // Update device preferences
    const device = this.devices.get(syncData.deviceId);
    if (device) {
      device.preferences = syncData.preferences;
      device.lastSync = syncData.timestamp;
    }
  }

  private async checkForConflicts(syncData: PreferenceSyncData): Promise<SyncConflict[]> {
    const conflicts: SyncConflict[] = [];

    // Check for conflicts with other devices
    for (const [deviceId, device] of this.devices) {
      if (deviceId === syncData.deviceId) continue;

      // Check if device has been updated recently
      if (device.lastSync > syncData.lastSync) {
        // Check for conflicting preferences
        Object.entries(device.preferences).forEach(([key, value]) => {
          const localValue = syncData.preferences[key];

          if (localValue !== undefined && JSON.stringify(localValue) !== JSON.stringify(value)) {
            conflicts.push({
              id: this.generateConflictId(),
              key,
              localValue,
              remoteValue: value,
              timestamp: new Date(),
              deviceId,
              resolved: false
            });
          }
        });
      }
    }

    return conflicts;
  }

  private async handleConflicts(conflicts: SyncConflict[]): Promise<void> {
    for (const conflict of conflicts) {
      this.conflicts.set(conflict.id, conflict);

      // Auto-resolve based on configuration
      if (this.config.conflictResolution !== 'manual') {
        await this.resolveConflict(conflict.id, this.config.conflictResolution);
      } else {
        // Manual conflict resolution - add notification
        this.addConflictNotification(conflict);
      }
    }

    await this.saveSyncState();
  }

  private addConflictNotification(conflict: SyncConflict): void {
    // This would typically integrate with the preferences manager's notification system
    console.warn(`Conflict detected for preference "${conflict.key}"`);
  }

  async resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge' | 'manual', customValue?: any): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return;

    conflict.resolved = true;
    conflict.resolution = resolution;

    if (customValue !== undefined) {
      conflict.customValue = customValue;
    }

    // Apply resolution
    let finalValue: any;
    switch (resolution) {
      case 'local':
        finalValue = conflict.localValue;
        break;
      case 'remote':
        finalValue = conflict.remoteValue;
        break;
      case 'merge':
        finalValue = this.mergeValues(conflict.localValue, conflict.remoteValue);
        break;
      case 'manual':
        finalValue = customValue;
        break;
    }

    // Update preferences
    await this.preferencesManager.setPreference(conflict.key, finalValue, 'system');

    // Update stats
    this.syncStats.conflictsResolved++;

    // Update device state
    const device = this.devices.get(this.getDeviceId());
    if (device) {
      device.preferences[conflict.key] = finalValue;
    }

    await this.saveSyncState();
  }

  private mergeValues(local: any, remote: any): any {
    // Simple merge logic - can be enhanced based on preference types
    if (typeof local === 'object' && typeof remote === 'object') {
      return { ...local, ...remote };
    }

    // For arrays, combine and remove duplicates
    if (Array.isArray(local) && Array.isArray(remote)) {
      return [...new Set([...local, ...remote])];
    }

    // For simple values, prefer the newer one (remote)
    return remote;
  }

  private addToSyncQueue(operation: 'create' | 'update' | 'delete', key: string, value: any): void {
    const queueItem: SyncQueueItem = {
      id: this.generateQueueItemId(),
      operation,
      key,
      value,
      timestamp: new Date(),
      retryCount: 0,
      lastAttempt: new Date()
    };

    this.syncQueue.push(queueItem);

    // Limit queue size
    if (this.syncQueue.length > this.config.offlineSyncQueueSize) {
      this.syncQueue = this.syncQueue.slice(-this.config.offlineSyncQueueSize);
    }

    this.saveSyncState();
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0 || !this.isOnline) return;

    const processedItems: SyncQueueItem[] = [];
    const failedItems: SyncQueueItem[] = [];

    for (const item of this.syncQueue) {
      try {
        // Process the item (simulate API call)
        await this.processQueueItem(item);
        processedItems.push(item);
      } catch (error) {
        item.retryCount++;
        item.lastAttempt = new Date();

        if (item.retryCount < this.config.maxRetries) {
          failedItems.push(item);
        }
      }
    }

    // Update queue
    this.syncQueue = failedItems;
    await this.saveSyncState();

    // Update stats
    this.syncStats.bytesTransferred += processedItems.length * 1024; // Estimate
  }

  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 50));

    // In real implementation, this would make an API call
    console.log(`Processing sync queue item: ${item.operation} ${item.key}`);
  }

  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateQueueItemId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async healthCheck(): Promise<void> {
    // Check sync health
    const device = this.devices.get(this.getDeviceId());
    if (device) {
      device.isOnline = this.isOnline;
      device.lastActive = new Date();
    }

    // Clean up old devices (inactive for 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const [deviceId, device] of this.devices) {
      if (device.lastActive < thirtyDaysAgo) {
        this.devices.delete(deviceId);
      }
    }

    // Clean up resolved conflicts older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    for (const [conflictId, conflict] of this.conflicts) {
      if (conflict.resolved && conflict.timestamp < sevenDaysAgo) {
        this.conflicts.delete(conflictId);
      }
    }

    await this.saveSyncState();
  }

  getSyncState(): PreferenceSyncState {
    const device = this.devices.get(this.getDeviceId());
    const conflicts = Array.from(this.conflicts.values()).filter(c => !c.resolved);

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSync: this.lastSyncTime,
      syncError: null, // Could be populated from last sync error
      devices: Array.from(this.devices.values()),
      conflicts: conflicts.map(c => ({
        key: c.key,
        localValue: c.localValue,
        remoteValue: c.remoteValue,
        timestamp: c.timestamp,
        deviceId: c.deviceId
      })),
      syncInProgress: this.isSyncing,
      syncPercentage: this.isSyncing ? 50 : 100 // Simple calculation
    };
  }

  getSyncStats() {
    return { ...this.syncStats };
  }

  getConflicts(): SyncConflict[] {
    return Array.from(this.conflicts.values()).filter(c => !c.resolved);
  }

  getSyncQueue(): SyncQueueItem[] {
    return [...this.syncQueue];
  }

  async forceSync(): Promise<boolean> {
    return await this.syncPreferences();
  }

  async clearSyncData(): Promise<void> {
    this.syncQueue = [];
    this.conflicts.clear();
    this.lastSyncTime = null;
    this.syncStats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsResolved: 0,
      bytesTransferred: 0
    };

    await this.saveSyncState();
  }

  async createBackup(): Promise<string> {
    // Create a backup of sync state
    const backupData = {
      devices: Array.from(this.devices.entries()),
      conflicts: Array.from(this.conflicts.entries()),
      syncQueue: this.syncQueue,
      lastSyncTime: this.lastSyncTime,
      syncStats: this.syncStats,
      timestamp: new Date()
    };

    const backupId = `sync_backup_${Date.now()}`;
    await this.storage.set(`sync_backup_${backupId}`, JSON.stringify(backupData));

    return backupId;
  }

  async restoreBackup(backupId: string): Promise<void> {
    const stored = await this.storage.get(`sync_backup_${backupId}`);
    if (!stored) {
      throw new Error('Backup not found');
    }

    const backupData = JSON.parse(stored);

    this.devices = new Map(backupData.devices);
    this.conflicts = new Map(backupData.conflicts);
    this.syncQueue = backupData.syncQueue;
    this.lastSyncTime = backupData.lastSyncTime;
    this.syncStats = backupData.syncStats;

    await this.saveSyncState();
  }

  async destroy(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Final sync
    await this.syncPreferences();

    // Save final state
    await this.saveSyncState();
  }
}