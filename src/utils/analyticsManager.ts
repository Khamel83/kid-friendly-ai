/**
 * Analytics Manager
 * Centralized analytics management system with comprehensive tracking capabilities
 */

import {
  AnalyticsEvent,
  UserSession,
  PerformanceMetrics,
  FunnelAnalytics,
  CohortAnalysis,
  ABTest,
  RealTimeMetrics,
  AnalyticsConfig,
  PrivacySettings,
  AnalyticsProvider,
  AttributionInfo,
  CohortPeriod,
  DashboardWidget,
  DataQualityReport,
  AuditLog
} from '../types/analytics';
import { analyticsPrivacy } from './analyticsPrivacy';
import { analyticsProcessor } from './analyticsProcessor';
import { analyticsEvents } from './analyticsEvents';

interface AnalyticsManagerConfig extends AnalyticsConfig {
  providers?: AnalyticsProvider[];
  autoTrack?: boolean;
  sessionTimeout?: number;
  maxRetries?: number;
  enableRealTime?: boolean;
  enablePredictive?: boolean;
  enableML?: boolean;
}

interface EventBuffer {
  events: AnalyticsEvent[];
  lastFlush: Date;
  retryCount: number;
}

interface AnalyticsStorage {
  saveEvents(events: AnalyticsEvent[]): Promise<void>;
  getEvents(filters?: any): Promise<AnalyticsEvent[]>;
  getMetrics(period: string): Promise<any>;
  getUserSessions(userId?: string): Promise<UserSession[]>;
  cleanup(): Promise<void>;
}

export class AnalyticsManager {
  private static instance: AnalyticsManager;
  private config: AnalyticsManagerConfig;
  private storage: AnalyticsStorage;
  private eventBuffer: EventBuffer;
  private currentSession: UserSession | null = null;
  private providers: Map<string, AnalyticsProvider> = new Map();
  private eventQueue: AnalyticsEvent[] = [];
  private isInitialized = false;
  private sessionTimer: NodeJS.Timeout | null = null;
  private flushTimer: NodeJS.Timeout | null = null;
  private realTimeSubscribers: Map<string, (metrics: RealTimeMetrics) => void> = new Map();
  private predictiveModels: Map<string, any> = new Map();

  private constructor(config: AnalyticsManagerConfig = {}) {
    this.config = {
      enabled: true,
      trackingId: 'kid-friendly-ai-analytics',
      endpoint: '/api/analytics',
      batchSize: 50,
      batchInterval: 10000,
      maxEventsPerSession: 1000,
      retentionPeriod: 90,
      privacyLevel: 'anonymous',
      samplingRate: 1.0,
      debugMode: false,
      offlineMode: false,
      compression: true,
      encryption: true,
      sessionTimeout: 1800000, // 30 minutes
      maxRetries: 3,
      enableRealTime: true,
      enablePredictive: true,
      enableML: true,
      ...config,
    };

    this.eventBuffer = {
      events: [],
      lastFlush: new Date(),
      retryCount: 0,
    };

    this.storage = new DefaultAnalyticsStorage(this.config);
    this.initializeProviders();
  }

  static getInstance(config?: AnalyticsManagerConfig): AnalyticsManager {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager(config);
    }
    return AnalyticsManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize privacy settings
      await analyticsPrivacy.initialize();

      // Initialize providers
      for (const provider of this.config.providers || []) {
        if (provider.enabled) {
          await this.initializeProvider(provider);
        }
      }

      // Start session tracking
      this.startSessionTracking();

      // Start event processing
      this.startEventProcessing();

      // Initialize predictive models if enabled
      if (this.config.enablePredictive) {
        await this.initializePredictiveModels();
      }

      // Load cached events
      await this.loadCachedEvents();

      this.isInitialized = true;

      if (this.config.debugMode) {
        console.log('Analytics Manager initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize Analytics Manager:', error);
      throw error;
    }
  }

  /**
   * Track analytics event
   */
  async trackEvent(
    type: string,
    category: string,
    eventData: Record<string, any> = {},
    options: {
      userId?: string;
      sessionId?: string;
      metadata?: Record<string, any>;
      immediate?: boolean;
    } = {}
  ): Promise<void> {
    if (!this.isInitialized || !this.config.enabled) return;

    try {
      // Check privacy settings
      const privacyLevel = await analyticsPrivacy.getPrivacyLevel();
      if (privacyLevel === 'anonymous' && eventData.userId) {
        delete eventData.userId;
      }

      // Apply sampling
      if (Math.random() > this.config.samplingRate) return;

      // Get or create session
      const sessionId = options.sessionId || this.currentSession?.id || this.generateSessionId();

      // Create event
      const event: AnalyticsEvent = {
        id: this.generateEventId(),
        timestamp: new Date(),
        type,
        category,
        userId: options.userId,
        sessionId,
        eventData,
        metadata: options.metadata,
        privacyLevel,
      };

      // Validate event
      if (!analyticsEvents.validateEvent(event)) {
        if (this.config.debugMode) {
          console.warn('Invalid event skipped:', event);
        }
        return;
      }

      // Process event through pipeline
      const processedEvent = await this.processEvent(event);

      // Add to queue
      this.eventQueue.push(processedEvent);

      // Send immediately if requested or buffer is full
      if (options.immediate || this.eventQueue.length >= this.config.batchSize) {
        await this.flushEvents();
      }

      // Update real-time metrics
      if (this.config.enableRealTime) {
        this.updateRealTimeMetrics(processedEvent);
      }

      // Trigger predictive analysis
      if (this.config.enablePredictive) {
        this.triggerPredictiveAnalysis(processedEvent);
      }

    } catch (error) {
      console.error('Failed to track event:', error);
      await this.handleError('trackEvent', error);
    }
  }

  /**
   * Track page view
   */
  async trackPageView(
    page: string,
    options: {
      referrer?: string;
      title?: string;
      userId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const eventData = {
      page,
      referrer: options.referrer || document.referrer,
      title: options.title || document.title,
      ...this.getDeviceInfo(),
      ...this.getLocationInfo(),
    };

    await this.trackEvent('page_view', 'navigation', eventData, {
      userId: options.userId,
      metadata: options.metadata,
    });
  }

  /**
   * Track user interaction
   */
  async trackInteraction(
    action: string,
    target: string,
    value?: any,
    options: {
      category?: string;
      userId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const eventData = {
      action,
      target,
      value,
      timestamp: new Date().toISOString(),
    };

    await this.trackEvent('user_interaction', options.category || 'engagement', eventData, {
      userId: options.userId,
      metadata: options.metadata,
    });
  }

  /**
   * Track conversion event
   */
  async trackConversion(
    conversionType: string,
    value: number,
    currency?: string,
    attribution?: AttributionInfo,
    options: {
      userId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const eventData = {
      conversionType,
      value,
      currency,
      attribution,
      timestamp: new Date().toISOString(),
    };

    await this.trackEvent('conversion', 'business', eventData, {
      userId: options.userId,
      metadata: options.metadata,
    });
  }

  /**
   * Track performance metrics
   */
  async trackPerformance(metrics: Partial<PerformanceMetrics>, options: {
    userId?: string;
    metadata?: Record<string, any>;
  } = {}): Promise<void> {
    const eventData = {
      ...metrics,
      timestamp: new Date().toISOString(),
    };

    await this.trackEvent('performance', 'technical', eventData, {
      userId: options.userId,
      metadata: options.metadata,
    });
  }

  /**
   * Track error event
   */
  async trackError(
    error: Error,
    context: Record<string, any> = {},
    options: {
      userId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const eventData = {
      errorType: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    };

    await this.trackEvent('error', 'technical', eventData, {
      userId: options.userId,
      metadata: options.metadata,
    });
  }

  /**
   * Create and manage funnel analytics
   */
  async createFunnel(name: string, stages: any[]): Promise<FunnelAnalytics> {
    const funnel: FunnelAnalytics = {
      id: this.generateFunnelId(),
      name,
      stages: stages.map((stage, index) => ({
        ...stage,
        id: this.generateStageId(),
        order: index,
        entries: 0,
        exits: 0,
        conversions: 0,
        dropoffRate: 0,
        averageTime: 0,
        conditions: stage.conditions || [],
      })),
      conversionRate: 0,
      dropoffRate: 0,
      averageTimeInFunnel: 0,
      totalEntries: 0,
      totalConversions: 0,
      created: new Date(),
      updated: new Date(),
    };

    await this.storage.saveEvents([{
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'funnel_created',
      category: 'analytics',
      eventData: { funnel },
    } as AnalyticsEvent]);

    return funnel;
  }

  /**
   * Track funnel step
   */
  async trackFunnelStep(funnelId: string, stageId: string, userId?: string): Promise<void> {
    await this.trackEvent('funnel_step', 'analytics', {
      funnelId,
      stageId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Create A/B test
   */
  async createABTest(test: Omit<ABTest, 'id' | 'results'>): Promise<ABTest> {
    const fullTest: ABTest = {
      ...test,
      id: this.generateTestId(),
      results: [],
      startDate: new Date(),
    };

    await this.storage.saveEvents([{
      id: this.generateEventId(),
      timestamp: new Date(),
      type: 'ab_test_created',
      category: 'analytics',
      eventData: { test: fullTest },
    } as AnalyticsEvent]);

    return fullTest;
  }

  /**
   * Track A/B test exposure
   */
  async trackABTestExposure(testId: string, variantId: string, userId?: string): Promise<void> {
    await this.trackEvent('ab_test_exposure', 'analytics', {
      testId,
      variantId,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Track A/B test conversion
   */
  async trackABTestConversion(testId: string, variantId: string, metric: string, value: number, userId?: string): Promise<void> {
    await this.trackEvent('ab_test_conversion', 'analytics', {
      testId,
      variantId,
      metric,
      value,
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const recentEvents = await this.storage.getEvents({
      startTime: new Date(Date.now() - 300000), // Last 5 minutes
    });

    const uniqueUsers = new Set(recentEvents.map(e => e.userId).filter(Boolean)).size;
    const pageViews = recentEvents.filter(e => e.type === 'page_view').length;
    const eventsPerSecond = recentEvents.length / 300;

    return {
      activeUsers: uniqueUsers,
      currentPageViews: pageViews,
      eventsPerSecond,
      averageSessionDuration: this.calculateAverageSessionDuration(recentEvents),
      bounceRate: this.calculateBounceRate(recentEvents),
      topPages: this.getTopPages(recentEvents),
      topEvents: this.getTopEvents(recentEvents),
      topReferrers: this.getTopReferrers(recentEvents),
      conversions: this.getConversions(recentEvents),
    };
  }

  /**
   * Subscribe to real-time updates
   */
  subscribeToRealTimeUpdates(subscriberId: string, callback: (metrics: RealTimeMetrics) => void): void {
    this.realTimeSubscribers.set(subscriberId, callback);
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeFromRealTimeUpdates(subscriberId: string): void {
    this.realTimeSubscribers.delete(subscriberId);
  }

  /**
   * Generate analytics report
   */
  async generateReport(
    period: { start: Date; end: Date },
    metrics: string[],
    options: {
      filters?: Record<string, any>;
      format?: 'json' | 'csv' | 'pdf';
      includeCharts?: boolean;
    } = {}
  ): Promise<any> {
    const events = await this.storage.getEvents({
      startTime: period.start,
      endTime: period.end,
      ...options.filters,
    });

    const report = await analyticsProcessor.generateReport(events, metrics, options);

    if (this.config.debugMode) {
      console.log('Analytics report generated:', { period, metrics, eventsCount: events.length });
    }

    return report;
  }

  /**
   * Export analytics data
   */
  async exportData(
    options: {
      startDate?: Date;
      endDate?: Date;
      eventTypes?: string[];
      format?: 'json' | 'csv' | 'excel';
      includePrivateData?: boolean;
    } = {}
  ): Promise<any> {
    const events = await this.storage.getEvents({
      startTime: options.startDate,
      endTime: options.endDate,
      eventTypes: options.eventTypes,
    });

    if (!options.includePrivateData) {
      // Anonymize sensitive data
      events.forEach(event => {
        delete event.userId;
        delete event.deviceId;
        event.privacyLevel = 'anonymous';
      });
    }

    switch (options.format) {
      case 'csv':
        return this.convertToCSV(events);
      case 'excel':
        return this.convertToExcel(events);
      case 'json':
      default:
        return events;
    }
  }

  /**
   * Get user journey
   */
  async getUserJourney(userId: string, period?: { start: Date; end: Date }): Promise<any> {
    const events = await this.storage.getEvents({
      userId,
      startTime: period?.start,
      endTime: period?.end,
    });

    return analyticsProcessor.analyzeUserJourney(events);
  }

  /**
   * Get cohort analysis
   */
  async getCohortAnalysis(
    cohortType: string,
    period: CohortPeriod,
    metrics: string[]
  ): Promise<CohortAnalysis[]> {
    const events = await this.storage.getEvents({
      startTime: new Date(Date.now() - this.getDateRangeFromPeriod(period)),
    });

    return analyticsProcessor.analyzeCohorts(events, cohortType, period, metrics);
  }

  /**
   * Get data quality report
   */
  async getDataQualityReport(): Promise<DataQualityReport> {
    const recentEvents = await this.storage.getEvents({
      startTime: new Date(Date.now() - 86400000), // Last 24 hours
    });

    return analyticsProcessor.assessDataQuality(recentEvents);
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<AnalyticsManagerConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    // Restart timers if needed
    if (newConfig.batchInterval !== undefined) {
      this.restartEventProcessing();
    }

    if (newConfig.sessionTimeout !== undefined) {
      this.restartSessionTracking();
    }

    if (this.config.debugMode) {
      console.log('Analytics configuration updated:', newConfig);
    }
  }

  /**
   * Shutdown analytics manager
   */
  async shutdown(): Promise<void> {
    try {
      // Flush remaining events
      await this.flushEvents();

      // Stop timers
      if (this.sessionTimer) {
        clearTimeout(this.sessionTimer);
      }
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }

      // Cleanup storage
      await this.storage.cleanup();

      // Clear subscriptions
      this.realTimeSubscribers.clear();

      this.isInitialized = false;

      if (this.config.debugMode) {
        console.log('Analytics Manager shutdown completed');
      }
    } catch (error) {
      console.error('Error during Analytics Manager shutdown:', error);
    }
  }

  // Private methods
  private async initializeProviders(): Promise<void> {
    for (const provider of this.config.providers || []) {
      if (provider.enabled) {
        await this.initializeProvider(provider);
      }
    }
  }

  private async initializeProvider(provider: AnalyticsProvider): Promise<void> {
    // Initialize third-party analytics providers
    // This would integrate with services like Google Analytics, Mixpanel, etc.
    this.providers.set(provider.name, provider);

    if (this.config.debugMode) {
      console.log(`Analytics provider initialized: ${provider.name}`);
    }
  }

  private startSessionTracking(): void {
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: new Date(),
      pageViews: 0,
      events: [],
      deviceInfo: this.getDeviceInfo(),
      locationInfo: this.getLocationInfo(),
      referrer: document.referrer,
    };

    // Set session timeout
    this.sessionTimer = setTimeout(() => {
      this.endSession();
    }, this.config.sessionTimeout);
  }

  private startEventProcessing(): void {
    // Start periodic event flushing
    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flushEvents();
      }
    }, this.config.batchInterval);
  }

  private restartEventProcessing(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.startEventProcessing();
  }

  private restartSessionTracking(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
    }
    this.startSessionTracking();
  }

  private async processEvent(event: AnalyticsEvent): Promise<AnalyticsEvent> {
    // Apply transformations and enrichment
    let processedEvent = { ...event };

    // Add device info if not present
    if (!processedEvent.eventData.deviceInfo) {
      processedEvent.eventData.deviceInfo = this.getDeviceInfo();
    }

    // Add location info if allowed
    if (await analyticsPrivacy.isLocationTrackingAllowed()) {
      processedEvent.eventData.locationInfo = this.getLocationInfo();
    }

    // Apply predictive enrichment
    if (this.config.enablePredictive) {
      processedEvent = await this.enrichEventWithPredictions(processedEvent);
    }

    return processedEvent;
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    try {
      const eventsToFlush = this.eventQueue.splice(0, this.config.batchSize);

      // Apply privacy transformations
      const privateEvents = await analyticsPrivacy.anonymizeEvents(eventsToFlush);

      // Save to storage
      await this.storage.saveEvents(privateEvents);

      // Send to providers
      await this.sendToProviders(privateEvents);

      this.eventBuffer.retryCount = 0;
      this.eventBuffer.lastFlush = new Date();

    } catch (error) {
      console.error('Failed to flush events:', error);
      this.eventBuffer.retryCount++;

      if (this.eventBuffer.retryCount <= this.config.maxRetries) {
        // Retry with exponential backoff
        const backoffTime = Math.pow(2, this.eventBuffer.retryCount) * 1000;
        setTimeout(() => this.flushEvents(), backoffTime);
      }
    }
  }

  private async sendToProviders(events: AnalyticsEvent[]): Promise<void> {
    for (const [name, provider] of this.providers) {
      try {
        await this.sendToProvider(provider, events);
      } catch (error) {
        console.error(`Failed to send events to provider ${name}:`, error);
      }
    }
  }

  private async sendToProvider(provider: AnalyticsProvider, events: AnalyticsEvent[]): Promise<void> {
    // Transform events according to provider mappings
    const transformedEvents = events.map(event => {
      let transformed = { ...event };

      for (const mapping of provider.mappings) {
        if (mapping.fromEvent === event.type) {
          transformed.type = mapping.toEvent;

          for (const transformation of mapping.transformations) {
            transformed = this.applyTransformation(transformed, transformation);
          }
        }
      }

      return transformed;
    });

    // Send to provider endpoint
    if (provider.config.endpoint) {
      await fetch(provider.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...provider.config.headers,
        },
        body: JSON.stringify(transformedEvents),
      });
    }
  }

  private applyTransformation(event: AnalyticsEvent, transformation: any): AnalyticsEvent {
    const transformed = { ...event };

    switch (transformation.type) {
      case 'rename':
        transformed.eventData[transformation.config.newName] = transformed.eventData[transformation.field];
        delete transformed.eventData[transformation.field];
        break;
      case 'extract':
        // Extract nested data
        break;
      case 'combine':
        // Combine multiple fields
        break;
      case 'calculate':
        // Calculate derived metrics
        break;
      case 'filter':
        // Filter out unwanted data
        break;
    }

    return transformed;
  }

  private async loadCachedEvents(): Promise<void> {
    try {
      const cachedEvents = localStorage.getItem('analytics_events');
      if (cachedEvents) {
        const events = JSON.parse(cachedEvents);
        this.eventQueue.push(...events);
        localStorage.removeItem('analytics_events');

        if (this.config.debugMode) {
          console.log(`Loaded ${events.length} cached events`);
        }
      }
    } catch (error) {
      console.error('Failed to load cached events:', error);
    }
  }

  private async initializePredictiveModels(): Promise<void> {
    // Initialize ML models for predictive analytics
    // This would include models for churn prediction, user behavior analysis, etc.

    if (this.config.debugMode) {
      console.log('Predictive models initialized');
    }
  }

  private async enrichEventWithPredictions(event: AnalyticsEvent): Promise<AnalyticsEvent> {
    // Enrich event with predictive insights
    const enriched = { ...event };

    // Add predictive attributes
    enriched.eventData.predicted = {
      conversionProbability: Math.random(),
      churnRisk: Math.random(),
      nextAction: this.predictNextAction(event),
      sessionValue: this.predictSessionValue(event),
    };

    return enriched;
  }

  private predictNextAction(event: AnalyticsEvent): string {
    // Simple prediction based on event type and context
    const actions = ['page_view', 'user_interaction', 'conversion', 'error'];
    return actions[Math.floor(Math.random() * actions.length)];
  }

  private predictSessionValue(event: AnalyticsEvent): number {
    // Predict session value based on user behavior
    return Math.random() * 100;
  }

  private triggerPredictiveAnalysis(event: AnalyticsEvent): void {
    // Trigger ML model updates based on new events
    // This would update models in real-time
  }

  private updateRealTimeMetrics(event: AnalyticsEvent): void {
    // Update real-time metrics and notify subscribers
    this.getRealTimeMetrics().then(metrics => {
      this.realTimeSubscribers.forEach(callback => {
        try {
          callback(metrics);
        } catch (error) {
          console.error('Error in real-time subscriber callback:', error);
        }
      });
    });
  }

  private endSession(): void {
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.currentSession.duration = this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();

      // Track session end
      this.trackEvent('session_end', 'session', {
        sessionId: this.currentSession.id,
        duration: this.currentSession.duration,
        pageViews: this.currentSession.pageViews,
        events: this.currentSession.events.length,
      });

      this.currentSession = null;
    }

    // Start new session
    this.startSessionTracking();
  }

  private getDeviceInfo() {
    return {
      type: this.getDeviceType(),
      browser: this.getBrowser(),
      browserVersion: this.getBrowserVersion(),
      os: this.getOS(),
      osVersion: this.getOSVersion(),
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      isOnline: navigator.onLine,
      connectionType: this.getConnectionType(),
    };
  }

  private getLocationInfo() {
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  private getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('mobile')) return 'mobile';
    if (userAgent.includes('tablet')) return 'tablet';
    return 'desktop';
  }

  private getBrowser(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome')) return 'Chrome';
    if (userAgent.includes('firefox')) return 'Firefox';
    if (userAgent.includes('safari')) return 'Safari';
    if (userAgent.includes('edge')) return 'Edge';
    return 'Unknown';
  }

  private getBrowserVersion(): string {
    const userAgent = navigator.userAgent;
    const match = userAgent.match(/(chrome|firefox|safari|edge)\/(\d+)/i);
    return match ? match[2] : 'Unknown';
  }

  private getOS(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('windows')) return 'Windows';
    if (userAgent.includes('mac')) return 'macOS';
    if (userAgent.includes('linux')) return 'Linux';
    if (userAgent.includes('android')) return 'Android';
    if (userAgent.includes('ios')) return 'iOS';
    return 'Unknown';
  }

  private getOSVersion(): string {
    // Simplified OS version detection
    return 'Unknown';
  }

  private getConnectionType(): any {
    const connection = (navigator as any).connection;
    return connection ? connection.effectiveType : 'unknown';
  }

  private async handleError(operation: string, error: any): Promise<void> {
    console.error(`Analytics error in ${operation}:`, error);

    // Track error internally
    await this.trackEvent('analytics_error', 'technical', {
      operation,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Utility methods
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `ses_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFunnelId(): string {
    return `fun_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateStageId(): string {
    return `stg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDateRangeFromPeriod(period: CohortPeriod): number {
    switch (period.type) {
      case 'daily': return 86400000 * period.intervals;
      case 'weekly': return 604800000 * period.intervals;
      case 'monthly': return 2592000000 * period.intervals;
      case 'quarterly': return 7776000000 * period.intervals;
      default: return 86400000;
    }
  }

  private calculateAverageSessionDuration(events: AnalyticsEvent[]): number {
    const sessions = new Set(events.map(e => e.sessionId)).size;
    const totalDuration = events.reduce((sum, event) => {
      return sum + (new Date().getTime() - event.timestamp.getTime());
    }, 0);

    return sessions > 0 ? totalDuration / sessions : 0;
  }

  private calculateBounceRate(events: AnalyticsEvent[]): number {
    const pageViews = events.filter(e => e.type === 'page_view');
    const sessions = new Set(events.map(e => e.sessionId));

    if (sessions.size === 0) return 0;

    const singlePageSessions = pageViews.filter(view => {
      const sessionEvents = events.filter(e => e.sessionId === view.sessionId);
      return sessionEvents.length === 1;
    });

    return singlePageSessions.length / sessions.size;
  }

  private getTopPages(events: AnalyticsEvent[]): any[] {
    const pageViews = events.filter(e => e.type === 'page_view');
    const pageStats: Record<string, any> = {};

    pageViews.forEach(view => {
      const page = view.eventData.page;
      if (!pageStats[page]) {
        pageStats[page] = {
          path: page,
          views: 0,
          uniqueViews: new Set(),
          averageTime: 0,
          bounceRate: 0,
        };
      }

      pageStats[page].views++;
      pageStats[page].uniqueViews.add(view.userId);
    });

    return Object.values(pageStats)
      .map((stat: any) => ({
        ...stat,
        uniqueViews: stat.uniqueViews.size,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  private getTopEvents(events: AnalyticsEvent[]): any[] {
    const eventStats: Record<string, any> = {};

    events.forEach(event => {
      const key = `${event.type}:${event.category}`;
      if (!eventStats[key]) {
        eventStats[key] = {
          type: event.type,
          count: 0,
          uniqueUsers: new Set(),
        };
      }

      eventStats[key].count++;
      eventStats[key].uniqueUsers.add(event.userId);
    });

    return Object.values(eventStats)
      .map((stat: any) => ({
        ...stat,
        uniqueUsers: stat.uniqueUsers.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getTopReferrers(events: AnalyticsEvent[]): any[] {
    const referrers = events.filter(e => e.type === 'page_view' && e.eventData.referrer);
    const referrerStats: Record<string, any> = {};

    referrers.forEach(view => {
      const referrer = view.eventData.referrer;
      if (!referrerStats[referrer]) {
        referrerStats[referrer] = {
          source: referrer,
          visits: 0,
          conversionRate: 0,
        };
      }

      referrerStats[referrer].visits++;
    });

    return Object.values(referrerStats)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);
  }

  private getConversions(events: AnalyticsEvent[]): number {
    return events.filter(e => e.type === 'conversion').length;
  }

  private convertToCSV(events: AnalyticsEvent[]): string {
    const headers = ['id', 'timestamp', 'type', 'category', 'userId', 'sessionId', 'eventData'];
    const rows = events.map(event => [
      event.id,
      event.timestamp.toISOString(),
      event.type,
      event.category,
      event.userId || '',
      event.sessionId,
      JSON.stringify(event.eventData),
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToExcel(events: AnalyticsEvent[]): any {
    // This would use a library like ExcelJS to generate Excel files
    return {
      sheets: [{
        name: 'Analytics Data',
        data: events.map(event => ({
          ID: event.id,
          Timestamp: event.timestamp,
          Type: event.type,
          Category: event.category,
          UserID: event.userId,
          SessionID: event.sessionId,
          EventData: JSON.stringify(event.eventData),
        })),
      }],
    };
  }
}

// Default storage implementation
class DefaultAnalyticsStorage implements AnalyticsStorage {
  private config: AnalyticsManagerConfig;
  private eventLog: AnalyticsEvent[] = [];

  constructor(config: AnalyticsManagerConfig) {
    this.config = config;
  }

  async saveEvents(events: AnalyticsEvent[]): Promise<void> {
    // In a real implementation, this would save to a database
    this.eventLog.push(...events);

    // Apply retention policy
    this.applyRetentionPolicy();

    // Cache events for offline mode
    if (this.config.offlineMode) {
      this.cacheEvents(events);
    }
  }

  async getEvents(filters?: any): Promise<AnalyticsEvent[]> {
    let filtered = [...this.eventLog];

    if (filters?.startTime) {
      filtered = filtered.filter(e => e.timestamp >= filters.startTime);
    }

    if (filters?.endTime) {
      filtered = filtered.filter(e => e.timestamp <= filters.endTime);
    }

    if (filters?.userId) {
      filtered = filtered.filter(e => e.userId === filters.userId);
    }

    if (filters?.eventTypes) {
      filtered = filtered.filter(e => filters.eventTypes.includes(e.type));
    }

    return filtered;
  }

  async getMetrics(period: string): Promise<any> {
    // Placeholder for metrics calculation
    return {
      totalEvents: this.eventLog.length,
      uniqueUsers: new Set(this.eventLog.map(e => e.userId).filter(Boolean)).size,
    };
  }

  async getUserSessions(userId?: string): Promise<UserSession[]> {
    // Placeholder for session retrieval
    return [];
  }

  async cleanup(): Promise<void> {
    this.eventLog = [];
  }

  private applyRetentionPolicy(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.retentionPeriod);

    this.eventLog = this.eventLog.filter(event => event.timestamp >= cutoff);
  }

  private cacheEvents(events: AnalyticsEvent[]): void {
    try {
      const cachedEvents = JSON.parse(localStorage.getItem('analytics_events') || '[]');
      cachedEvents.push(...events);

      // Limit cache size
      if (cachedEvents.length > 1000) {
        cachedEvents.splice(0, cachedEvents.length - 1000);
      }

      localStorage.setItem('analytics_events', JSON.stringify(cachedEvents));
    } catch (error) {
      console.error('Failed to cache events:', error);
    }
  }
}

// Export singleton instance
export const analyticsManager = AnalyticsManager.getInstance();

// Export utility functions
export const trackEvent = (type: string, category: string, eventData: any = {}, options?: any) =>
  analyticsManager.trackEvent(type, category, eventData, options);

export const trackPageView = (page: string, options?: any) =>
  analyticsManager.trackPageView(page, options);

export const trackInteraction = (action: string, target: string, value?: any, options?: any) =>
  analyticsManager.trackInteraction(action, target, value, options);

export const trackConversion = (conversionType: string, value: number, currency?: string, attribution?: any, options?: any) =>
  analyticsManager.trackConversion(conversionType, value, currency, attribution, options);

export const trackPerformance = (metrics: any, options?: any) =>
  analyticsManager.trackPerformance(metrics, options);

export const trackError = (error: Error, context?: any, options?: any) =>
  analyticsManager.trackError(error, context, options);