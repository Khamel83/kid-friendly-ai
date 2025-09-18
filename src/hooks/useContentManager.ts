/**
 * React Hooks for Content Management
 * Provides comprehensive hooks for content operations, state management, and user interactions
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ContentMetadata,
  ContentUpdate,
  ContentAnalytics,
  AnalyticsPeriod,
  ContentRecommendation,
  ContentPersonalization,
  UserPreferences,
  LearningPath,
  ContentEvent,
  ContentEventType,
  ContentSearchOptions,
  ContentSearchResult,
  SearchSortOption,
  ContentCategory,
  DifficultyLevel,
  AgeRange,
  ContentStatus,
  ContentABTest,
  ContentBackup,
  BackupType,
  BackupScope,
  ContentError,
} from '../types/content';

import {
  contentManager,
  addContent,
  getContent,
  updateContent,
  deleteContent,
  searchContent,
  getRecommendations,
  getLearningPath,
  trackUsage,
  getAnalytics,
  getDistribution,
  createABTest,
  createBackup,
  restoreFromBackup,
  getHealthStatus,
} from '../utils/contentManager';

import {
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  rollbackUpdate,
  getUpdateProgress,
  getUpdateHistory,
  getNotifications,
  dismissNotification,
  cancelUpdate,
  getUpdateStats,
} from '../utils/contentUpdater';

import {
  getContentUrl,
  preloadContent,
  streamContent,
  getDistributionMetrics,
  optimizeDelivery,
  getHealthStatus as getDistributionHealth,
  testDeliveryPerformance,
} from '../utils/contentDistribution';

import {
  getContentAnalytics,
  getUserAnalytics,
  getPlatformAnalytics,
  getRecommendations as getAnalyticsRecommendations,
  getPerformanceInsights,
  exportAnalytics,
  getRealTimeAnalytics,
} from '../utils/contentAnalytics';

import {
  validateContent,
  moderateContent,
  generateQualityScore,
  autoFixContent,
} from '../utils/contentValidator';

// Hook interfaces
interface UseContentOptions {
  autoLoad?: boolean;
  refreshInterval?: number;
  cacheKey?: string;
}

interface UseSearchOptions {
  debounceMs?: number;
  pageSize?: number;
  enableFacets?: boolean;
}

interface UseUpdateOptions {
  autoCheck?: boolean;
  autoDownload?: boolean;
  autoInstall?: boolean;
  notifyOnComplete?: boolean;
}

interface UseAnalyticsOptions {
  realTime?: boolean;
  detailed?: boolean;
  includeRecommendations?: boolean;
}

interface UsePersonalizationOptions {
  userId?: string;
  autoUpdate?: boolean;
  enableLearningPath?: boolean;
}

// Main content management hook
export function useContentManager() {
  const [content, setContent] = useState<ContentMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ContentError | null>(null);
  const [selectedContent, setSelectedContent] = useState<ContentMetadata | null>(null);

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all content (in a real app, this would be paginated)
      const searchResult = await searchContent({
        limit: 100,
        sortBy: 'date',
        sortOrder: 'desc',
      });

      setContent(searchResult.items);

    } catch (err) {
      setError(err as ContentError);
    } finally {
      setLoading(false);
    }
  }, []);

  const addNewContent = useCallback(async (contentData: Omit<ContentMetadata, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(true);
      const newContent = await addContent(contentData);
      setContent(prev => [newContent, ...prev]);
      return newContent;
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateExistingContent = useCallback(async (contentId: string, updates: Partial<ContentMetadata>) => {
    try {
      setLoading(true);
      const updatedContent = await updateContent(contentId, updates);
      setContent(prev => prev.map(c => c.id === contentId ? updatedContent : c));
      if (selectedContent?.id === contentId) {
        setSelectedContent(updatedContent);
      }
      return updatedContent;
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedContent]);

  const deleteExistingContent = useCallback(async (contentId: string) => {
    try {
      setLoading(true);
      const success = await deleteContent(contentId);
      if (success) {
        setContent(prev => prev.filter(c => c.id !== contentId));
        if (selectedContent?.id === contentId) {
          setSelectedContent(null);
        }
      }
      return success;
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedContent]);

  const selectContent = useCallback((contentId: string | null) => {
    if (!contentId) {
      setSelectedContent(null);
      return;
    }

    const contentItem = content.find(c => c.id === contentId);
    setSelectedContent(contentItem || null);
  }, [content]);

  return {
    content,
    loading,
    error,
    selectedContent,
    actions: {
      loadContent,
      addContent: addNewContent,
      updateContent: updateExistingContent,
      deleteContent: deleteExistingContent,
      selectContent,
    },
  };
}

// Individual content hook
export function useContent(contentId: string, options: UseContentOptions = {}) {
  const [content, setContent] = useState<ContentMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ContentError | null>(null);
  const [analytics, setAnalytics] = useState<ContentAnalytics | null>(null);
  const [distribution, setDistribution] = useState<any>(null);

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const contentData = await getContent(contentId);
      setContent(contentData);

      if (contentData) {
        const [analyticsData, distributionData] = await Promise.all([
          getAnalytics(contentId),
          getDistribution(contentId),
        ]);

        setAnalytics(analyticsData);
        setDistribution(distributionData);
      }

    } catch (err) {
      setError(err as ContentError);
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    if (options.autoLoad !== false) {
      loadContent();
    }
  }, [loadContent, options.autoLoad]);

  useEffect(() => {
    if (options.refreshInterval) {
      const interval = setInterval(loadContent, options.refreshInterval);
      return () => clearInterval(interval);
    }
  }, [loadContent, options.refreshInterval]);

  return {
    content,
    loading,
    error,
    analytics,
    distribution,
    refresh: loadContent,
  };
}

// Content search hook
export function useContentSearch(initialOptions: Partial<ContentSearchOptions> = {}, hookOptions: UseSearchOptions = {}) {
  const [results, setResults] = useState<ContentSearchResult>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    facets: [],
    suggestions: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ContentError | null>(null);
  const [searchOptions, setSearchOptions] = useState<ContentSearchOptions>({
    limit: hookOptions.pageSize || 20,
    offset: 0,
    sortBy: 'relevance' as SearchSortOption,
    sortOrder: 'desc',
    ...initialOptions,
  });

  const searchTimeout = useRef<NodeJS.Timeout>();

  const performSearch = useCallback(async (options: ContentSearchOptions = searchOptions) => {
    try {
      setLoading(true);
      setError(null);

      const searchResult = await searchContent(options);
      setResults(searchResult);

    } catch (err) {
      setError(err as ContentError);
    } finally {
      setLoading(false);
    }
  }, [searchOptions]);

  const debouncedSearch = useCallback((options: ContentSearchOptions) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      performSearch(options);
    }, hookOptions.debounceMs || 300);
  }, [performSearch, hookOptions.debounceMs]);

  const updateSearchOptions = useCallback((updates: Partial<ContentSearchOptions>) => {
    const newOptions = { ...searchOptions, ...updates };
    setSearchOptions(newOptions);
    debouncedSearch(newOptions);
  }, [searchOptions, debouncedSearch]);

  const nextPage = useCallback(() => {
    const newOffset = searchOptions.offset! + searchOptions.limit!;
    updateSearchOptions({ offset: newOffset });
  }, [searchOptions, updateSearchOptions]);

  const previousPage = useCallback(() => {
    const newOffset = Math.max(0, searchOptions.offset! - searchOptions.limit!);
    updateSearchOptions({ offset: newOffset });
  }, [searchOptions, updateSearchOptions]);

  const goToPage = useCallback((page: number) => {
    const newOffset = (page - 1) * searchOptions.limit!;
    updateSearchOptions({ offset: newOffset });
  }, [searchOptions, updateSearchOptions]);

  const clearSearch = useCallback(() => {
    setSearchOptions({
      limit: hookOptions.pageSize || 20,
      offset: 0,
      sortBy: 'relevance' as SearchSortOption,
      sortOrder: 'desc',
    });
    setResults({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      facets: [],
      suggestions: [],
    });
  }, [hookOptions.pageSize]);

  const filterByCategory = useCallback((categories: ContentCategory[]) => {
    updateSearchOptions({ categories, offset: 0 });
  }, [updateSearchOptions]);

  const filterByDifficulty = useCallback((difficulty: DifficultyLevel) => {
    updateSearchOptions({ difficulty, offset: 0 });
  }, [updateSearchOptions]);

  const filterByAgeRange = useCallback((ageRange: AgeRange) => {
    updateSearchOptions({ ageRange, offset: 0 });
  }, [updateSearchOptions]);

  const sortBy = useCallback((sortBy: SearchSortOption, sortOrder: 'asc' | 'desc' = 'desc') => {
    updateSearchOptions({ sortBy, sortOrder, offset: 0 });
  }, [updateSearchOptions]);

  return {
    results,
    loading,
    error,
    searchOptions,
    actions: {
      search: performSearch,
      updateSearchOptions,
      nextPage,
      previousPage,
      goToPage,
      clearSearch,
      filterByCategory,
      filterByDifficulty,
      filterByAgeRange,
      sortBy,
    },
    pagination: {
      currentPage: Math.floor(searchOptions.offset! / searchOptions.limit!) + 1,
      totalPages: Math.ceil(results.total / searchOptions.limit!),
      hasNext: searchOptions.offset! + searchOptions.limit! < results.total,
      hasPrevious: searchOptions.offset! > 0,
    },
  };
}

// Content recommendations hook
export function useContentRecommendations(userId: string, options: UsePersonalizationOptions = {}) {
  const [recommendations, setRecommendations] = useState<ContentRecommendation[]>([]);
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [personalization, setPersonalization] = useState<ContentPersonalization | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ContentError | null>(null);

  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [recs, path] = await Promise.all([
        getRecommendations(userId),
        getLearningPath(userId),
      ]);

      setRecommendations(recs);
      setLearningPath(path);

    } catch (err) {
      setError(err as ContentError);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updatePreferences = useCallback(async (preferences: Partial<UserPreferences>) => {
    try {
      setLoading(true);
      // In a real implementation, this would update user preferences
      // and reload recommendations
      await loadRecommendations();
    } catch (err) {
      setError(err as ContentError);
    } finally {
      setLoading(false);
    }
  }, [loadRecommendations]);

  const completeLearningLevel = useCallback(async (levelId: string) => {
    try {
      setLoading(true);
      // In a real implementation, this would mark the level as complete
      // and update the learning path
      if (learningPath) {
        const updatedPath = { ...learningPath };
        const level = updatedPath.levels.find(l => l.id === levelId);
        if (level) {
          level.isCompleted = true;
          level.progress = 100;
          setLearningPath(updatedPath);
        }
      }
    } catch (err) {
      setError(err as ContentError);
    } finally {
      setLoading(false);
    }
  }, [learningPath]);

  useEffect(() => {
    if (options.autoUpdate !== false) {
      loadRecommendations();
    }
  }, [loadRecommendations, options.autoUpdate]);

  return {
    recommendations,
    learningPath,
    personalization,
    loading,
    error,
    actions: {
      refresh: loadRecommendations,
      updatePreferences,
      completeLearningLevel,
    },
  };
}

// Content updates hook
export function useContentUpdates(options: UseUpdateOptions = {}) {
  const [updates, setUpdates] = useState<ContentUpdate[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ContentError | null>(null);

  const checkForContentUpdates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const availableUpdates = await checkForUpdates();
      setUpdates(availableUpdates);

      if (options.autoDownload && availableUpdates.length > 0) {
        // Auto-download updates based on priority
        const criticalUpdates = availableUpdates.filter(u => u.priority === 'critical' || u.priority === 'high');
        for (const update of criticalUpdates) {
          await downloadUpdate(update.id);
        }
      }

    } catch (err) {
      setError(err as ContentError);
    } finally {
      setLoading(false);
    }
  }, [options.autoDownload]);

  const downloadContentUpdate = useCallback(async (updateId: string) => {
    try {
      setLoading(true);
      await downloadUpdate(updateId);

      if (options.autoInstall) {
        await installUpdate(updateId);
      }
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [options.autoInstall]);

  const installContentUpdate = useCallback(async (updateId: string) => {
    try {
      setLoading(true);
      const success = await installUpdate(updateId);

      if (success && options.notifyOnComplete) {
        // Show success notification
        const notification = {
          id: Date.now().toString(),
          type: 'success',
          title: 'Update Completed',
          message: 'The content update has been successfully installed.',
          timestamp: new Date(),
        };
        setNotifications(prev => [...prev, notification]);
      }

      return success;
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [options.notifyOnComplete]);

  const rollbackContentUpdate = useCallback(async (contentId: string) => {
    try {
      setLoading(true);
      const success = await rollbackUpdate(contentId);
      return success;
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshProgress = useCallback(() => {
    const currentProgress = getUpdateProgress();
    setProgress(currentProgress);
  }, []);

  const refreshNotifications = useCallback(() => {
    const currentNotifications = getNotifications();
    setNotifications(currentNotifications);
  }, []);

  const dismissUpdateNotification = useCallback((notificationId: string) => {
    dismissNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  const cancelContentUpdate = useCallback(async (updateId: string) => {
    try {
      setLoading(true);
      const success = await cancelUpdate(updateId);
      return success;
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStats = useCallback(() => {
    const currentStats = getUpdateStats();
    setStats(currentStats);
  }, []);

  useEffect(() => {
    if (options.autoCheck !== false) {
      checkForContentUpdates();
    }
  }, [checkForContentUpdates, options.autoCheck]);

  useEffect(() => {
    // Set up periodic refresh
    const interval = setInterval(() => {
      refreshProgress();
      refreshNotifications();
      refreshStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshProgress, refreshNotifications, refreshStats]);

  return {
    updates,
    progress,
    notifications,
    stats,
    loading,
    error,
    actions: {
      checkForUpdates: checkForContentUpdates,
      downloadUpdate: downloadContentUpdate,
      installUpdate: installContentUpdate,
      rollbackUpdate: rollbackContentUpdate,
      cancelUpdate: cancelContentUpdate,
      dismissNotification: dismissUpdateNotification,
      refreshProgress,
      refreshNotifications,
      refreshStats,
    },
  };
}

// Content analytics hook
export function useContentAnalytics(contentId?: string, options: UseAnalyticsOptions = {}) {
  const [analytics, setAnalytics] = useState<ContentAnalytics | null>(null);
  const [realTimeData, setRealTimeData] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ContentError | null>(null);

  const loadAnalytics = useCallback(async (period: AnalyticsPeriod = 'daily') => {
    try {
      setLoading(true);
      setError(null);

      let analyticsData: ContentAnalytics;
      if (contentId) {
        analyticsData = await getContentAnalytics(contentId, period);
      } else {
        analyticsData = await getPlatformAnalytics(period);
      }

      setAnalytics(analyticsData);

      if (options.detailed) {
        const insightsData = await getPerformanceInsights(contentId || 'platform');
        setInsights(insightsData);
      }

    } catch (err) {
      setError(err as ContentError);
    } finally {
      setLoading(false);
    }
  }, [contentId, options.detailed]);

  const loadRealTimeData = useCallback(async () => {
    if (!options.realTime) return;

    try {
      const realTime = await getRealTimeAnalytics(contentId);
      setRealTimeData(realTime);
    } catch (err) {
      console.error('Failed to load real-time data:', err);
    }
  }, [contentId, options.realTime]);

  const exportAnalyticsData = useCallback(async (format: 'json' | 'csv' | 'summary' = 'json') => {
    try {
      setLoading(true);
      const filters = contentId ? { contentIds: [contentId] } : {};
      return await exportAnalytics(filters, format);
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    if (options.realTime) {
      const interval = setInterval(loadRealTimeData, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [loadRealTimeData, options.realTime]);

  return {
    analytics,
    realTimeData,
    insights,
    loading,
    error,
    actions: {
      refresh: loadAnalytics,
      exportData: exportAnalyticsData,
    },
  };
}

// Content validation hook
export function useContentValidation(content: ContentMetadata | null) {
  const [validation, setValidation] = useState<any>(null);
  const [moderation, setModeration] = useState<any>(null);
  const [qualityScore, setQualityScore] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ContentError | null>(null);

  const validateContentData = useCallback(async (contentToValidate: ContentMetadata) => {
    try {
      setLoading(true);
      setError(null);

      const [validationResult, moderationResult, score] = await Promise.all([
        validateContent(contentToValidate),
        moderateContent(contentToValidate),
        generateQualityScore(contentToValidate),
      ]);

      setValidation(validationResult);
      setModeration(moderationResult);
      setQualityScore(score);

      return { validation: validationResult, moderation: moderationResult, qualityScore: score };

    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const autoFixContentIssues = useCallback(async (contentToFix: ContentMetadata) => {
    try {
      setLoading(true);
      const fixedContent = await autoFixContent(contentToFix);
      return fixedContent;
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (content) {
      validateContentData(content);
    }
  }, [content, validateContentData]);

  return {
    validation,
    moderation,
    qualityScore,
    loading,
    error,
    actions: {
      validate: validateContentData,
      autoFix: autoFixContentIssues,
    },
  };
}

// Content distribution hook
export function useContentDistribution(contentId?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ContentError | null>(null);

  const getContentDeliveryUrl = useCallback(async (
    contentId: string,
    options?: {
      region?: string;
      deviceType?: string;
      connectionSpeed?: string;
      quality?: 'low' | 'medium' | 'high' | 'auto';
    }
  ) => {
    try {
      setLoading(true);
      setError(null);

      const deliveryUrl = await getContentUrl(contentId, options);
      setUrl(deliveryUrl.url);
      return deliveryUrl;

    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const preloadContentData = useCallback(async (contentIds: string[]) => {
    try {
      setLoading(true);
      await preloadContent(contentIds);
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const optimizeContentDelivery = useCallback(async (
    conditions: {
      networkType?: 'wifi' | '4g' | '3g' | '2g' | 'slow-2g';
      deviceType?: 'desktop' | 'mobile' | 'tablet';
      region?: string;
      bandwidth?: number;
    },
    targetContentId: string
  ) => {
    try {
      setLoading(true);
      const optimized = await optimizeDelivery(conditions, targetContentId);
      return optimized;
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getDistributionHealthStatus = useCallback(async () => {
    try {
      setLoading(true);
      const healthStatus = await getDistributionHealth();
      setHealth(healthStatus);
      return healthStatus;
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const testContentDelivery = useCallback(async (testContentId: string) => {
    try {
      setLoading(true);
      const performance = await testDeliveryPerformance(testContentId);
      return performance;
    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMetrics = useCallback(async () => {
    try {
      const distributionMetrics = await getDistributionMetrics(contentId);
      setMetrics(distributionMetrics);
    } catch (err) {
      console.error('Failed to refresh metrics:', err);
    }
  }, [contentId]);

  useEffect(() => {
    if (contentId) {
      refreshMetrics();
    }
  }, [contentId, refreshMetrics]);

  useEffect(() => {
    getDistributionHealthStatus();
  }, [getDistributionHealthStatus]);

  return {
    url,
    metrics,
    health,
    loading,
    error,
    actions: {
      getUrl: getContentDeliveryUrl,
      preload: preloadContentData,
      optimize: optimizeContentDelivery,
      getHealth: getDistributionHealthStatus,
      testDelivery: testContentDelivery,
      refreshMetrics,
    },
  };
}

// Content usage tracking hook
export function useContentTracking(userId?: string) {
  const trackContentUsage = useCallback(async (
    contentId: string,
    eventType: ContentEventType,
    data?: any
  ) => {
    try {
      await trackUsage({
        contentId,
        userId,
        sessionId: generateSessionId(),
        eventType,
        data,
      });
    } catch (err) {
      console.error('Failed to track usage:', err);
    }
  }, [userId]);

  const trackContentView = useCallback((contentId: string) => {
    trackContentUsage(contentId, 'view', { timestamp: new Date() });
  }, [trackContentUsage]);

  const trackContentStart = useCallback((contentId: string) => {
    trackContentUsage(contentId, 'start', { timestamp: new Date() });
  }, [trackContentUsage]);

  const trackContentComplete = useCallback((contentId: string) => {
    trackContentUsage(contentId, 'complete', { timestamp: new Date() });
  }, [trackContentUsage]);

  const trackContentRating = useCallback((contentId: string, rating: number) => {
    trackContentUsage(contentId, 'rate', { rating, timestamp: new Date() });
  }, [trackContentUsage]);

  const trackContentFavorite = useCallback((contentId: string) => {
    trackContentUsage(contentId, 'favorite', { timestamp: new Date() });
  }, [trackContentUsage]);

  const trackContentShare = useCallback((contentId: string, platform: string) => {
    trackContentUsage(contentId, 'share', { platform, timestamp: new Date() });
  }, [trackContentUsage]);

  return {
    track: trackContentUsage,
    trackView: trackContentView,
    trackStart: trackContentStart,
    trackComplete: trackContentComplete,
    trackRating: trackContentRating,
    trackFavorite: trackContentFavorite,
    trackShare: trackContentShare,
  };
}

// System health hook
export function useSystemHealth() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ContentError | null>(null);

  const checkSystemHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const healthStatus = await getHealthStatus();
      setHealth(healthStatus);
      return healthStatus;

    } catch (err) {
      setError(err as ContentError);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSystemHealth();
  }, [checkSystemHealth]);

  useEffect(() => {
    const interval = setInterval(checkSystemHealth, 300000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, [checkSystemHealth]);

  return {
    health,
    loading,
    error,
    checkHealth: checkSystemHealth,
  };
}

// Utility functions
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Content operations hook (combines multiple operations)
export function useContentOperations() {
  const contentManager = useContentManager();
  const { trackView, trackStart, trackComplete } = useContentTracking();
  const { validate, autoFix } = useContentValidation(null);
  const { getUrl } = useContentDistribution();

  const createAndValidateContent = useCallback(async (contentData: Omit<ContentMetadata, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newContent = await contentManager.actions.addContent(contentData);
      await validate(newContent);
      return newContent;
    } catch (err) {
      throw err;
    }
  }, [contentManager.actions.addContent, validate]);

  const updateAndValidateContent = useCallback(async (contentId: string, updates: Partial<ContentMetadata>) => {
    try {
      const currentContent = await getContent(contentId);
      if (!currentContent) {
        throw new Error('Content not found');
      }

      const updatedContent = await contentManager.actions.updateContent(contentId, updates);
      await validate(updatedContent);
      return updatedContent;
    } catch (err) {
      throw err;
    }
  }, [contentManager.actions.updateContent, validate]);

  const getContentWithUrl = useCallback(async (contentId: string) => {
    try {
      const [contentData, deliveryUrl] = await Promise.all([
        getContent(contentId),
        getUrl(contentId),
      ]);

      return {
        content: contentData,
        url: deliveryUrl?.url || null,
      };
    } catch (err) {
      throw err;
    }
  }, [getUrl]);

  return {
    ...contentManager,
    tracking: {
      trackView,
      trackStart,
      trackComplete,
    },
    validation: {
      validate,
      autoFix,
    },
    distribution: {
      getUrl,
    },
    operations: {
      createAndValidateContent,
      updateAndValidateContent,
      getContentWithUrl,
    },
  };
}

// Export all hooks
export {
  useContentManager,
  useContent,
  useContentSearch,
  useContentRecommendations,
  useContentUpdates,
  useContentAnalytics,
  useContentValidation,
  useContentDistribution,
  useContentTracking,
  useSystemHealth,
  useContentOperations,
};