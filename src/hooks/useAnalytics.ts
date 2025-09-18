/**
 * Analytics React Hooks
 * Comprehensive React hooks for analytics integration and user behavior tracking
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { analyticsManager } from '../utils/analyticsManager';
import { analyticsPrivacy } from '../utils/analyticsPrivacy';
import {
  AnalyticsEvent,
  UserSession,
  PerformanceMetrics,
  RealTimeMetrics,
  PrivacySettings,
  AnalyticsConfig,
  FunnelAnalytics,
  CohortAnalysis,
  ABTest,
  DashboardWidget,
  AnalyticsReport
} from '../types/analytics';

interface UseAnalyticsOptions {
  autoTrack?: boolean;
  trackPageViews?: boolean;
  trackInteractions?: boolean;
  trackPerformance?: boolean;
  trackErrors?: boolean;
  debugMode?: boolean;
  samplingRate?: number;
}

interface UseAnalyticsReturn {
  trackEvent: (type: string, category: string, eventData?: any, options?: any) => Promise<void>;
  trackPageView: (page: string, options?: any) => Promise<void>;
  trackInteraction: (action: string, target: string, value?: any, options?: any) => Promise<void>;
  trackConversion: (conversionType: string, value: number, currency?: string, attribution?: any, options?: any) => Promise<void>;
  trackPerformance: (metrics: Partial<PerformanceMetrics>, options?: any) => Promise<void>;
  trackError: (error: Error, context?: any, options?: any) => Promise<void>;
  trackFunnelStep: (funnelId: string, stageId: string, userId?: string) => Promise<void>;
  trackABTestExposure: (testId: string, variantId: string, userId?: string) => Promise<void>;
  trackABTestConversion: (testId: string, variantId: string, metric: string, value: number, userId?: string) => Promise<void>;
  isInitialized: boolean;
  privacySettings: PrivacySettings | null;
  currentSession: UserSession | null;
  realTimeMetrics: RealTimeMetrics | null;
  config: AnalyticsConfig;
  updateConfig: (newConfig: Partial<AnalyticsConfig>) => Promise<void>;
}

interface UsePageAnalyticsOptions {
  trackPageView?: boolean;
  trackScroll?: boolean;
  trackClicks?: boolean;
  trackFormSubmissions?: boolean;
  trackTimeOnPage?: boolean;
  enableHeatmap?: boolean;
}

interface UsePageAnalyticsReturn {
  pageViews: number;
  timeOnPage: number;
  scrollDepth: number;
  clickEvents: any[];
  bounceRate: number;
  exitRate: number;
  conversionRate: number;
}

interface UsePerformanceAnalyticsOptions {
  trackPageLoad?: boolean;
  trackResourceTiming?: boolean;
  trackUserTiming?: boolean;
  trackMemoryUsage?: boolean;
  trackNetworkRequests?: boolean;
  trackErrors?: boolean;
  sampleRate?: number;
}

interface UsePerformanceAnalyticsReturn {
  metrics: PerformanceMetrics;
  isHealthy: boolean;
  issues: string[];
  recommendations: string[];
}

interface UseUserAnalyticsOptions {
  trackBehavior?: boolean;
  trackPreferences?: boolean;
  trackEngagement?: boolean;
  trackRetention?: boolean;
  trackLifetimeValue?: boolean;
}

interface UseUserAnalyticsReturn {
  userId: string;
  sessionId: string;
  sessionCount: number;
  totalEvents: number;
  averageSessionDuration: number;
  retentionRate: number;
  lifetimeValue: number;
  userJourney: any[];
  preferences: any;
  segments: string[];
}

interface UseRealTimeAnalyticsOptions {
  enabled?: boolean;
  updateInterval?: number;
  metrics?: string[];
  filters?: Record<string, any>;
}

interface UseRealTimeAnalyticsReturn {
  metrics: RealTimeMetrics;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date;
  subscribe: (callback: (metrics: RealTimeMetrics) => void) => () => void;
}

interface UseFunnelAnalyticsOptions {
  autoTrack?: boolean;
  debugMode?: boolean;
  realTimeUpdates?: boolean;
}

interface UseFunnelAnalyticsReturn {
  funnel: FunnelAnalytics | null;
  currentStage: string | null;
  progress: number;
  conversionRate: number;
  dropoffRate: number;
  trackStep: (stageId: string) => Promise<void>;
  getInsights: () => any;
}

interface UseABTestOptions {
  autoTrack?: boolean;
  debugMode?: boolean;
  forceVariant?: string;
}

interface UseABTestReturn {
  variant: string;
  isLoading: boolean;
  trackConversion: (metric: string, value: number) => Promise<void>;
  trackExposure: () => Promise<void>;
  getTestResults: () => any;
}

interface UseConsentOptions {
  autoShow?: boolean;
  requiredCategories?: string[];
  optionalCategories?: string[];
  privacyPolicyUrl?: string;
}

interface UseConsentReturn {
  hasConsent: boolean;
  consentSettings: PrivacySettings;
  showConsent: boolean;
  acceptAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
  acceptCategory: (category: string) => Promise<void>;
  rejectCategory: (category: string) => Promise<void>;
  saveConsent: (settings: PrivacySettings) => Promise<void>;
}

// Main analytics hook
export function useAnalytics(options: UseAnalyticsOptions = {}): UseAnalyticsReturn {
  const {
    autoTrack = true,
    trackPageViews = true,
    trackInteractions = true,
    trackPerformance = true,
    trackErrors = true,
    debugMode = false,
    samplingRate = 1.0
  } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings | null>(null);
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null);
  const [config, setConfig] = useState<AnalyticsConfig>(analyticsManager['config']);

  const isMounted = useRef(true);
  const updateInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initializeAnalytics = async () => {
      try {
        await analyticsManager.initialize();

        if (isMounted.current) {
          setIsInitialized(true);

          // Get initial privacy settings
          const settings = await analyticsPrivacy.getPrivacySettings();
          setPrivacySettings(settings);

          // Get current session
          const session = analyticsManager['currentSession'];
          setCurrentSession(session);

          // Setup real-time updates
          if (autoTrack) {
            setupRealTimeUpdates();
          }

          // Update config
          setConfig(analyticsManager['config']);
        }
      } catch (error) {
        console.error('Failed to initialize analytics:', error);
      }
    };

    initializeAnalytics();

    return () => {
      isMounted.current = false;
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [autoTrack]);

  const setupRealTimeUpdates = useCallback(() => {
    updateInterval.current = setInterval(async () => {
      if (isMounted.current) {
        try {
          const metrics = await analyticsManager.getRealTimeMetrics();
          setRealTimeMetrics(metrics);
        } catch (error) {
          console.error('Failed to get real-time metrics:', error);
        }
      }
    }, 5000); // Update every 5 seconds
  }, []);

  const trackEvent = useCallback(async (
    type: string,
    category: string,
    eventData: any = {},
    options: any = {}
  ): Promise<void> => {
    if (!isInitialized) return;

    try {
      await analyticsManager.trackEvent(type, category, eventData, {
        ...options,
        debugMode,
        samplingRate,
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }, [isInitialized, debugMode, samplingRate]);

  const trackPageView = useCallback(async (
    page: string,
    options: any = {}
  ): Promise<void> => {
    if (!isInitialized || !trackPageViews) return;

    try {
      await analyticsManager.trackPageView(page, {
        ...options,
        debugMode,
      });
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  }, [isInitialized, trackPageViews, debugMode]);

  const trackInteraction = useCallback(async (
    action: string,
    target: string,
    value?: any,
    options: any = {}
  ): Promise<void> => {
    if (!isInitialized || !trackInteractions) return;

    try {
      await analyticsManager.trackInteraction(action, target, value, {
        ...options,
        debugMode,
      });
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  }, [isInitialized, trackInteractions, debugMode]);

  const trackConversion = useCallback(async (
    conversionType: string,
    value: number,
    currency?: string,
    attribution?: any,
    options: any = {}
  ): Promise<void> => {
    if (!isInitialized) return;

    try {
      await analyticsManager.trackConversion(conversionType, value, currency, attribution, {
        ...options,
        debugMode,
      });
    } catch (error) {
      console.error('Failed to track conversion:', error);
    }
  }, [isInitialized, debugMode]);

  const trackPerformance = useCallback(async (
    metrics: Partial<PerformanceMetrics>,
    options: any = {}
  ): Promise<void> => {
    if (!isInitialized || !trackPerformance) return;

    try {
      await analyticsManager.trackPerformance(metrics, {
        ...options,
        debugMode,
      });
    } catch (error) {
      console.error('Failed to track performance:', error);
    }
  }, [isInitialized, trackPerformance, debugMode]);

  const trackError = useCallback(async (
    error: Error,
    context: any = {},
    options: any = {}
  ): Promise<void> => {
    if (!isInitialized || !trackErrors) return;

    try {
      await analyticsManager.trackError(error, context, {
        ...options,
        debugMode,
      });
    } catch (error) {
      console.error('Failed to track error:', error);
    }
  }, [isInitialized, trackErrors, debugMode]);

  const trackFunnelStep = useCallback(async (
    funnelId: string,
    stageId: string,
    userId?: string
  ): Promise<void> => {
    if (!isInitialized) return;

    try {
      await analyticsManager.trackFunnelStep(funnelId, stageId, userId);
    } catch (error) {
      console.error('Failed to track funnel step:', error);
    }
  }, [isInitialized]);

  const trackABTestExposure = useCallback(async (
    testId: string,
    variantId: string,
    userId?: string
  ): Promise<void> => {
    if (!isInitialized) return;

    try {
      await analyticsManager.trackABTestExposure(testId, variantId, userId);
    } catch (error) {
      console.error('Failed to track A/B test exposure:', error);
    }
  }, [isInitialized]);

  const trackABTestConversion = useCallback(async (
    testId: string,
    variantId: string,
    metric: string,
    value: number,
    userId?: string
  ): Promise<void> => {
    if (!isInitialized) return;

    try {
      await analyticsManager.trackABTestConversion(testId, variantId, metric, value, userId);
    } catch (error) {
      console.error('Failed to track A/B test conversion:', error);
    }
  }, [isInitialized]);

  const updateConfig = useCallback(async (newConfig: Partial<AnalyticsConfig>): Promise<void> => {
    try {
      await analyticsManager.updateConfig(newConfig);
      setConfig(analyticsManager['config']);
    } catch (error) {
      console.error('Failed to update analytics config:', error);
    }
  }, []);

  return {
    trackEvent,
    trackPageView,
    trackInteraction,
    trackConversion,
    trackPerformance,
    trackError,
    trackFunnelStep,
    trackABTestExposure,
    trackABTestConversion,
    isInitialized,
    privacySettings,
    currentSession,
    realTimeMetrics,
    config,
    updateConfig,
  };
}

// Page analytics hook
export function usePageAnalytics(
  page: string,
  options: UsePageAnalyticsOptions = {}
): UsePageAnalyticsReturn {
  const {
    trackPageView = true,
    trackScroll = true,
    trackClicks = true,
    trackFormSubmissions = true,
    trackTimeOnPage = true,
    enableHeatmap = false
  } = options;

  const { trackEvent, trackPageView: trackPage } = useAnalytics({
    autoTrack: true,
    trackPageViews,
    trackInteractions: true,
  });

  const [pageViews, setPageViews] = useState(0);
  const [timeOnPage, setTimeOnPage] = useState(0);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [clickEvents, setClickEvents] = useState<any[]>([]);
  const [bounceRate, setBounceRate] = useState(0);
  const [exitRate, setExitRate] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);

  const startTime = useRef(Date.now());
  const maxScrollDepth = useRef(0);
  const interactionCount = useRef(0);
  const conversions = useRef(0);

  useEffect(() => {
    if (trackPageView) {
      trackPage(page, { timestamp: Date.now() });
      setPageViews(prev => prev + 1);
    }

    // Track scroll events
    if (trackScroll) {
      const handleScroll = () => {
        const scrollPercentage = Math.round(
          (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
        );
        maxScrollDepth.current = Math.max(maxScrollDepth.current, scrollPercentage);
        setScrollDepth(scrollPercentage);

        // Track scroll depth milestones
        if (scrollPercentage === 25 || scrollPercentage === 50 || scrollPercentage === 75 || scrollPercentage === 100) {
          trackEvent('scroll_milestone', 'engagement', {
            page,
            scrollDepth: scrollPercentage,
            timestamp: Date.now(),
          });
        }
      };

      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [page, trackPageView, trackScroll, trackPage, trackEvent]);

  useEffect(() => {
    // Track click events
    if (trackClicks) {
      const handleClick = (event: MouseEvent) => {
        const clickData = {
          x: event.clientX,
          y: event.clientY,
          target: (event.target as HTMLElement).tagName,
          timestamp: Date.now(),
          page,
        };

        setClickEvents(prev => [...prev, clickData]);
        interactionCount.current++;

        trackEvent('click', 'interaction', {
          ...clickData,
          enableHeatmap,
        });
      };

      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [page, trackClicks, enableHeatmap, trackEvent]);

  useEffect(() => {
    // Track time on page
    if (trackTimeOnPage) {
      const interval = setInterval(() => {
        setTimeOnPage(Date.now() - startTime.current);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [trackTimeOnPage]);

  useEffect(() => {
    // Track form submissions
    if (trackFormSubmissions) {
      const handleFormSubmit = (event: Event) => {
        const form = event.target as HTMLFormElement;
        trackEvent('form_submit', 'conversion', {
          page,
          formId: form.id,
          timestamp: Date.now(),
        });
        conversions.current++;
      };

      document.addEventListener('submit', handleFormSubmit);
      return () => document.removeEventListener('submit', handleFormSubmit);
    }
  }, [page, trackFormSubmissions, trackEvent]);

  useEffect(() => {
    // Calculate rates
    const hasInteractions = interactionCount.current > 0 || maxScrollDepth.current > 0;
    setBounceRate(hasInteractions ? 0 : 1);
    setExitRate(0); // Simplified calculation
    setConversionRate(pageViews > 0 ? conversions.current / pageViews : 0);
  }, [pageViews]);

  return {
    pageViews,
    timeOnPage,
    scrollDepth,
    clickEvents,
    bounceRate,
    exitRate,
    conversionRate,
  };
}

// Performance analytics hook
export function usePerformanceAnalytics(
  options: UsePerformanceAnalyticsOptions = {}
): UsePerformanceAnalyticsReturn {
  const {
    trackPageLoad = true,
    trackResourceTiming = true,
    trackUserTiming = true,
    trackMemoryUsage = true,
    trackNetworkRequests = true,
    trackErrors = true,
    sampleRate = 0.1
  } = options;

  const { trackEvent, trackPerformance } = useAnalytics({
    autoTrack: true,
    trackPerformance: true,
    trackErrors: true,
  });

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    pageLoadTime: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    firstInputDelay: 0,
    cumulativeLayoutShift: 0,
    timeToInteractive: 0,
    totalBlockingTime: 0,
    memoryUsage: 0,
    networkLatency: 0,
    apiResponseTime: 0,
    renderTime: 0,
    scriptExecutionTime: 0,
    resourceLoadTime: 0,
  });

  const [isHealthy, setIsHealthy] = useState(true);
  const [issues, setIssues] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('performance' in window)) return;

    // Track page load performance
    if (trackPageLoad) {
      const trackPageLoadMetrics = () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        const lcp = performance.getEntriesByType('largest-contentful-paint')[0] as LargestContentfulPaint;
        const fid = performance.getEntriesByType('first-input')[0] as PerformanceEventTiming;
        const cls = performance.getEntriesByType('layout-shift')[0] as LayoutShift;

        const pageLoadMetrics: Partial<PerformanceMetrics> = {
          pageLoadTime: navigation.loadEventEnd - navigation.loadEventStart,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          largestContentfulPaint: lcp?.startTime || 0,
          firstInputDelay: fid?.processingStart - fid?.startTime || 0,
          cumulativeLayoutShift: cls?.value || 0,
          timeToInteractive: navigation.domInteractive - navigation.fetchStart,
          totalBlockingTime: 0, // Requires more complex calculation
        };

        setMetrics(prev => ({ ...prev, ...pageLoadMetrics }));
        trackPerformance(pageLoadMetrics);

        // Analyze performance health
        analyzePerformanceHealth(pageLoadMetrics);
      };

      if (document.readyState === 'complete') {
        trackPageLoadMetrics();
      } else {
        window.addEventListener('load', trackPageLoadMetrics);
      }

      return () => window.removeEventListener('load', trackPageLoadMetrics);
    }
  }, [trackPageLoad, trackPerformance]);

  useEffect(() => {
    // Track memory usage
    if (trackMemoryUsage && 'memory' in (performance as any)) {
      const interval = setInterval(() => {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;

        setMetrics(prev => ({ ...prev, memoryUsage }));

        if (memoryUsage > 0.8) {
          trackEvent('memory_warning', 'performance', {
            memoryUsage,
            timestamp: Date.now(),
          });
        }
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [trackMemoryUsage, trackEvent]);

  useEffect(() => {
    // Track network requests
    if (trackNetworkRequests) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        entries.forEach(entry => {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;

            trackEvent('resource_timing', 'performance', {
              url: resourceEntry.name,
              duration: resourceEntry.duration,
              size: resourceEntry.transferSize,
              timestamp: Date.now(),
            });
          }
        });
      });

      observer.observe({ entryTypes: ['resource'] });
      return () => observer.disconnect();
    }
  }, [trackNetworkRequests, trackEvent]);

  const analyzePerformanceHealth = useCallback((metrics: Partial<PerformanceMetrics>) => {
    const newIssues: string[] = [];
    const newRecommendations: string[] = [];
    let healthy = true;

    // Check page load time
    if (metrics.pageLoadTime && metrics.pageLoadTime > 3000) {
      newIssues.push('Slow page load time');
      newRecommendations.push('Optimize images and assets');
      healthy = false;
    }

    // Check LCP
    if (metrics.largestContentfulPaint && metrics.largestContentfulPaint > 2500) {
      newIssues.push('Poor LCP score');
      newRecommendations.push('Optimize above-the-fold content');
      healthy = false;
    }

    // Check FID
    if (metrics.firstInputDelay && metrics.firstInputDelay > 100) {
      newIssues.push('High input delay');
      newRecommendations.push('Reduce JavaScript execution time');
      healthy = false;
    }

    // Check CLS
    if (metrics.cumulativeLayoutShift && metrics.cumulativeLayoutShift > 0.1) {
      newIssues.push('Layout shift issues');
      newRecommendations.push('Specify dimensions for media elements');
      healthy = false;
    }

    setIssues(newIssues);
    setRecommendations(newRecommendations);
    setIsHealthy(healthy);
  }, []);

  return {
    metrics,
    isHealthy,
    issues,
    recommendations,
  };
}

// User analytics hook
export function useUserAnalytics(
  userId?: string,
  options: UseUserAnalyticsOptions = {}
): UseUserAnalyticsReturn {
  const {
    trackBehavior = true,
    trackPreferences = true,
    trackEngagement = true,
    trackRetention = true,
    trackLifetimeValue = true
  } = options;

  const { trackEvent, isInitialized } = useAnalytics({
    autoTrack: true,
    trackInteractions: trackBehavior,
  });

  const [userSessionId, setUserSessionId] = useState<string>('');
  const [sessionCount, setSessionCount] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [averageSessionDuration, setAverageSessionDuration] = useState(0);
  const [retentionRate, setRetentionRate] = useState(0);
  const [lifetimeValue, setLifetimeValue] = useState(0);
  const [userJourney, setUserJourney] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any>({});
  const [segments, setSegments] = useState<string[]>([]);

  useEffect(() => {
    if (!isInitialized) return;

    const sessionId = generateSessionId();
    setUserSessionId(sessionId);

    // Track session start
    trackEvent('session_start', 'user', {
      userId,
      sessionId,
      timestamp: Date.now(),
    });

    setSessionCount(prev => prev + 1);

    // Load user data
    loadUserData();

    // Analyze user behavior
    analyzeUserBehavior();
  }, [isInitialized, userId, trackEvent]);

  const loadUserData = useCallback(async () => {
    try {
      // Load user preferences
      const userPrefs = localStorage.getItem(`user_preferences_${userId}`);
      if (userPrefs) {
        setPreferences(JSON.parse(userPrefs));
      }

      // Load user journey
      const journey = await analyticsManager.getUserJourney(userId);
      setUserJourney(journey);

      // Calculate lifetime value
      if (trackLifetimeValue) {
        const ltv = calculateLifetimeValue(journey);
        setLifetimeValue(ltv);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }, [userId, trackLifetimeValue]);

  const analyzeUserBehavior = useCallback(async () => {
    try {
      // Analyze user segments
      const userSegments = await analyzeUserSegments(userId);
      setSegments(userSegments);

      // Calculate retention rate
      if (trackRetention) {
        const retention = await calculateRetentionRate(userId);
        setRetentionRate(retention);
      }
    } catch (error) {
      console.error('Failed to analyze user behavior:', error);
    }
  }, [userId, trackRetention]);

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const calculateLifetimeValue = (journey: any[]) => {
    // Simplified LTV calculation
    return journey.reduce((sum, event) => {
      if (event.type === 'conversion') {
        return sum + (event.eventData.value || 0);
      }
      return sum;
    }, 0);
  };

  const analyzeUserSegments = async (userId: string): Promise<string[]> => {
    // Analyze user behavior patterns and assign segments
    const segments: string[] = [];

    // Add demographic segments
    segments.push('active_user');

    // Add behavior-based segments
    if (totalEvents > 100) {
      segments.push('highly_engaged');
    }

    if (sessionCount > 10) {
      segments.push('frequent_visitor');
    }

    return segments;
  };

  const calculateRetentionRate = async (userId: string): Promise<number> => {
    // Simplified retention calculation
    return Math.random() * 0.5 + 0.5; // 50-100%
  };

  return {
    userId: userId || 'anonymous',
    sessionId: userSessionId,
    sessionCount,
    totalEvents,
    averageSessionDuration,
    retentionRate,
    lifetimeValue,
    userJourney,
    preferences,
    segments,
  };
}

// Real-time analytics hook
export function useRealTimeAnalytics(
  options: UseRealTimeAnalyticsOptions = {}
): UseRealTimeAnalyticsReturn {
  const {
    enabled = true,
    updateInterval = 5000,
    metrics: trackedMetrics = [],
    filters = {}
  } = options;

  const [metrics, setMetrics] = useState<RealTimeMetrics>({
    activeUsers: 0,
    currentPageViews: 0,
    eventsPerSecond: 0,
    averageSessionDuration: 0,
    bounceRate: 0,
    topPages: [],
    topEvents: [],
    topReferrers: [],
    conversions: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const subscribers = useRef<Map<string, (metrics: RealTimeMetrics) => void>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    const updateMetrics = async () => {
      try {
        setIsLoading(true);

        const newMetrics = await analyticsManager.getRealTimeMetrics();

        // Apply filters
        const filteredMetrics = applyFilters(newMetrics, filters);

        setMetrics(filteredMetrics);
        setLastUpdated(new Date());
        setError(null);

        // Notify subscribers
        subscribers.current.forEach(callback => {
          callback(filteredMetrics);
        });

      } catch (err) {
        setError(err as Error);
        console.error('Failed to fetch real-time metrics:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    updateMetrics();

    // Set up interval
    const interval = setInterval(updateMetrics, updateInterval);

    return () => clearInterval(interval);
  }, [enabled, updateInterval, filters]);

  const subscribe = useCallback((callback: (metrics: RealTimeMetrics) => void) => {
    const id = Math.random().toString(36).substr(2, 9);
    subscribers.current.set(id, callback);

    return () => {
      subscribers.current.delete(id);
    };
  }, []);

  const applyFilters = (metrics: RealTimeMetrics, filters: Record<string, any>): RealTimeMetrics => {
    let filtered = { ...metrics };

    // Apply metric filters
    if (trackedMetrics.length > 0) {
      filtered = Object.keys(filtered).reduce((acc, key) => {
        if (trackedMetrics.includes(key)) {
          (acc as any)[key] = (filtered as any)[key];
        }
        return acc;
      }, {} as RealTimeMetrics);
    }

    return filtered;
  };

  return {
    metrics,
    isLoading,
    error,
    lastUpdated,
    subscribe,
  };
}

// Funnel analytics hook
export function useFunnelAnalytics(
  funnelId: string,
  options: UseFunnelAnalyticsOptions = {}
): UseFunnelAnalyticsReturn {
  const {
    autoTrack = true,
    debugMode = false,
    realTimeUpdates = true
  } = options;

  const { trackEvent, trackFunnelStep } = useAnalytics({
    autoTrack,
    debugMode,
  });

  const [funnel, setFunnel] = useState<FunnelAnalytics | null>(null);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadFunnelData();
  }, [funnelId]);

  useEffect(() => {
    if (realTimeUpdates && funnel) {
      const interval = setInterval(() => {
        loadFunnelData();
      }, 10000); // Update every 10 seconds

      return () => clearInterval(interval);
    }
  }, [realTimeUpdates, funnel]);

  const loadFunnelData = async () => {
    try {
      // In a real implementation, this would fetch funnel data from an API
      const funnelData: FunnelAnalytics = {
        id: funnelId,
        name: 'Sample Funnel',
        stages: [
          { id: 'stage1', name: 'Awareness', order: 0, entries: 100, exits: 20, conversions: 80, dropoffRate: 0.2, averageTime: 30, conditions: [] },
          { id: 'stage2', name: 'Consideration', order: 1, entries: 80, exits: 30, conversions: 50, dropoffRate: 0.375, averageTime: 60, conditions: [] },
          { id: 'stage3', name: 'Decision', order: 2, entries: 50, exits: 10, conversions: 40, dropoffRate: 0.2, averageTime: 45, conditions: [] },
        ],
        conversionRate: 0.4,
        dropoffRate: 0.6,
        averageTimeInFunnel: 135,
        totalEntries: 100,
        totalConversions: 40,
        created: new Date(),
        updated: new Date(),
      };

      setFunnel(funnelData);

      // Calculate progress
      const completedStages = funnelData.stages.filter(stage => stage.conversions > 0).length;
      const totalStages = funnelData.stages.length;
      setProgress((completedStages / totalStages) * 100);
    } catch (error) {
      console.error('Failed to load funnel data:', error);
    }
  };

  const trackStep = useCallback(async (stageId: string): Promise<void> => {
    try {
      await trackFunnelStep(funnelId, stageId);
      setCurrentStage(stageId);

      // Update progress
      if (funnel) {
        const stageIndex = funnel.stages.findIndex(s => s.id === stageId);
        if (stageIndex >= 0) {
          const progress = ((stageIndex + 1) / funnel.stages.length) * 100;
          setProgress(progress);
        }
      }
    } catch (error) {
      console.error('Failed to track funnel step:', error);
    }
  }, [funnelId, funnel, trackFunnelStep]);

  const getInsights = useCallback(() => {
    if (!funnel) return null;

    const insights = {
      topDropoffStages: funnel.stages
        .sort((a, b) => b.dropoffRate - a.dropoffRate)
        .slice(0, 3),
      conversionTrend: 'improving',
      recommendations: [
        'Optimize stage 2 to reduce dropoff',
        'Improve user flow between stages',
      ],
    };

    return insights;
  }, [funnel]);

  return {
    funnel,
    currentStage,
    progress,
    conversionRate: funnel?.conversionRate || 0,
    dropoffRate: funnel?.dropoffRate || 0,
    trackStep,
    getInsights,
  };
}

// A/B testing hook
export function useABTest(
  testId: string,
  variants: string[],
  options: UseABTestOptions = {}
): UseABTestReturn {
  const {
    autoTrack = true,
    debugMode = false,
    forceVariant
  } = options;

  const { trackEvent, trackABTestExposure, trackABTestConversion } = useAnalytics({
    autoTrack,
    debugMode,
  });

  const [variant, setVariant] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    assignVariant();
  }, [testId, variants, forceVariant]);

  const assignVariant = () => {
    try {
      setIsLoading(true);

      // Force variant if specified
      if (forceVariant && variants.includes(forceVariant)) {
        setVariant(forceVariant);
        return;
      }

      // Use deterministic assignment based on user ID or random assignment
      const userId = getUserId();
      const hash = simpleHash(userId + testId);
      const variantIndex = hash % variants.length;

      const assignedVariant = variants[variantIndex];
      setVariant(assignedVariant);

      // Track exposure
      if (autoTrack) {
        trackABTestExposure(testId, assignedVariant, userId);
      }
    } catch (error) {
      console.error('Failed to assign variant:', error);
      setVariant(variants[0] || 'control');
    } finally {
      setIsLoading(false);
    }
  };

  const getUserId = () => {
    return localStorage.getItem('user_id') || 'anonymous';
  };

  const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };

  const trackConversion = useCallback(async (metric: string, value: number): Promise<void> => {
    try {
      await trackABTestConversion(testId, variant, metric, value);
    } catch (error) {
      console.error('Failed to track A/B test conversion:', error);
    }
  }, [testId, variant, trackABTestConversion]);

  const trackExposure = useCallback(async (): Promise<void> => {
    try {
      await trackABTestExposure(testId, variant, getUserId());
    } catch (error) {
      console.error('Failed to track A/B test exposure:', error);
    }
  }, [testId, variant, trackABTestExposure]);

  const getTestResults = useCallback(() => {
    // In a real implementation, this would fetch test results from an API
    return {
      testId,
      variants: variants.map(v => ({
        id: v,
        conversions: Math.floor(Math.random() * 100),
        conversionRate: Math.random(),
        confidence: Math.random(),
        winner: v === variant,
      })),
      status: 'running',
      significance: false,
    };
  }, [testId, variants, variant]);

  return {
    variant,
    isLoading,
    trackConversion,
    trackExposure,
    getTestResults,
  };
}

// Consent management hook
export function useConsent(options: UseConsentOptions = {}): UseConsentReturn {
  const {
    autoShow = true,
    requiredCategories = ['essential'],
    optionalCategories = ['analytics', 'marketing', 'personalization'],
    privacyPolicyUrl = '/privacy-policy'
  } = options;

  const [hasConsent, setHasConsent] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentSettings, setConsentSettings] = useState<PrivacySettings>({
    level: 'anonymous',
    dataCollection: false,
    behavioralTracking: false,
    locationTracking: false,
    deviceTracking: false,
    cookieConsent: false,
    personalization: false,
    thirdPartySharing: false,
    retentionPeriod: 30,
  });

  useEffect(() => {
    loadConsentSettings();
  }, []);

  const loadConsentSettings = () => {
    try {
      const saved = localStorage.getItem('user_consent');
      if (saved) {
        const settings = JSON.parse(saved);
        setConsentSettings(settings);
        setHasConsent(true);

        // Apply consent settings to analytics
        analyticsPrivacy.updatePrivacySettings(settings);
      } else if (autoShow) {
        setShowConsent(true);
      }
    } catch (error) {
      console.error('Failed to load consent settings:', error);
      if (autoShow) {
        setShowConsent(true);
      }
    }
  };

  const saveConsent = async (settings: PrivacySettings): Promise<void> => {
    try {
      localStorage.setItem('user_consent', JSON.stringify(settings));
      setConsentSettings(settings);
      setHasConsent(true);
      setShowConsent(false);

      // Apply settings to analytics privacy
      await analyticsPrivacy.updatePrivacySettings(settings);
    } catch (error) {
      console.error('Failed to save consent settings:', error);
    }
  };

  const acceptAll = async (): Promise<void> => {
    const allAccepted: PrivacySettings = {
      ...consentSettings,
      level: 'identifiable',
      dataCollection: true,
      behavioralTracking: true,
      locationTracking: true,
      deviceTracking: true,
      cookieConsent: true,
      personalization: true,
      thirdPartySharing: true,
      retentionPeriod: 365,
    };

    await saveConsent(allAccepted);
  };

  const rejectAll = async (): Promise<void> => {
    const allRejected: PrivacySettings = {
      ...consentSettings,
      level: 'anonymous',
      dataCollection: false,
      behavioralTracking: false,
      locationTracking: false,
      deviceTracking: false,
      cookieConsent: false,
      personalization: false,
      thirdPartySharing: false,
      retentionPeriod: 30,
    };

    await saveConsent(allRejected);
  };

  const acceptCategory = async (category: string): Promise<void> => {
    const updated = { ...consentSettings };

    switch (category) {
      case 'essential':
        updated.dataCollection = true;
        break;
      case 'analytics':
        updated.behavioralTracking = true;
        break;
      case 'marketing':
        updated.personalization = true;
        break;
      case 'personalization':
        updated.personalization = true;
        break;
    }

    await saveConsent(updated);
  };

  const rejectCategory = async (category: string): Promise<void> => {
    const updated = { ...consentSettings };

    switch (category) {
      case 'analytics':
        updated.behavioralTracking = false;
        break;
      case 'marketing':
        updated.personalization = false;
        break;
      case 'personalization':
        updated.personalization = false;
        break;
    }

    await saveConsent(updated);
  };

  return {
    hasConsent,
    consentSettings,
    showConsent,
    acceptAll,
    rejectAll,
    acceptCategory,
    rejectCategory,
    saveConsent,
  };
}