/**
 * Centralized Content Management System
 * Provides comprehensive content lifecycle management, caching, and optimization
 */

import {
  ContentMetadata,
  ContentUpdate,
  UpdateType,
  UpdatePriority,
  UpdateStatus,
  ContentValidation,
  ContentModeration,
  ModerationStatus,
  ContentBackup,
  BackupType,
  BackupScope,
  ContentABTest,
  ABTestStatus,
  ContentDistribution,
  ContentAnalytics,
  AnalyticsPeriod,
  ContentPersonalization,
  UserPreferences,
  LearningPath,
  ContentRecommendation,
  ContentEvent,
  ContentEventType,
  ContentError,
  ContentSearchOptions,
  ContentSearchResult,
  SearchSortOption,
  SearchFilter,
  SearchFacet,
  FacetOption,
  AgeRange,
  DifficultyLevel,
  ContentCategory,
  ContentStatus,
  ContentPerformance,
  PerformanceRecommendation,
} from '../types/content';

import { contentValidator } from './contentValidator';
import { contentAnalytics } from './contentAnalytics';
import { contentDistribution } from './contentDistribution';
import { ContentUpdater } from './contentUpdater';

interface ContentManagerConfig {
  storage: ContentStorage;
  validator: typeof contentValidator;
  analytics: typeof contentAnalytics;
  distribution: typeof contentDistribution;
  updater: ContentUpdater;
  cache: ContentCache;
  indexing: ContentIndexing;
  security: ContentSecurity;
  performance: ContentPerformance;
}

interface StorageOptions {
  compression: boolean;
  encryption: boolean;
  backupEnabled: boolean;
  cleanupInterval: number;
  retentionPeriod: number;
}

interface CacheOptions {
  enabled: boolean;
  maxSize: number;
  ttl: number;
  strategy: 'memory' | 'persistent' | 'hybrid';
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
}

interface IndexingOptions {
  enabled: boolean;
  searchFields: string[];
  facetFields: string[];
  autoIndex: boolean;
  refreshInterval: number;
}

interface SecurityOptions {
  encryptionEnabled: boolean;
  accessControl: boolean;
  auditLogging: boolean;
  rateLimiting: boolean;
  contentScanning: boolean;
}

interface PerformanceOptions {
  lazyLoading: boolean;
  prefetching: boolean;
  compression: boolean;
  caching: boolean;
  optimization: boolean;
}

export class ContentManager {
  private config: ContentManagerConfig;
  private storage: ContentStorage;
  private cache: ContentCache;
  private indexing: ContentIndexing;
  private security: ContentSecurity;
  private performance: ContentPerformance;
  private contentRegistry: Map<string, ContentMetadata> = new Map();
  private updateQueue: Map<string, ContentUpdate> = new Map();
  private activeTests: Map<string, ContentABTest> = new Map();
  private userPersonalization: Map<string, ContentPersonalization> = new Map();

  constructor(config?: Partial<ContentManagerConfig>) {
    this.initializeConfig(config);
    this.initializeComponents();
    this.startBackgroundProcesses();
  }

  /**
   * Add new content to the system
   */
  async addContent(content: Omit<ContentMetadata, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentMetadata> {
    try {
      // Generate metadata
      const fullContent: ContentMetadata = {
        ...content,
        id: this.generateContentId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'draft',
      };

      // Validate content
      const validation = await this.config.validator.validateContent(fullContent);
      if (validation.overallScore < 70) {
        throw this.createError('VALIDATION_FAILED', 'Content validation failed', { validation });
      }

      // Moderate content
      const moderation = await this.config.validator.moderateContent(fullContent);
      if (moderation.status === 'rejected') {
        throw this.createError('MODERATION_REJECTED', 'Content rejected by moderation', { moderation });
      }

      // Store content
      await this.storage.saveContent(fullContent);

      // Index content
      await this.indexing.indexContent(fullContent);

      // Cache content
      await this.cache.set(fullContent.id, fullContent);

      // Register content
      this.contentRegistry.set(fullContent.id, fullContent);

      // Track creation event
      await this.config.analytics.trackEvent({
        contentId: fullContent.id,
        sessionId: this.generateSessionId(),
        eventType: 'create',
        data: { validationScore: validation.overallScore, moderationScore: moderation.score.overall },
      });

      return fullContent;

    } catch (error) {
      throw this.createError('CONTENT_ADD_FAILED', 'Failed to add content', error);
    }
  }

  /**
   * Get content by ID
   */
  async getContent(contentId: string): Promise<ContentMetadata | null> {
    try {
      // Check cache first
      const cached = await this.cache.get<ContentMetadata>(contentId);
      if (cached) {
        return cached;
      }

      // Get from storage
      const content = await this.storage.getContent(contentId);
      if (!content) {
        return null;
      }

      // Update cache
      await this.cache.set(contentId, content);

      return content;

    } catch (error) {
      throw this.createError('CONTENT_GET_FAILED', 'Failed to get content', error);
    }
  }

  /**
   * Update content
   */
  async updateContent(
    contentId: string,
    updates: Partial<ContentMetadata>
  ): Promise<ContentMetadata> {
    try {
      const existing = await this.getContent(contentId);
      if (!existing) {
        throw this.createError('CONTENT_NOT_FOUND', 'Content not found');
      }

      // Create update record
      const update: ContentUpdate = {
        id: this.generateUpdateId(),
        contentId,
        type: 'content',
        version: this.generateVersion(),
        description: 'Content update',
        changes: this.generateChangeDescription(existing, updates),
        size: JSON.stringify(updates).length,
        checksum: this.generateChecksum(JSON.stringify(updates)),
        isRequired: false,
        priority: 'medium',
        status: 'pending',
      };

      // Apply updates
      const updated: ContentMetadata = {
        ...existing,
        ...updates,
        id: contentId,
        updatedAt: new Date(),
      };

      // Validate updated content
      const validation = await this.config.validator.validateContent(updated);
      if (validation.overallScore < 70) {
        throw this.createError('UPDATE_VALIDATION_FAILED', 'Updated content validation failed', { validation });
      }

      // Store update
      this.updateQueue.set(update.id, update);

      // Store updated content
      await this.storage.saveContent(updated);

      // Update cache
      await this.cache.set(contentId, updated);

      // Update registry
      this.contentRegistry.set(contentId, updated);

      // Update index
      await this.indexing.updateIndex(contentId, updated);

      // Track update event
      await this.config.analytics.trackEvent({
        contentId,
        sessionId: this.generateSessionId(),
        eventType: 'update',
        data: { updateId: update.id, validationScore: validation.overallScore },
      });

      return updated;

    } catch (error) {
      throw this.createError('CONTENT_UPDATE_FAILED', 'Failed to update content', error);
    }
  }

  /**
   * Delete content
   */
  async deleteContent(contentId: string): Promise<boolean> {
    try {
      const content = await this.getContent(contentId);
      if (!content) {
        return false;
      }

      // Archive content instead of permanent deletion
      const archived: ContentMetadata = {
        ...content,
        status: 'archived',
        updatedAt: new Date(),
      };

      await this.storage.saveContent(archived);
      await this.cache.delete(contentId);
      this.contentRegistry.delete(contentId);

      // Remove from index
      await this.indexing.removeFromIndex(contentId);

      // Track deletion event
      await this.config.analytics.trackEvent({
        contentId,
        sessionId: this.generateSessionId(),
        eventType: 'delete',
        data: { reason: 'user_delete' },
      });

      return true;

    } catch (error) {
      throw this.createError('CONTENT_DELETE_FAILED', 'Failed to delete content', error);
    }
  }

  /**
   * Search content
   */
  async searchContent(options: ContentSearchOptions): Promise<ContentSearchResult> {
    try {
      return await this.indexing.search(options);

    } catch (error) {
      throw this.createError('SEARCH_FAILED', 'Failed to search content', error);
    }
  }

  /**
   * Get content recommendations for user
   */
  async getRecommendations(userId: string, context?: any): Promise<ContentRecommendation[]> {
    try {
      // Get user personalization data
      let personalization = this.userPersonalization.get(userId);
      if (!personalization) {
        personalization = await this.createPersonalization(userId);
        this.userPersonalization.set(userId, personalization);
      }

      // Get analytics-based recommendations
      const analyticsRecommendations = await this.config.analytics.getRecommendations(userId, context);

      // Get personalization-based recommendations
      const personalizationRecommendations = await this.getPersonalizationRecommendations(personalization);

      // Combine and rank recommendations
      const combined = this.combineRecommendations(analyticsRecommendations, personalizationRecommendations);

      return combined.slice(0, 10);

    } catch (error) {
      throw this.createError('RECOMMENDATIONS_FAILED', 'Failed to get recommendations', error);
    }
  }

  /**
   * Get user learning path
   */
  async getLearningPath(userId: string, categoryId?: string): Promise<LearningPath> {
    try {
      const personalization = this.userPersonalization.get(userId);
      if (!personalization) {
        personalization = await this.createPersonalization(userId);
        this.userPersonalization.set(userId, personalization);
      }

      if (personalization.learningPath) {
        return personalization.learningPath;
      }

      // Generate new learning path
      const learningPath = await this.generateLearningPath(userId, categoryId);
      personalization.learningPath = learningPath;

      await this.storage.savePersonalization(userId, personalization);

      return learningPath;

    } catch (error) {
      throw this.createError('LEARNING_PATH_FAILED', 'Failed to get learning path', error);
    }
  }

  /**
   * Track content usage
   */
  async trackUsage(event: Omit<ContentEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      await this.config.analytics.trackEvent(event);

      // Update user personalization based on usage
      if (event.userId) {
        await this.updatePersonalizationFromUsage(event);
      }

    } catch (error) {
      console.error('Failed to track usage:', error);
    }
  }

  /**
   * Get content analytics
   */
  async getAnalytics(contentId: string, period: AnalyticsPeriod = 'daily'): Promise<ContentAnalytics> {
    try {
      return await this.config.analytics.getContentAnalytics(contentId, period);

    } catch (error) {
      throw this.createError('ANALYTICS_FAILED', 'Failed to get analytics', error);
    }
  }

  /**
   * Get content distribution info
   */
  async getDistribution(contentId: string): Promise<ContentDistribution> {
    try {
      const metrics = await this.config.distribution.getDistributionMetrics(contentId);
      return this.config.distribution.getDistributionConfig();

    } catch (error) {
      throw this.createError('DISTRIBUTION_FAILED', 'Failed to get distribution info', error);
    }
  }

  /**
   * Create A/B test
   */
  async createABTest(test: Omit<ContentABTest, 'id' | 'startDate'>): Promise<ContentABTest> {
    try {
      const fullTest: ContentABTest = {
        ...test,
        id: this.generateTestId(),
        startDate: new Date(),
      };

      // Validate test
      const validationResult = await this.validateABTest(fullTest);
      if (!validationResult.valid) {
        throw this.createError('TEST_VALIDATION_FAILED', 'A/B test validation failed', validationResult);
      }

      // Store test
      this.activeTests.set(fullTest.id, fullTest);
      await this.storage.saveABTest(fullTest);

      return fullTest;

    } catch (error) {
      throw this.createError('TEST_CREATE_FAILED', 'Failed to create A/B test', error);
    }
  }

  /**
   * Get content backup
   */
  async createBackup(type: BackupType = 'full', scope: BackupScope = 'content'): Promise<ContentBackup> {
    try {
      const backup: ContentBackup = {
        id: this.generateBackupId(),
        timestamp: new Date(),
        type,
        scope,
        size: 0,
        checksum: '',
        location: '',
        compressionRatio: 0,
        encryption: this.security.encryptionEnabled,
        verification: {
          status: 'pending',
          errors: [],
          warnings: [],
          integrityCheck: false,
        },
        retention: {
          policy: 'keep-period',
          maxBackups: 10,
          retentionPeriod: 30,
          autoDelete: true,
        },
      };

      // Create backup
      const backupData = await this.storage.createBackup(type, scope);
      backup.size = backupData.size;
      backup.checksum = backupData.checksum;
      backup.location = backupData.location;
      backup.compressionRatio = backupData.compressionRatio;

      // Verify backup
      const verification = await this.storage.verifyBackup(backup.id);
      backup.verification = verification;

      return backup;

    } catch (error) {
      throw this.createError('BACKUP_FAILED', 'Failed to create backup', error);
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string): Promise<boolean> {
    try {
      const backup = await this.storage.getBackup(backupId);
      if (!backup) {
        throw this.createError('BACKUP_NOT_FOUND', 'Backup not found');
      }

      // Perform restore
      const result = await this.storage.restoreBackup(backupId);

      // Rebuild indexes
      await this.indexing.rebuildIndex();

      // Clear cache
      await this.cache.clear();

      return result;

    } catch (error) {
      throw this.createError('RESTORE_FAILED', 'Failed to restore from backup', error);
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      storage: 'healthy' | 'degraded' | 'unhealthy';
      cache: 'healthy' | 'degraded' | 'unhealthy';
      indexing: 'healthy' | 'degraded' | 'unhealthy';
      security: 'healthy' | 'degraded' | 'unhealthy';
      distribution: 'healthy' | 'degraded' | 'unhealthy';
    };
    metrics: {
      totalContent: number;
      activeUsers: number;
      cacheHitRate: number;
      averageResponseTime: number;
    };
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const components = {
        storage: await this.storage.getHealth(),
        cache: await this.cache.getHealth(),
        indexing: await this.indexing.getHealth(),
        security: await this.security.getHealth(),
        distribution: await this.config.distribution.getHealthStatus(),
      };

      const componentStatuses = Object.values(components);
      const healthyCount = componentStatuses.filter(status => status === 'healthy').length;
      const totalCount = componentStatuses.length;

      let overall: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyCount / totalCount >= 0.8) {
        overall = 'healthy';
      } else if (healthyCount / totalCount >= 0.5) {
        overall = 'degraded';
      } else {
        overall = 'unhealthy';
      }

      const metrics = await this.getSystemMetrics();
      const issues = this.identifyHealthIssues(components);
      const recommendations = this.generateHealthRecommendations(components, issues);

      return {
        overall,
        components,
        metrics,
        issues,
        recommendations,
      };

    } catch (error) {
      throw this.createError('HEALTH_CHECK_FAILED', 'Failed to get health status', error);
    }
  }

  // Private methods
  private initializeConfig(config?: Partial<ContentManagerConfig>): void {
    this.config = {
      storage: new ContentStorage(),
      validator: contentValidator,
      analytics: contentAnalytics,
      distribution: contentDistribution,
      updater: new ContentUpdater(),
      cache: new ContentCache(),
      indexing: new ContentIndexing(),
      security: new ContentSecurity(),
      performance: new ContentPerformance(),
      ...config,
    };
  }

  private initializeComponents(): void {
    // Initialize components with configuration
    this.storage = this.config.storage;
    this.cache = this.config.cache;
    this.indexing = this.config.indexing;
    this.security = this.config.security;
    this.performance = this.config.performance;

    // Load existing content
    this.loadExistingContent();
  }

  private async loadExistingContent(): Promise<void> {
    try {
      const existingContent = await this.storage.getAllContent();
      existingContent.forEach(content => {
        this.contentRegistry.set(content.id, content);
      });
    } catch (error) {
      console.error('Failed to load existing content:', error);
    }
  }

  private startBackgroundProcesses(): void {
    // Periodic content updates
    setInterval(() => {
      this.processPendingUpdates();
    }, 60000); // Every minute

    // Periodic cache cleanup
    setInterval(() => {
      this.cache.cleanup();
    }, 300000); // Every 5 minutes

    // Periodic index optimization
    setInterval(() => {
      this.indexing.optimize();
    }, 3600000); // Every hour

    // Periodic health checks
    setInterval(async () => {
      await this.performHealthChecks();
    }, 300000); // Every 5 minutes
  }

  private async processPendingUpdates(): Promise<void> {
    const updates = Array.from(this.updateQueue.values()).filter(u => u.status === 'pending');

    for (const update of updates) {
      try {
        await this.config.updater.applyUpdate(update);
        update.status = 'completed';
        update.appliedAt = new Date();
      } catch (error) {
        update.status = 'failed';
        console.error(`Failed to apply update ${update.id}:`, error);
      }
    }
  }

  private async performHealthChecks(): Promise<void> {
    try {
      const health = await this.getHealthStatus();
      if (health.overall === 'unhealthy') {
        console.warn('System health degraded:', health.issues);
      }
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  private async createPersonalization(userId: string): Promise<ContentPersonalization> {
    return {
      userId,
      preferences: await this.getUserPreferences(userId),
      learningPath: null,
      recommendations: [],
      adaptiveContent: {
        enabled: true,
        difficultyAdjustment: true,
        pacingAdjustment: true,
        contentVariation: true,
        feedbackStyle: 'encouraging',
      },
    };
  }

  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    // Get from storage or create default
    const stored = await this.storage.getUserPreferences(userId);
    if (stored) {
      return stored;
    }

    return {
      favoriteCategories: ['animals', 'science'],
      preferredDifficulty: 'easy',
      interests: ['learning', 'games'],
      learningStyle: 'mixed',
      sessionDuration: 20,
      contentLanguage: 'en',
      accessibility: {
        fontSize: 'medium',
        highContrast: false,
        screenReader: false,
        subtitles: true,
        simplifiedInterface: false,
        reducedMotion: false,
      },
    };
  }

  private async getPersonalizationRecommendations(personalization: ContentPersonalization): Promise<ContentRecommendation[]> {
    // Generate recommendations based on user preferences
    const recommendations: ContentRecommendation[] = [];

    // Category-based recommendations
    for (const category of personalization.preferences.favoriteCategories) {
      const searchResults = await this.searchContent({
        categories: [category as ContentCategory],
        difficulty: personalization.preferences.preferredDifficulty,
        limit: 5,
      });

      searchResults.items.forEach(content => {
        recommendations.push({
          contentId: content.id,
          reason: `Matches your interest in ${category}`,
          confidence: 0.8,
          personalizedScore: 0.75,
          category,
          tags: content.tags,
        });
      });
    }

    return recommendations;
  }

  private combineRecommendations(
    analyticsRecs: ContentRecommendation[],
    personalizationRecs: ContentRecommendation[]
  ): ContentRecommendation[] {
    const combined = [...analyticsRecs, ...personalizationRecs];

    // Remove duplicates
    const unique = combined.filter((rec, index, self) =>
      index === self.findIndex(r => r.contentId === rec.contentId)
    );

    // Sort by personalized score
    return unique.sort((a, b) => b.personalizedScore - a.personalizedScore);
  }

  private async generateLearningPath(userId: string, categoryId?: string): Promise<LearningPath> {
    const searchOptions: ContentSearchOptions = {
      categories: categoryId ? [categoryId as ContentCategory] : undefined,
      difficulty: 'easy' as DifficultyLevel,
      limit: 10,
    };

    const content = await this.searchContent(searchOptions);

    return {
      id: this.generatePathId(),
      name: categoryId ? `${categoryId} Learning Path` : 'General Learning Path',
      description: 'Personalized learning path based on your preferences',
      levels: content.items.map((item, index) => ({
        id: `level_${index}`,
        name: `Level ${index + 1}`,
        description: item.description,
        contentIds: [item.id],
        isCompleted: false,
        progress: 0,
        timeSpent: 0,
      })),
      progress: 0,
      estimatedCompletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
  }

  private async updatePersonalizationFromUsage(event: ContentEvent): Promise<void> {
    const personalization = this.userPersonalization.get(event.userId);
    if (!personalization) return;

    // Update preferences based on usage patterns
    if (event.eventType === 'complete') {
      const content = await this.getContent(event.contentId);
      if (content) {
        // Update difficulty preference based on successful completion
        if (content.difficulty !== personalization.preferences.preferredDifficulty) {
          personalization.preferences.preferredDifficulty = content.difficulty;
        }

        // Update favorite categories
        if (!personalization.preferences.favoriteCategories.includes(content.category)) {
          personalization.preferences.favoriteCategories.push(content.category);
        }
      }
    }

    await this.storage.savePersonalization(event.userId, personalization);
  }

  private async validateABTest(test: ContentABTest): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (test.variants.length < 2) {
      errors.push('A/B test must have at least 2 variants');
    }

    if (test.variants.reduce((sum, v) => sum + v.trafficAllocation, 0) !== 100) {
      errors.push('Traffic allocation must sum to 100%');
    }

    const controlVariants = test.variants.filter(v => v.isControl);
    if (controlVariants.length !== 1) {
      errors.push('A/B test must have exactly 1 control variant');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private generateChangeDescription(
    original: ContentMetadata,
    updates: Partial<ContentMetadata>
  ): any[] {
    const changes: any[] = [];

    Object.keys(updates).forEach(key => {
      if (original[key as keyof ContentMetadata] !== updates[key as keyof ContentMetadata]) {
        changes.push({
          type: 'modify',
          path: key,
          description: `Updated ${key}`,
          impact: 'medium',
        });
      }
    });

    return changes;
  }

  private async getSystemMetrics(): Promise<{
    totalContent: number;
    activeUsers: number;
    cacheHitRate: number;
    averageResponseTime: number;
  }> {
    return {
      totalContent: this.contentRegistry.size,
      activeUsers: this.userPersonalization.size,
      cacheHitRate: await this.cache.getHitRate(),
      averageResponseTime: await this.performance.getAverageResponseTime(),
    };
  }

  private identifyHealthIssues(components: any): string[] {
    const issues: string[] = [];

    Object.entries(components).forEach(([component, status]) => {
      if (status === 'unhealthy') {
        issues.push(`${component} is unhealthy`);
      } else if (status === 'degraded') {
        issues.push(`${component} is degraded`);
      }
    });

    return issues;
  }

  private generateHealthRecommendations(components: any, issues: string[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.includes('unhealthy'))) {
      recommendations.push('Immediate attention required for unhealthy components');
    }

    if (components.cache === 'degraded') {
      recommendations.push('Consider increasing cache size or adjusting eviction policy');
    }

    if (components.storage === 'degraded') {
      recommendations.push('Check storage capacity and performance');
    }

    if (components.indexing === 'degraded') {
      recommendations.push('Rebuild search indexes');
    }

    return recommendations;
  }

  // Utility methods
  private generateContentId(): string {
    return `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVersion(): string {
    return `${Date.now()}.${Math.random().toString(36).substr(2, 5)}`;
  }

  private generateChecksum(data: string): string {
    // Simple checksum implementation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePathId(): string {
    return `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createError(code: string, message: string, error?: any): ContentError {
    return {
      name: 'ContentManagerError',
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

// Supporting component classes
class ContentStorage {
  async saveContent(content: ContentMetadata): Promise<void> {
    // Implementation would save to database
    localStorage.setItem(`content_${content.id}`, JSON.stringify(content));
  }

  async getContent(contentId: string): Promise<ContentMetadata | null> {
    const data = localStorage.getItem(`content_${contentId}`);
    return data ? JSON.parse(data) : null;
  }

  async getAllContent(): Promise<ContentMetadata[]> {
    const content: ContentMetadata[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('content_')) {
        const data = localStorage.getItem(key);
        if (data) {
          content.push(JSON.parse(data));
        }
      }
    }
    return content;
  }

  async savePersonalization(userId: string, personalization: ContentPersonalization): Promise<void> {
    localStorage.setItem(`personalization_${userId}`, JSON.stringify(personalization));
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const data = localStorage.getItem(`personalization_${userId}`);
    return data ? JSON.parse(data).preferences : null;
  }

  async saveABTest(test: ContentABTest): Promise<void> {
    localStorage.setItem(`test_${test.id}`, JSON.stringify(test));
  }

  async createBackup(type: BackupType, scope: BackupScope): Promise<any> {
    return {
      size: 1024 * 1024,
      checksum: 'backup_checksum',
      location: '/backups/backup.json',
      compressionRatio: 0.7,
    };
  }

  async getBackup(backupId: string): Promise<ContentBackup | null> {
    // Implementation would retrieve backup
    return null;
  }

  async verifyBackup(backupId: string): Promise<any> {
    return {
      status: 'success',
      errors: [],
      warnings: [],
      integrityCheck: true,
    };
  }

  async restoreBackup(backupId: string): Promise<boolean> {
    // Implementation would restore from backup
    return true;
  }

  async getHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    return 'healthy';
  }
}

class ContentCache {
  private cache: Map<string, { data: any; timestamp: Date; ttl: number }> = new Map();
  private hits = 0;
  private misses = 0;

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = new Date();
    const age = (now.getTime() - entry.timestamp.getTime()) / 1000;

    if (age > entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data;
  }

  async set(key: string, data: any, ttl: number = 3600): Promise<void> {
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      ttl,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async cleanup(): Promise<void> {
    const now = new Date();
    this.cache.forEach((entry, key) => {
      const age = (now.getTime() - entry.timestamp.getTime()) / 1000;
      if (age > entry.ttl) {
        this.cache.delete(key);
      }
    });
  }

  async getHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    return this.cache.size < 1000 ? 'healthy' : 'degraded';
  }

  async getHitRate(): Promise<number> {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }
}

class ContentIndexing {
  private index: Map<string, ContentMetadata[]> = new Map();

  async indexContent(content: ContentMetadata): Promise<void> {
    // Index by category
    if (!this.index.has(content.category)) {
      this.index.set(content.category, []);
    }
    this.index.get(content.category)!.push(content);

    // Index by tags
    content.tags.forEach(tag => {
      if (!this.index.has(`tag_${tag}`)) {
        this.index.set(`tag_${tag}`, []);
      }
      this.index.get(`tag_${tag}`)!.push(content);
    });
  }

  async updateIndex(contentId: string, content: ContentMetadata): Promise<void> {
    // Remove old entries and re-add
    this.removeFromIndex(contentId);
    await this.indexContent(content);
  }

  async removeFromIndex(contentId: string): Promise<void> {
    this.index.forEach((contents, key) => {
      const filtered = contents.filter(c => c.id !== contentId);
      if (filtered.length === 0) {
        this.index.delete(key);
      } else {
        this.index.set(key, filtered);
      }
    });
  }

  async search(options: ContentSearchOptions): Promise<ContentSearchResult> {
    let results: ContentMetadata[] = [];

    // Search by category
    if (options.categories?.length) {
      options.categories.forEach(category => {
        const categoryResults = this.index.get(category) || [];
        results = results.concat(categoryResults);
      });
    }

    // Search by tags
    if (options.tags?.length) {
      options.tags.forEach(tag => {
        const tagResults = this.index.get(`tag_${tag}`) || [];
        results = results.concat(tagResults);
      });
    }

    // Remove duplicates
    const unique = results.filter((item, index, self) =>
      index === self.findIndex(i => i.id === item.id)
    );

    // Apply filters
    let filtered = unique;
    if (options.ageRange) {
      filtered = filtered.filter(content =>
        content.ageRange.min >= options.ageRange!.min &&
        content.ageRange.max <= options.ageRange!.max
      );
    }

    if (options.difficulty) {
      filtered = filtered.filter(content => content.difficulty === options.difficulty);
    }

    // Sort results
    if (options.sortBy) {
      filtered = this.sortResults(filtered, options.sortBy, options.sortOrder || 'desc');
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    const paginated = filtered.slice(offset, offset + limit);

    // Generate facets
    const facets = this.generateFacets(filtered);

    return {
      items: paginated,
      total: filtered.length,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      facets,
      suggestions: this.generateSuggestions(options.query || ''),
    };
  }

  async rebuildIndex(): Promise<void> {
    this.index.clear();
    // Implementation would rebuild from storage
  }

  async optimize(): Promise<void> {
    // Clean up unused indexes
  }

  async getHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    return 'healthy';
  }

  private sortResults(
    results: ContentMetadata[],
    sortBy: SearchSortOption,
    sortOrder: 'asc' | 'desc'
  ): ContentMetadata[] {
    const sorted = [...results];

    switch (sortBy) {
      case 'popularity':
        return sorted.sort((a, b) =>
          sortOrder === 'desc' ? b.viewCount - a.viewCount : a.viewCount - b.viewCount
        );
      case 'rating':
        return sorted.sort((a, b) =>
          sortOrder === 'desc' ? b.rating.average - a.rating.average : a.rating.average - b.rating.average
        );
      case 'date':
        return sorted.sort((a, b) =>
          sortOrder === 'desc' ? b.updatedAt.getTime() - a.updatedAt.getTime() : a.updatedAt.getTime() - b.updatedAt.getTime()
        );
      case 'title':
        return sorted.sort((a, b) =>
          sortOrder === 'desc' ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title)
        );
      default:
        return sorted;
    }
  }

  private generateFacets(results: ContentMetadata[]): SearchFacet[] {
    const categoryCount = new Map<string, number>();
    const difficultyCount = new Map<string, number>();

    results.forEach(content => {
      categoryCount.set(content.category, (categoryCount.get(content.category) || 0) + 1);
      difficultyCount.set(content.difficulty, (difficultyCount.get(content.difficulty) || 0) + 1);
    });

    return [
      {
        field: 'category',
        label: 'Category',
        options: Array.from(categoryCount.entries()).map(([value, count]) => ({
          value,
          label: value,
          count,
          selected: false,
        })),
      },
      {
        field: 'difficulty',
        label: 'Difficulty',
        options: Array.from(difficultyCount.entries()).map(([value, count]) => ({
          value,
          label: value,
          count,
          selected: false,
        })),
      },
    ];
  }

  private generateSuggestions(query: string): string[] {
    if (!query) return [];
    // Generate search suggestions based on query
    return [
      `${query} for kids`,
      `${query} educational`,
      `${query} learning`,
    ];
  }
}

class ContentSecurity {
  encryptionEnabled = true;
  accessControl = true;
  auditLogging = true;
  rateLimiting = true;
  contentScanning = true;

  async getHealth(): Promise<'healthy' | 'degraded' | 'unhealthy'> {
    return 'healthy';
  }
}

class ContentPerformance {
  private responseTimes: number[] = [];

  async getAverageResponseTime(): Promise<number> {
    if (this.responseTimes.length === 0) return 0;
    return this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
  }
}

// Export singleton instance
export const contentManager = new ContentManager();

// Export utility functions
export const addContent = (content: Omit<ContentMetadata, 'id' | 'createdAt' | 'updatedAt'>) =>
  contentManager.addContent(content);
export const getContent = (contentId: string) =>
  contentManager.getContent(contentId);
export const updateContent = (contentId: string, updates: Partial<ContentMetadata>) =>
  contentManager.updateContent(contentId, updates);
export const deleteContent = (contentId: string) =>
  contentManager.deleteContent(contentId);
export const searchContent = (options: ContentSearchOptions) =>
  contentManager.searchContent(options);
export const getRecommendations = (userId: string, context?: any) =>
  contentManager.getRecommendations(userId, context);
export const getLearningPath = (userId: string, categoryId?: string) =>
  contentManager.getLearningPath(userId, categoryId);
export const trackUsage = (event: Omit<ContentEvent, 'id' | 'timestamp'>) =>
  contentManager.trackUsage(event);
export const getAnalytics = (contentId: string, period?: AnalyticsPeriod) =>
  contentManager.getAnalytics(contentId, period);
export const getDistribution = (contentId: string) =>
  contentManager.getDistribution(contentId);
export const createABTest = (test: Omit<ContentABTest, 'id' | 'startDate'>) =>
  contentManager.createABTest(test);
export const createBackup = (type?: BackupType, scope?: BackupScope) =>
  contentManager.createBackup(type, scope);
export const restoreFromBackup = (backupId: string) =>
  contentManager.restoreFromBackup(backupId);
export const getHealthStatus = () =>
  contentManager.getHealthStatus();