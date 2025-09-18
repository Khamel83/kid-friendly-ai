/**
 * Content Update System
 * Provides automatic content updates, differential updates, and update management
 */

import {
  ContentUpdate,
  UpdateType,
  UpdatePriority,
  UpdateStatus,
  ContentVersion,
  VersionChange,
  ContentAnalytics,
  AnalyticsPeriod,
  ContentEvent,
  ContentEventType,
  ContentError,
  ContentMetadata,
} from '../types/content';

interface UpdateConfig {
  autoCheck: boolean;
  checkInterval: number; // in minutes
  autoDownload: boolean;
  autoInstall: boolean;
  bandwidthLimit: number; // in bytes per second
  maxRetries: number;
  retryDelay: number; // in milliseconds
  verificationEnabled: boolean;
  rollbackEnabled: boolean;
  notificationEnabled: boolean;
  differentialUpdates: boolean;
  backgroundUpdates: boolean;
}

interface UpdateManifest {
  version: string;
  timestamp: Date;
  updates: ContentUpdate[];
  checksum: string;
  signature?: string;
}

interface UpdateProgress {
  updateId: string;
  stage: 'checking' | 'downloading' | 'installing' | 'verifying' | 'completed' | 'failed';
  progress: number; // 0-100
  speed: number; // bytes per second
  estimatedTimeRemaining: number; // in seconds
  error?: string;
}

interface UpdateSchedule {
  id: string;
  contentId: string;
  scheduledAt: Date;
  priority: UpdatePriority;
  isRecurring: boolean;
  recurringInterval?: number; // in hours
  isActive: boolean;
}

interface UpdateNotification {
  id: string;
  type: 'available' | 'downloading' | 'installing' | 'completed' | 'failed';
  title: string;
  message: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'success';
  actions?: Array<{
    label: string;
    action: () => void;
    primary: boolean;
  }>;
}

export class ContentUpdater {
  private config: UpdateConfig;
  private updateQueue: Map<string, ContentUpdate> = new Map();
  private activeUpdates: Map<string, UpdateProgress> = new Map();
  private installedVersions: Map<string, string> = new Map();
  private updateHistory: ContentUpdate[] = [];
  private schedules: Map<string, UpdateSchedule> = new Map();
  private notifications: UpdateNotification[] = [];
  private manifest: UpdateManifest | null = null;
  private isChecking = false;

  constructor(config?: Partial<UpdateConfig>) {
    this.config = {
      autoCheck: true,
      checkInterval: 60, // 1 hour
      autoDownload: true,
      autoInstall: false,
      bandwidthLimit: 1024 * 1024, // 1MB/s
      maxRetries: 3,
      retryDelay: 5000, // 5 seconds
      verificationEnabled: true,
      rollbackEnabled: true,
      notificationEnabled: true,
      differentialUpdates: true,
      backgroundUpdates: true,
      ...config,
    };

    this.initializeUpdater();
  }

  /**
   * Check for content updates
   */
  async checkForUpdates(contentId?: string): Promise<ContentUpdate[]> {
    try {
      if (this.isChecking) {
        return [];
      }

      this.isChecking = true;

      // Get update manifest
      const manifest = await this.fetchUpdateManifest();
      this.manifest = manifest;

      // Filter updates based on current versions
      const availableUpdates = await this.filterAvailableUpdates(manifest.updates, contentId);

      // Add to queue
      availableUpdates.forEach(update => {
        this.updateQueue.set(update.id, update);
      });

      // Notify about available updates
      if (availableUpdates.length > 0) {
        await this.notifyUpdatesAvailable(availableUpdates);
      }

      // Auto-download if enabled
      if (this.config.autoDownload) {
        await this.downloadUpdates(availableUpdates);
      }

      return availableUpdates;

    } catch (error) {
      throw this.createError('UPDATE_CHECK_FAILED', 'Failed to check for updates', error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Download specific update
   */
  async downloadUpdate(updateId: string): Promise<void> {
    try {
      const update = this.updateQueue.get(updateId);
      if (!update) {
        throw this.createError('UPDATE_NOT_FOUND', 'Update not found in queue');
      }

      const progress: UpdateProgress = {
        updateId,
        stage: 'downloading',
        progress: 0,
        speed: 0,
        estimatedTimeRemaining: 0,
      };

      this.activeUpdates.set(updateId, progress);

      await this.performDownload(update, progress);

    } catch (error) {
      throw this.createError('UPDATE_DOWNLOAD_FAILED', 'Failed to download update', error);
    }
  }

  /**
   * Install downloaded update
   */
  async installUpdate(updateId: string): Promise<boolean> {
    try {
      const update = this.updateQueue.get(updateId);
      if (!update) {
        throw this.createError('UPDATE_NOT_FOUND', 'Update not found in queue');
      }

      const progress: UpdateProgress = {
        updateId,
        stage: 'installing',
        progress: 0,
        speed: 0,
        estimatedTimeRemaining: 0,
      };

      this.activeUpdates.set(updateId, progress);

      const success = await this.performInstallation(update, progress);

      if (success) {
        await this.completeUpdate(update);
      }

      return success;

    } catch (error) {
      throw this.createError('UPDATE_INSTALL_FAILED', 'Failed to install update', error);
    }
  }

  /**
   * Apply update to content
   */
  async applyUpdate(update: ContentUpdate): Promise<boolean> {
    try {
      // Create backup before applying update
      if (this.config.rollbackEnabled) {
        await this.createBackup(update.contentId);
      }

      // Apply the update
      const result = await this.performUpdateApplication(update);

      if (result) {
        // Update version tracking
        this.installedVersions.set(update.contentId, update.version);

        // Add to history
        this.updateHistory.push(update);

        // Track update event
        await this.trackUpdateEvent(update, 'applied');

        return true;
      }

      return false;

    } catch (error) {
      // Rollback if enabled and update failed
      if (this.config.rollbackEnabled) {
        await this.rollbackUpdate(update.contentId);
      }

      throw this.createError('UPDATE_APPLY_FAILED', 'Failed to apply update', error);
    }
  }

  /**
   * Rollback update
   */
  async rollbackUpdate(contentId: string): Promise<boolean> {
    try {
      const currentVersion = this.installedVersions.get(contentId);
      if (!currentVersion) {
        throw this.createError('NO_CURRENT_VERSION', 'No current version to rollback from');
      }

      // Find rollback version
      const rollbackVersion = await this.findRollbackVersion(contentId, currentVersion);
      if (!rollbackVersion) {
        throw this.createError('NO_ROLLBACK_VERSION', 'No rollback version available');
      }

      // Perform rollback
      const success = await this.performRollback(contentId, rollbackVersion);

      if (success) {
        // Update version tracking
        this.installedVersions.set(contentId, rollbackVersion);

        // Track rollback event
        await this.trackUpdateEvent({
          id: `rollback_${Date.now()}`,
          contentId,
          type: 'bugfix',
          version: rollbackVersion,
          description: 'Rollback update',
          changes: [],
          size: 0,
          checksum: '',
          isRequired: true,
          priority: 'critical',
          status: 'completed',
        } as ContentUpdate, 'rollback');

        return true;
      }

      return false;

    } catch (error) {
      throw this.createError('ROLLBACK_FAILED', 'Failed to rollback update', error);
    }
  }

  /**
   * Schedule update
   */
  async scheduleUpdate(
    contentId: string,
    schedule: Omit<UpdateSchedule, 'id' | 'contentId' | 'isActive'>
  ): Promise<string> {
    try {
      const updateSchedule: UpdateSchedule = {
        id: this.generateScheduleId(),
        contentId,
        ...schedule,
        isActive: true,
      };

      this.schedules.set(updateSchedule.id, updateSchedule);

      return updateSchedule.id;

    } catch (error) {
      throw this.createError('SCHEDULE_FAILED', 'Failed to schedule update', error);
    }
  }

  /**
   * Get update progress
   */
  getUpdateProgress(updateId?: string): UpdateProgress | UpdateProgress[] {
    if (updateId) {
      return this.activeUpdates.get(updateId) || null;
    }

    return Array.from(this.activeUpdates.values());
  }

  /**
   * Get update history
   */
  getUpdateHistory(contentId?: string): ContentUpdate[] {
    if (contentId) {
      return this.updateHistory.filter(update => update.contentId === contentId);
    }

    return [...this.updateHistory];
  }

  /**
   * Get update notifications
   */
  getNotifications(): UpdateNotification[] {
    return [...this.notifications];
  }

  /**
   * Dismiss notification
   */
  dismissNotification(notificationId: string): void {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
  }

  /**
   * Cancel update
   */
  async cancelUpdate(updateId: string): Promise<boolean> {
    try {
      const progress = this.activeUpdates.get(updateId);
      if (!progress) {
        return false;
      }

      // Cancel based on current stage
      switch (progress.stage) {
        case 'downloading':
          await this.cancelDownload(updateId);
          break;
        case 'installing':
          await this.cancelInstallation(updateId);
          break;
        default:
          return false;
      }

      progress.stage = 'failed';
      progress.error = 'Update cancelled by user';

      this.activeUpdates.delete(updateId);

      return true;

    } catch (error) {
      throw this.createError('CANCEL_FAILED', 'Failed to cancel update', error);
    }
  }

  /**
   * Get update statistics
   */
  getUpdateStats(): {
    totalUpdates: number;
    successfulUpdates: number;
    failedUpdates: number;
    pendingUpdates: number;
    averageUpdateTime: number;
    lastUpdate: Date | null;
    totalBandwidthUsed: number;
  } {
    const successful = this.updateHistory.filter(u => u.status === 'completed').length;
    const failed = this.updateHistory.filter(u => u.status === 'failed').length;
    const pending = this.updateQueue.size;

    const successfulUpdates = this.updateHistory.filter(u => u.status === 'completed');
    const averageUpdateTime = successfulUpdates.length > 0
      ? successfulUpdates.reduce((sum, u) => {
          const duration = u.appliedAt && u.scheduledAt
            ? u.appliedAt.getTime() - u.scheduledAt.getTime()
            : 0;
          return sum + duration;
        }, 0) / successfulUpdates.length
      : 0;

    const lastUpdate = successfulUpdates.length > 0
      ? successfulUpdates[successfulUpdates.length - 1].appliedAt
      : null;

    const totalBandwidthUsed = this.updateHistory.reduce((sum, u) => sum + u.size, 0);

    return {
      totalUpdates: this.updateHistory.length,
      successfulUpdates: successful,
      failedUpdates: failed,
      pendingUpdates: pending,
      averageUpdateTime,
      lastUpdate,
      totalBandwidthUsed: totalBandwidthUsed,
    };
  }

  /**
   * Configure updater settings
   */
  configure(settings: Partial<UpdateConfig>): void {
    this.config = { ...this.config, ...settings };
  }

  // Private methods
  private initializeUpdater(): void {
    // Start automatic update checking
    if (this.config.autoCheck) {
      setInterval(() => {
        this.checkForUpdates();
      }, this.config.checkInterval * 60 * 1000);
    }

    // Process scheduled updates
    setInterval(() => {
      this.processScheduledUpdates();
    }, 60000); // Check every minute

    // Cleanup old notifications
    setInterval(() => {
      this.cleanupNotifications();
    }, 3600000); // Every hour

    // Load existing state
    this.loadState();
  }

  private async fetchUpdateManifest(): Promise<UpdateManifest> {
    // Simulate fetching update manifest
    return {
      version: '1.0.0',
      timestamp: new Date(),
      updates: [
        {
          id: 'update_1',
          contentId: 'content_1',
          type: 'content',
          version: '1.0.1',
          description: 'Add new educational content',
          changes: [
            {
              type: 'add',
              path: '/content/animals',
              description: 'Added new animal facts',
              impact: 'medium',
            },
          ],
          size: 1024 * 1024, // 1MB
          checksum: 'checksum_1',
          isRequired: false,
          priority: 'medium',
          status: 'pending',
        },
        {
          id: 'update_2',
          contentId: 'content_2',
          type: 'bugfix',
          version: '1.0.2',
          description: 'Fix loading issues',
          changes: [
            {
              type: 'modify',
              path: '/components/loader',
              description: 'Fixed loading animation',
              impact: 'low',
            },
          ],
          size: 512 * 1024, // 512KB
          checksum: 'checksum_2',
          isRequired: true,
          priority: 'high',
          status: 'pending',
        },
      ],
      checksum: 'manifest_checksum',
    };
  }

  private async filterAvailableUpdates(
    updates: ContentUpdate[],
    contentId?: string
  ): Promise<ContentUpdate[]> {
    // Filter out already installed updates
    const available = updates.filter(update => {
      if (contentId && update.contentId !== contentId) {
        return false;
      }

      const currentVersion = this.installedVersions.get(update.contentId);
      if (currentVersion && currentVersion === update.version) {
        return false;
      }

      return true;
    });

    // Sort by priority
    return available.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private async performDownload(update: ContentUpdate, progress: UpdateProgress): Promise<void> {
    try {
      // Simulate download process
      const totalSize = update.size;
      let downloaded = 0;
      const chunkSize = 1024 * 100; // 100KB chunks
      const startTime = Date.now();

      while (downloaded < totalSize) {
        // Simulate download chunk
        await new Promise(resolve => setTimeout(resolve, 100));

        downloaded = Math.min(downloaded + chunkSize, totalSize);
        const currentProgress = (downloaded / totalSize) * 100;
        const elapsedTime = (Date.now() - startTime) / 1000;
        const speed = downloaded / elapsedTime;

        progress.progress = currentProgress;
        progress.speed = speed;
        progress.estimatedTimeRemaining = (totalSize - downloaded) / speed;

        // Check bandwidth limit
        if (speed > this.config.bandwidthLimit) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Verify download
      if (this.config.verificationEnabled) {
        const verified = await this.verifyDownload(update);
        if (!verified) {
          throw new Error('Download verification failed');
        }
      }

      progress.stage = 'completed';

    } catch (error) {
      progress.stage = 'failed';
      progress.error = error instanceof Error ? error.message : 'Download failed';
      throw error;
    }
  }

  private async performInstallation(update: ContentUpdate, progress: UpdateProgress): Promise<boolean> {
    try {
      // Simulate installation process
      const totalSteps = 5;
      let currentStep = 0;

      while (currentStep < totalSteps) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        currentStep++;
        const currentProgress = (currentStep / totalSteps) * 100;

        progress.progress = currentProgress;
        progress.estimatedTimeRemaining = (totalSteps - currentStep) * 1000;
      }

      progress.stage = 'completed';

      return true;

    } catch (error) {
      progress.stage = 'failed';
      progress.error = error instanceof Error ? error.message : 'Installation failed';
      return false;
    }
  }

  private async performUpdateApplication(update: ContentUpdate): Promise<boolean> {
    // Simulate update application
    return Math.random() > 0.1; // 90% success rate
  }

  private async performRollback(contentId: string, version: string): Promise<boolean> {
    // Simulate rollback
    return Math.random() > 0.1; // 90% success rate
  }

  private async completeUpdate(update: ContentUpdate): Promise<void> {
    update.status = 'completed';
    update.appliedAt = new Date();

    this.updateQueue.delete(update.id);
    this.activeUpdates.delete(update.id);

    await this.notifyUpdateCompleted(update);
    await this.trackUpdateEvent(update, 'completed');
  }

  private async createBackup(contentId: string): Promise<void> {
    // Simulate backup creation
    console.log(`Creating backup for content ${contentId}`);
  }

  private async findRollbackVersion(contentId: string, currentVersion: string): Promise<string | null> {
    // Simulate finding rollback version
    const history = this.getUpdateHistory(contentId);
    const previousUpdate = history.find(u => u.version !== currentVersion);
    return previousUpdate?.version || null;
  }

  private async verifyDownload(update: ContentUpdate): Promise<boolean> {
    // Simulate verification
    return Math.random() > 0.1; // 90% success rate
  }

  private async cancelDownload(updateId: string): Promise<void> {
    // Simulate download cancellation
    console.log(`Cancelling download for update ${updateId}`);
  }

  private async cancelInstallation(updateId: string): Promise<void> {
    // Simulate installation cancellation
    console.log(`Cancelling installation for update ${updateId}`);
  }

  private async downloadUpdates(updates: ContentUpdate[]): Promise<void> {
    for (const update of updates) {
      if (update.priority === 'critical' || update.priority === 'high') {
        try {
          await this.downloadUpdate(update.id);
        } catch (error) {
          console.error(`Failed to download update ${update.id}:`, error);
        }
      }
    }
  }

  private async notifyUpdatesAvailable(updates: ContentUpdate[]): Promise<void> {
    if (!this.config.notificationEnabled) return;

    const notification: UpdateNotification = {
      id: this.generateNotificationId(),
      type: 'available',
      title: 'Updates Available',
      message: `${updates.length} new updates are available for download`,
      timestamp: new Date(),
      severity: 'info',
      actions: [
        {
          label: 'Download Now',
          action: () => this.downloadUpdates(updates),
          primary: true,
        },
        {
          label: 'View Details',
          action: () => console.log('View update details'),
          primary: false,
        },
      ],
    };

    this.notifications.push(notification);
  }

  private async notifyUpdateCompleted(update: ContentUpdate): Promise<void> {
    if (!this.config.notificationEnabled) return;

    const notification: UpdateNotification = {
      id: this.generateNotificationId(),
      type: 'completed',
      title: 'Update Completed',
      message: `Update ${update.version} has been successfully installed`,
      timestamp: new Date(),
      severity: 'success',
    };

    this.notifications.push(notification);
  }

  private async trackUpdateEvent(update: ContentUpdate, action: string): Promise<void> {
    // Track update analytics event
    console.log(`Tracking update event: ${action} for update ${update.id}`);
  }

  private async processScheduledUpdates(): Promise<void> {
    const now = new Date();
    const dueSchedules = Array.from(this.schedules.values()).filter(schedule =>
      schedule.isActive && schedule.scheduledAt <= now
    );

    for (const schedule of dueSchedules) {
      try {
        // Check for updates for scheduled content
        await this.checkForUpdates(schedule.contentId);

        // Handle recurring schedules
        if (schedule.isRecurring && schedule.recurringInterval) {
          schedule.scheduledAt = new Date(now.getTime() + schedule.recurringInterval * 60 * 60 * 1000);
        } else {
          schedule.isActive = false;
        }
      } catch (error) {
        console.error(`Failed to process scheduled update ${schedule.id}:`, error);
      }
    }
  }

  private cleanupNotifications(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7); // Remove notifications older than 7 days

    this.notifications = this.notifications.filter(n => n.timestamp > cutoff);
  }

  private loadState(): void {
    // Load saved state from storage
    try {
      const saved = localStorage.getItem('contentUpdaterState');
      if (saved) {
        const state = JSON.parse(saved);
        this.installedVersions = new Map(Object.entries(state.installedVersions || {}));
        this.updateHistory = state.updateHistory || [];
        this.schedules = new Map(Object.entries(state.schedules || {}));
      }
    } catch (error) {
      console.error('Failed to load updater state:', error);
    }
  }

  private saveState(): void {
    // Save current state to storage
    try {
      const state = {
        installedVersions: Object.fromEntries(this.installedVersions),
        updateHistory: this.updateHistory,
        schedules: Object.fromEntries(this.schedules),
      };
      localStorage.setItem('contentUpdaterState', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save updater state:', error);
    }
  }

  // Utility methods
  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createError(code: string, message: string, error?: any): ContentError {
    return {
      name: 'ContentUpdaterError',
      message,
      code,
      type: 'general',
      severity: 'high',
      recoverable: true,
      timestamp: new Date(),
      stack: error?.stack,
    } as ContentError;
  }
}

// Export singleton instance
export const contentUpdater = new ContentUpdater();

// Export utility functions
export const checkForUpdates = (contentId?: string) =>
  contentUpdater.checkForUpdates(contentId);
export const downloadUpdate = (updateId: string) =>
  contentUpdater.downloadUpdate(updateId);
export const installUpdate = (updateId: string) =>
  contentUpdater.installUpdate(updateId);
export const applyUpdate = (update: ContentUpdate) =>
  contentUpdater.applyUpdate(update);
export const rollbackUpdate = (contentId: string) =>
  contentUpdater.rollbackUpdate(contentId);
export const scheduleUpdate = (contentId: string, schedule: Omit<UpdateSchedule, 'id' | 'contentId' | 'isActive'>) =>
  contentUpdater.scheduleUpdate(contentId, schedule);
export const getUpdateProgress = (updateId?: string) =>
  contentUpdater.getUpdateProgress(updateId);
export const getUpdateHistory = (contentId?: string) =>
  contentUpdater.getUpdateHistory(contentId);
export const getNotifications = () =>
  contentUpdater.getNotifications();
export const dismissNotification = (notificationId: string) =>
  contentUpdater.dismissNotification(notificationId);
export const cancelUpdate = (updateId: string) =>
  contentUpdater.cancelUpdate(updateId);
export const getUpdateStats = () =>
  contentUpdater.getUpdateStats();