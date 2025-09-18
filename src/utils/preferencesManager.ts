/**
 * Centralized Preferences Management for Kid-Friendly AI
 * Handles preference storage, validation, synchronization, and management
 */

import {
  UserPreference,
  PreferenceCategory,
  PreferenceHistory,
  PreferenceImportExport,
  PreferenceBackup,
  PreferenceAnalytics,
  PreferenceSearchResult,
  PreferenceNotification,
  PreferenceSession,
  PreferenceConstraintViolation,
  PreferenceValidationResult
} from '../types/preferences';
import { PreferenceDefaults } from './preferenceDefaults';
import { OfflineStorage } from './offlineStorage';
import { SoundAccessibilityManager } from './soundAccessibility';
import { ErrorHandler } from './errorHandler';

export interface PreferencesManagerConfig {
  userId?: string;
  autoSave: boolean;
  autoSync: boolean;
  maxHistoryItems: number;
  enableAnalytics: boolean;
  enableEncryption: boolean;
  storageKey: string;
  syncInterval: number;
}

export class PreferencesManager {
  private static instance: PreferencesManager;
  private preferences: Record<string, any> = {};
  private history: PreferenceHistory[] = [];
  private backups: PreferenceBackup[] = [];
  private sessions: PreferenceSession[] = [];
  private notifications: PreferenceNotification[] = [];
  private config: PreferencesManagerConfig;
  private currentSession: PreferenceSession | null = null;
  private storage: OfflineStorage;
  private accessibilityManager: SoundAccessibilityManager;
  private errorHandler: ErrorHandler;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<PreferencesManagerConfig> = {}) {
    this.config = {
      userId: this.generateUserId(),
      autoSave: true,
      autoSync: true,
      maxHistoryItems: 1000,
      enableAnalytics: true,
      enableEncryption: false,
      storageKey: 'kid-friendly-ai-preferences',
      syncInterval: 300000, // 5 minutes
      ...config
    };

    this.storage = OfflineStorage.getInstance();
    this.accessibilityManager = SoundAccessibilityManager.getInstance();
    this.errorHandler = ErrorHandler.getInstance();

    this.initialize();
  }

  static getInstance(config?: Partial<PreferencesManagerConfig>): PreferencesManager {
    if (!PreferencesManager.instance) {
      PreferencesManager.instance = new PreferencesManager(config);
    }
    return PreferencesManager.instance;
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadPreferences();
      await this.loadHistory();
      await this.loadBackups();
      await this.startSession();
      await this.setupAutoSync();

      if (this.config.enableAnalytics) {
        await this.setupAnalytics();
      }

      console.log('Preferences Manager initialized successfully');
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PREF_INIT_ERROR');
      console.error('Failed to initialize preferences manager:', error);
    }
  }

  private generateUserId(): string {
    const existing = localStorage.getItem('kid-friendly-ai-user-id');
    if (existing) return existing;

    const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('kid-friendly-ai-user-id', newId);
    return newId;
  }

  private async loadPreferences(): Promise<void> {
    try {
      const stored = await this.storage.get(this.config.storageKey);
      if (stored) {
        const data = JSON.parse(stored);

        // Validate and migrate preferences
        const validated = this.validateAndMigrate(data.preferences || {});
        this.preferences = validated;

        // Check if version migration is needed
        if (data.version && data.version !== PreferenceDefaults.getVersion()) {
          await this.migratePreferences(data.version, PreferenceDefaults.getVersion());
        }
      } else {
        // Load defaults
        this.preferences = this.getDefaultPreferences();
        await this.savePreferences();
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PREF_LOAD_ERROR');
      this.preferences = this.getDefaultPreferences();
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const stored = await this.storage.get(`${this.config.storageKey}-history`);
      if (stored) {
        this.history = JSON.parse(stored).map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp)
        }));

        // Limit history size
        if (this.history.length > this.config.maxHistoryItems) {
          this.history = this.history.slice(-this.config.maxHistoryItems);
          await this.saveHistory();
        }
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PREF_HISTORY_LOAD_ERROR');
      this.history = [];
    }
  }

  private async loadBackups(): Promise<void> {
    try {
      const stored = await this.storage.get(`${this.config.storageKey}-backups`);
      if (stored) {
        this.backups = JSON.parse(stored).map((b: any) => ({
          ...b,
          timestamp: new Date(b.timestamp)
        }));
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PREF_BACKUP_LOAD_ERROR');
      this.backups = [];
    }
  }

  private async startSession(): Promise<void> {
    this.currentSession = {
      id: this.generateSessionId(),
      userId: this.config.userId!,
      deviceId: this.getDeviceId(),
      startTime: new Date(),
      isActive: true,
      preferences: { ...this.preferences },
      changes: [],
      analytics: {
        userId: this.config.userId!,
        sessionId: this.generateSessionId(),
        timestamp: new Date(),
        events: [],
        summary: {
          totalChanges: 0,
          uniquePreferencesChanged: 0,
          mostChangedCategory: '',
          averageChangeDuration: 0,
          syncSuccessRate: 0,
          exportCount: 0,
          importCount: 0,
          resetCount: 0
        }
      }
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceId(): string {
    const stored = localStorage.getItem('kid-friendly-ai-device-id');
    if (stored) return stored;

    const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('kid-friendly-ai-device-id', newId);
    return newId;
  }

  private getDefaultPreferences(): Record<string, any> {
    const defaults: Record<string, any> = {};
    const age = this.getUserAge();

    // Get age-based defaults
    const ageDefaults = PreferenceDefaults.getAgeBasedDefaults(age);
    Object.assign(defaults, ageDefaults);

    // Get all default preferences
    const allPreferences = PreferenceDefaults.getAllPreferences();
    allPreferences.forEach(pref => {
      if (!defaults[pref.key]) {
        defaults[pref.key] = pref.defaultValue;
      }
    });

    return defaults;
  }

  private getUserAge(): number {
    // Try to get user age from preferences or use default
    const agePref = this.preferences['user.age'];
    if (agePref && typeof agePref === 'number') {
      return agePref;
    }

    // Try to get from localStorage
    const stored = localStorage.getItem('kid-friendly-ai-user-age');
    if (stored) {
      return parseInt(stored, 10);
    }

    return 8; // Default age
  }

  private validateAndMigrate(preferences: Record<string, any>): Record<string, any> {
    const validated: Record<string, any> = {};
    const allPreferences = PreferenceDefaults.getAllPreferences();

    // Validate each preference
    Object.entries(preferences).forEach(([key, value]) => {
      const prefDef = allPreferences.find(p => p.key === key);

      if (prefDef) {
        const validation = PreferenceDefaults.validatePreference(key, value, preferences);
        if (validation.isValid) {
          validated[key] = value;
        } else {
          // Use default if validation fails
          validated[key] = prefDef.defaultValue;
          console.warn(`Invalid preference value for ${key}, using default:`, validation.violations);
        }
      } else {
        // Keep unknown preferences for backward compatibility
        validated[key] = value;
      }
    });

    return validated;
  }

  private async migratePreferences(fromVersion: string, toVersion: string): Promise<void> {
    console.log(`Migrating preferences from ${fromVersion} to ${toVersion}`);

    // Implement migration logic here
    // This would typically involve transforming preference values
    // and updating data structures

    await this.savePreferences();
  }

  private async savePreferences(): Promise<void> {
    if (!this.config.autoSave) return;

    try {
      const data = {
        version: PreferenceDefaults.getVersion(),
        preferences: this.preferences,
        timestamp: new Date(),
        userId: this.config.userId
      };

      await this.storage.set(this.config.storageKey, JSON.stringify(data));

      // Trigger accessibility feedback
      this.accessibilityManager.triggerHapticFeedback('light');
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PREF_SAVE_ERROR');
      throw error;
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await this.storage.set(
        `${this.config.storageKey}-history`,
        JSON.stringify(this.history)
      );
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PREF_HISTORY_SAVE_ERROR');
    }
  }

  private async saveBackups(): Promise<void> {
    try {
      await this.storage.set(
        `${this.config.storageKey}-backups`,
        JSON.stringify(this.backups)
      );
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PREF_BACKUP_SAVE_ERROR');
    }
  }

  private async setupAutoSync(): Promise<void> {
    if (!this.config.autoSync) return;

    this.syncInterval = setInterval(() => {
      this.syncPreferences();
    }, this.config.syncInterval);
  }

  private async setupAnalytics(): Promise<void> {
    // Setup analytics tracking
    if (this.preferences['privacy.analytics.enabled']) {
      // Initialize analytics
      console.log('Analytics enabled for preferences');
    }
  }

  // Public API methods

  async getPreference<T = any>(key: string, defaultValue?: T): Promise<T> {
    return this.preferences[key] ?? defaultValue;
  }

  async setPreference(key: string, value: any, source: 'user' | 'system' = 'user'): Promise<void> {
    const oldValue = this.preferences[key];

    // Validate the preference
    const validation = PreferenceDefaults.validatePreference(key, value, this.preferences);
    if (!validation.isValid) {
      throw new Error(`Invalid preference value: ${validation.violations[0].message}`);
    }

    // Update the preference
    this.preferences[key] = value;

    // Add to history
    await this.addToHistory(key, oldValue, value, source);

    // Save if auto-save is enabled
    if (this.config.autoSave) {
      await this.savePreferences();
    }

    // Update session analytics
    if (this.currentSession) {
      this.currentSession.analytics.events.push({
        type: 'change',
        preferenceKey: key,
        oldValue,
        newValue: value,
        timestamp: new Date(),
        success: true
      });

      this.currentSession.analytics.summary.totalChanges++;
      this.currentSession.analytics.summary.uniquePreferencesChanged =
        new Set(this.currentSession.changes.map(c => c.preferenceKey)).size;
    }

    // Trigger accessibility feedback
    this.accessibilityManager.triggerHapticFeedback('medium');
  }

  async resetPreference(key: string): Promise<void> {
    const prefDef = PreferenceDefaults.getPreferenceByKey(key);
    if (prefDef) {
      await this.setPreference(key, prefDef.defaultValue, 'system');
    }
  }

  async resetAllPreferences(): Promise<void> {
    const defaults = this.getDefaultPreferences();
    const oldPreferences = { ...this.preferences };

    this.preferences = defaults;

    // Add to history for each changed preference
    Object.entries(oldPreferences).forEach(([key, oldValue]) => {
      if (oldValue !== defaults[key]) {
        this.addToHistory(key, oldValue, defaults[key], 'system');
      }
    });

    await this.savePreferences();

    // Add notification
    this.addNotification({
      id: this.generateNotificationId(),
      type: 'update',
      title: 'Preferences Reset',
      message: 'All preferences have been reset to their default values',
      timestamp: new Date(),
      priority: 'medium',
      isRead: false,
      actions: [
        {
          label: 'Undo',
          action: () => this.importPreferences(JSON.stringify(oldPreferences)),
          style: 'secondary'
        }
      ]
    });
  }

  async exportPreferences(options = {}): Promise<string> {
    const exportData: PreferenceImportExport = {
      version: PreferenceDefaults.getVersion(),
      timestamp: new Date(),
      preferences: this.preferences,
      metadata: {
        userId: this.config.userId,
        deviceInfo: this.getDeviceInfo(),
        exportType: 'full',
        categories: Object.keys(this.preferences),
        appVersion: '1.0.0'
      },
      checksum: this.generateChecksum(this.preferences)
    };

    const data = JSON.stringify(exportData, null, 2);

    // Update analytics
    if (this.currentSession) {
      this.currentSession.analytics.events.push({
        type: 'export',
        timestamp: new Date(),
        success: true
      });
      this.currentSession.analytics.summary.exportCount++;
    }

    return data;
  }

  async importPreferences(data: string, options = {}): Promise<void> {
    try {
      const importData: PreferenceImportExport = JSON.parse(data);

      // Validate checksum
      const calculatedChecksum = this.generateChecksum(importData.preferences);
      if (calculatedChecksum !== importData.checksum) {
        throw new Error('Data integrity check failed');
      }

      // Validate and migrate imported preferences
      const validated = this.validateAndMigrate(importData.preferences);

      // Create backup before import
      await this.createBackup('Pre-import backup');

      // Import preferences
      const oldPreferences = { ...this.preferences };
      this.preferences = validated;

      // Add to history
      Object.entries(validated).forEach(([key, value]) => {
        if (oldPreferences[key] !== value) {
          this.addToHistory(key, oldPreferences[key], value, 'import');
        }
      });

      await this.savePreferences();

      // Add notification
      this.addNotification({
        id: this.generateNotificationId(),
        type: 'update',
        title: 'Preferences Imported',
        message: 'Your preferences have been successfully imported',
        timestamp: new Date(),
        priority: 'medium',
        isRead: false,
        actions: [
          {
            label: 'Undo',
            action: () => this.importPreferences(JSON.stringify(oldPreferences)),
            style: 'secondary'
          }
        ]
      });

      // Update analytics
      if (this.currentSession) {
        this.currentSession.analytics.events.push({
          type: 'import',
          timestamp: new Date(),
          success: true
        });
        this.currentSession.analytics.summary.importCount++;
      }

    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PREF_IMPORT_ERROR');
      throw error;
    }
  }

  async createBackup(description?: string): Promise<string> {
    const backup: PreferenceBackup = {
      id: this.generateBackupId(),
      userId: this.config.userId!,
      timestamp: new Date(),
      preferences: { ...this.preferences },
      metadata: {
        deviceInfo: this.getDeviceInfo(),
        appVersion: '1.0.0',
        size: JSON.stringify(this.preferences).length,
        isEncrypted: this.config.enableEncryption,
        checksum: this.generateChecksum(this.preferences)
      },
      restorePoint: false,
      autoCreated: false,
      description
    };

    this.backups.push(backup);
    await this.saveBackups();

    // Limit backup count
    if (this.backups.length > 10) {
      this.backups = this.backups.slice(-10);
      await this.saveBackups();
    }

    return backup.id;
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backup = this.backups.find(b => b.id === backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    // Verify checksum
    const calculatedChecksum = this.generateChecksum(backup.preferences);
    if (calculatedChecksum !== backup.metadata.checksum) {
      throw new Error('Backup integrity check failed');
    }

    const oldPreferences = { ...this.preferences };
    this.preferences = { ...backup.preferences };

    // Add to history
    Object.entries(this.preferences).forEach(([key, value]) => {
      if (oldPreferences[key] !== value) {
        this.addToHistory(key, oldPreferences[key], value, 'import');
      }
    });

    await this.savePreferences();

    // Add notification
    this.addNotification({
      id: this.generateNotificationId(),
      type: 'update',
      title: 'Backup Restored',
      message: `Backup from ${backup.timestamp.toLocaleDateString()} has been restored`,
      timestamp: new Date(),
      priority: 'high',
      isRead: false,
      actions: [
        {
          label: 'Undo',
          action: () => this.importPreferences(JSON.stringify(oldPreferences)),
          style: 'secondary'
        }
      ]
    });
  }

  getBackups(): PreferenceBackup[] {
    return [...this.backups].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async deleteBackup(backupId: string): Promise<void> {
    this.backups = this.backups.filter(b => b.id !== backupId);
    await this.saveBackups();
  }

  searchPreferences(query: string): PreferenceSearchResult {
    const allPreferences = PreferenceDefaults.getAllPreferences();
    const matchingPrefs = allPreferences.filter(pref => {
      const searchFields = [
        pref.key,
        pref.description,
        pref.category,
        pref.id
      ];

      return searchFields.some(field =>
        field.toLowerCase().includes(query.toLowerCase())
      );
    });

    return {
      preferences: matchingPrefs,
      totalCount: matchingPrefs.length,
      facets: {
        categories: this.calculateCategoryFacets(matchingPrefs),
        dataTypes: this.calculateDataTypeFacets(matchingPrefs),
        ageRanges: this.calculateAgeRangeFacets(matchingPrefs)
      },
      suggestions: this.getSuggestions(query, matchingPrefs)
    };
  }

  private calculateCategoryFacets(preferences: UserPreference[]): Array<{ category: string; count: number }> {
    const counts: Record<string, number> = {};
    preferences.forEach(pref => {
      counts[pref.category] = (counts[pref.category] || 0) + 1;
    });

    return Object.entries(counts).map(([category, count]) => ({ category, count }));
  }

  private calculateDataTypeFacets(preferences: UserPreference[]): Array<{ type: string; count: number }> {
    const counts: Record<string, number> = {};
    preferences.forEach(pref => {
      counts[pref.dataType] = (counts[pref.dataType] || 0) + 1;
    });

    return Object.entries(counts).map(([type, count]) => ({ type, count }));
  }

  private calculateAgeRangeFacets(preferences: UserPreference[]): Array<{ range: string; count: number }> {
    const ageGroups = PreferenceDefaults.getAgeGroups();
    const counts: Record<string, number> = {};

    Object.entries(ageGroups).forEach(([key, group]) => {
      counts[group.name] = preferences.filter(pref => {
        if (!pref.minAge && !pref.maxAge) return false;
        return pref.minAge! <= group.max && pref.maxAge! >= group.min;
      }).length;
    });

    return Object.entries(counts).map(([range, count]) => ({ range, count }));
  }

  private getSuggestions(query: string, preferences: UserPreference[]): string[] {
    const suggestions: string[] = [];

    // Add common search terms
    if (query.length < 3) {
      suggestions.push('Try searching for "theme", "sound", or "privacy"');
    }

    // Add category suggestions
    const categories = [...new Set(preferences.map(p => p.category))];
    if (categories.length > 0) {
      suggestions.push(`Found results in: ${categories.slice(0, 3).join(', ')}`);
    }

    return suggestions;
  }

  async syncPreferences(): Promise<void> {
    if (!this.config.autoSync) return;

    try {
      // Implement sync logic with cloud storage
      console.log('Syncing preferences...');

      // Update analytics
      if (this.currentSession) {
        this.currentSession.analytics.events.push({
          type: 'sync',
          timestamp: new Date(),
          success: true
        });
      }

    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PREF_SYNC_ERROR');

      // Add notification
      this.addNotification({
        id: this.generateNotificationId(),
        type: 'error',
        title: 'Sync Failed',
        message: 'Failed to sync preferences with cloud',
        timestamp: new Date(),
        priority: 'high',
        isRead: false,
        actions: [
          {
            label: 'Retry',
            action: () => this.syncPreferences(),
            style: 'primary'
          }
        ]
      });
    }
  }

  private async addToHistory(key: string, oldValue: any, newValue: any, source: 'user' | 'system' | 'import'): Promise<void> {
    const historyItem: PreferenceHistory = {
      id: this.generateHistoryId(),
      preferenceKey: key,
      oldValue,
      newValue,
      timestamp: new Date(),
      userId: this.config.userId!,
      source,
      deviceInfo: this.getDeviceInfo()
    };

    this.history.push(historyItem);

    // Update session
    if (this.currentSession) {
      this.currentSession.changes.push(historyItem);
    }

    // Limit history size
    if (this.history.length > this.config.maxHistoryItems) {
      this.history = this.history.slice(-this.config.maxHistoryItems);
    }

    await this.saveHistory();
  }

  private generateHistoryId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateChecksum(data: any): string {
    // Simple checksum implementation
    const dataStr = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      const char = dataStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private getDeviceInfo(): string {
    return `${navigator.userAgent} - ${this.getDeviceId()}`;
  }

  private addNotification(notification: PreferenceNotification): void {
    this.notifications.push(notification);

    // Limit notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(-50);
    }

    // Trigger accessibility feedback
    this.accessibilityManager.triggerHapticFeedback('light');
  }

  getNotifications(): PreferenceNotification[] {
    return [...this.notifications].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async markNotificationAsRead(id: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.isRead = true;
    }
  }

  async dismissNotification(id: string): Promise<void> {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  async clearAllNotifications(): Promise<void> {
    this.notifications = [];
  }

  getHistory(key?: string): PreferenceHistory[] {
    let history = [...this.history].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (key) {
      history = history.filter(h => h.preferenceKey === key);
    }

    return history;
  }

  async endSession(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.currentSession.isActive = false;
      this.sessions.push(this.currentSession);
      this.currentSession = null;
    }
  }

  getCurrentSession(): PreferenceSession | null {
    return this.currentSession;
  }

  async destroy(): Promise<void> {
    await this.endSession();

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}