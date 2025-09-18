/**
 * Error analytics and monitoring system for kid-friendly-ai
 * Provides comprehensive error tracking, analysis, and insights
 */

import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  ErrorEvent,
  ErrorMetrics,
  ErrorStatistics,
  ErrorAnalyticsConfig,
  ErrorReport
} from '../types/error';
import { errorLogger } from './errorLogger';

interface ErrorTrend {
  timestamp: number;
  errorCount: number;
  errorRate: number;
  severityBreakdown: Record<ErrorSeverity, number>;
  categoryBreakdown: Record<ErrorCategory, number>;
}

interface ErrorPattern {
  id: string;
  pattern: string;
  frequency: number;
  severity: ErrorSeverity;
  impactScore: number;
  commonContext: Record<string, any>;
  suggestedAction: string;
  confidence: number;
  lastSeen: number;
  firstSeen: number;
}

interface UserImpactAnalysis {
  totalAffectedUsers: number;
  averageErrorsPerUser: number;
  userRetentionImpact: number;
  satisfactionImpact: number;
  criticalErrorUsers: number;
  recoverySuccessByUser: Record<string, number>;
}

interface PerformanceCorrelation {
  errorRate: number;
  pageLoadTime: number;
  memoryUsage: number;
  networkLatency: number;
  timestamp: number;
}

interface HealthIndicator {
  overallHealth: number;
  errorHealth: number;
  performanceHealth: number;
  userExperienceHealth: number;
  timestamp: number;
  recommendations: string[];
}

export class ErrorAnalytics {
  private static instance: ErrorAnalytics;
  private config: ErrorAnalyticsConfig;
  private errorTrends: ErrorTrend[] = [];
  private errorPatterns: ErrorPattern[] = [];
  private performanceData: PerformanceCorrelation[] = [];
  private healthIndicators: HealthIndicator[] = [];
  private userImpactData: UserImpactAnalysis;
  private analysisInterval: NodeJS.Timeout | null = null;

  private constructor(config: Partial<ErrorAnalyticsConfig> = {}) {
    this.config = {
      enabled: true,
      trackFrequency: true,
      trackPatterns: true,
      trackUserImpact: true,
      trackRecoverySuccess: true,
      aggregationInterval: 60000, // 1 minute
      maxStoredErrors: 1000,
      ...config
    };

    this.userImpactData = {
      totalAffectedUsers: 0,
      averageErrorsPerUser: 0,
      userRetentionImpact: 0,
      satisfactionImpact: 0,
      criticalErrorUsers: 0,
      recoverySuccessByUser: {}
    };

    this.initializeAnalytics();
  }

  static getInstance(config?: Partial<ErrorAnalyticsConfig>): ErrorAnalytics {
    if (!ErrorAnalytics.instance) {
      ErrorAnalytics.instance = new ErrorAnalytics(config);
    }
    return ErrorAnalytics.instance;
  }

  private initializeAnalytics(): void {
    if (this.config.enabled) {
      // Start periodic analysis
      this.analysisInterval = setInterval(() => {
        this.performPeriodicAnalysis();
      }, this.config.aggregationInterval);

      // Track performance metrics
      this.startPerformanceTracking();

      // Initialize with current data
      this.performPeriodicAnalysis();
    }
  }

  private startPerformanceTracking(): void {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return;
    }

    // Track navigation timing
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.trackPerformanceMetrics({
          errorRate: this.getCurrentErrorRate(),
          pageLoadTime: navigation.loadEventEnd - navigation.loadEventStart,
          memoryUsage: this.getMemoryUsage(),
          networkLatency: navigation.responseEnd - navigation.requestStart,
          timestamp: Date.now()
        });
      }
    });

    // Track ongoing performance
    setInterval(() => {
      this.trackPerformanceMetrics({
        errorRate: this.getCurrentErrorRate(),
        pageLoadTime: this.getCurrentPageLoadTime(),
        memoryUsage: this.getMemoryUsage(),
        networkLatency: this.getNetworkLatency(),
        timestamp: Date.now()
      });
    }, 30000); // Every 30 seconds
  }

  private getMemoryUsage(): number {
    if ('memory' in (performance as any)) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / memory.totalJSHeapSize;
    }
    return 0;
  }

  private getCurrentPageLoadTime(): number {
    if ('performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        return navigation.loadEventEnd - navigation.loadEventStart;
      }
    }
    return 0;
  }

  private getNetworkLatency(): number {
    // Simple network latency test
    const start = Date.now();
    return fetch('/api/health', { method: 'HEAD' })
      .then(() => Date.now() - start)
      .catch(() => 0);
  }

  // Track error events
  trackError(error: AppError, context?: any): void {
    if (!this.config.enabled) return;

    const event: ErrorEvent = {
      id: this.generateEventId(),
      error,
      context: {
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        ...context
      }
    };

    // Update user impact analysis
    this.updateUserImpactAnalysis(event);

    // Analyze for patterns
    if (this.config.trackPatterns) {
      this.analyzeErrorPattern(event);
    }

    // Track frequency
    if (this.config.trackFrequency) {
      this.updateErrorFrequency(event);
    }
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateUserImpactAnalysis(event: ErrorEvent): void {
    if (!this.config.trackUserImpact) return;

    const userId = event.context.userId || 'anonymous';

    // Update recovery success tracking
    if (event.recoveryAttempt) {
      this.userImpactData.recoverySuccessByUser[userId] =
        (this.userImpactData.recoverySuccessByUser[userId] || 0) +
        (event.recoveryAttempt.success ? 1 : 0);
    }

    // Count affected users
    const uniqueUsers = new Set([
      ...Object.keys(this.userImpactData.recoverySuccessByUser),
      userId
    ]);
    this.userImpactData.totalAffectedUsers = uniqueUsers.size;

    // Calculate average errors per user
    const totalErrors = Object.values(this.userImpactData.recoverySuccessByUser)
      .reduce((sum, successes) => sum + successes, 0) + 1;
    this.userImpactData.averageErrorsPerUser = totalErrors / uniqueUsers.size;

    // Track critical errors
    if (event.error.severity === ErrorSeverity.CRITICAL) {
      this.userImpactData.criticalErrorUsers++;
    }

    // Calculate satisfaction impact (simple heuristic)
    const criticalErrorWeight = 3;
    const highErrorWeight = 2;
    const mediumErrorWeight = 1;
    const lowErrorWeight = 0.5;

    let satisfactionScore = 100;
    if (event.error.severity === ErrorSeverity.CRITICAL) {
      satisfactionScore -= criticalErrorWeight * 10;
    } else if (event.error.severity === ErrorSeverity.HIGH) {
      satisfactionScore -= highErrorWeight * 5;
    } else if (event.error.severity === ErrorSeverity.MEDIUM) {
      satisfactionScore -= mediumErrorWeight * 2;
    } else {
      satisfactionScore -= lowErrorWeight;
    }

    this.userImpactData.satisfactionImpact = Math.max(0, satisfactionScore);
  }

  private analyzeErrorPattern(event: ErrorEvent): void {
    const recentErrors = errorLogger.getLogEntries(50);
    if (recentErrors.length < 5) return;

    // Look for patterns in recent errors
    const patterns = this.detectErrorPatterns(recentErrors);

    patterns.forEach(pattern => {
      const existingPattern = this.errorPatterns.find(p => p.id === pattern.id);

      if (existingPattern) {
        // Update existing pattern
        existingPattern.frequency++;
        existingPattern.lastSeen = Date.now();
        existingPattern.confidence = Math.min(1, existingPattern.confidence + 0.1);
      } else {
        // Add new pattern
        this.errorPatterns.push(pattern);
      }
    });

    // Keep only recent patterns
    this.errorPatterns = this.errorPatterns.filter(p =>
      Date.now() - p.lastSeen < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    // Limit patterns stored
    if (this.errorPatterns.length > 100) {
      this.errorPatterns = this.errorPatterns
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 100);
    }
  }

  private detectErrorPatterns(errors: any[]): ErrorPattern[] {
    const patterns: ErrorPattern[] = [];

    // Pattern 1: Same error type in short time
    const errorTypeGroups = this.groupBy(errors, (e: any) => e.error.name);
    Object.entries(errorTypeGroups).forEach(([errorType, group]) => {
      if (group.length >= 3) {
        patterns.push({
          id: `type_${errorType}`,
          pattern: `Multiple ${errorType} errors`,
          frequency: group.length,
          severity: this.getMaxSeverity(group.map((g: any) => g.error)),
          impactScore: this.calculatePatternImpact(group),
          commonContext: this.extractCommonContext(group),
          suggestedAction: this.generateSuggestedAction(group[0].error),
          confidence: Math.min(1, group.length / 10),
          lastSeen: Date.now(),
          firstSeen: Math.min(...group.map((g: any) => g.timestamp))
        });
      }
    });

    // Pattern 2: Same category errors
    const categoryGroups = this.groupBy(errors, (e: any) => e.error.category);
    Object.entries(categoryGroups).forEach(([category, group]) => {
      if (group.length >= 5) {
        patterns.push({
          id: `category_${category}`,
          pattern: `Multiple ${category} related errors`,
          frequency: group.length,
          severity: this.getMaxSeverity(group.map((g: any) => g.error)),
          impactScore: this.calculatePatternImpact(group),
          commonContext: this.extractCommonContext(group),
          suggestedAction: this.generateSuggestedAction({ category }),
          confidence: Math.min(1, group.length / 15),
          lastSeen: Date.now(),
          firstSeen: Math.min(...group.map((g: any) => g.timestamp))
        });
      }
    });

    return patterns;
  }

  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private getMaxSeverity(errors: AppError[]): ErrorSeverity {
    const severityOrder = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 1,
      [ErrorSeverity.HIGH]: 2,
      [ErrorSeverity.CRITICAL]: 3
    };

    let maxSeverity = ErrorSeverity.LOW;
    let maxScore = 0;

    errors.forEach(error => {
      const score = severityOrder[error.severity];
      if (score > maxScore) {
        maxScore = score;
        maxSeverity = error.severity;
      }
    });

    return maxSeverity;
  }

  private calculatePatternImpact(errors: any[]): number {
    const severityScores = {
      [ErrorSeverity.LOW]: 1,
      [ErrorSeverity.MEDIUM]: 3,
      [ErrorSeverity.HIGH]: 7,
      [ErrorSeverity.CRITICAL]: 10
    };

    const totalImpact = errors.reduce((sum, error) => {
      return sum + severityScores[error.error.severity];
    }, 0);

    return Math.min(10, totalImpact / errors.length);
  }

  private extractCommonContext(errors: any[]): Record<string, any> {
    if (errors.length === 0) return {};

    const commonContext: Record<string, any> = {};

    // Common URLs
    const urls = errors.map(e => e.url).filter(Boolean);
    if (urls.length > 0) {
      commonContext.commonUrl = this.findMostCommon(urls);
    }

    // Common components
    const components = errors.map(e => e.context?.component).filter(Boolean);
    if (components.length > 0) {
      commonContext.commonComponent = this.findMostCommon(components);
    }

    // Common user agents
    const userAgents = errors.map(e => e.userAgent).filter(Boolean);
    if (userAgents.length > 0) {
      commonContext.commonUserAgent = this.findMostCommon(userAgents);
    }

    return commonContext;
  }

  private findMostCommon(items: string[]): string {
    const frequency: Record<string, number> = {};
    items.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });

    let mostCommon = items[0];
    let maxCount = 1;

    Object.entries(frequency).forEach(([item, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    });

    return mostCommon;
  }

  private generateSuggestedAction(error: Partial<AppError>): string {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return 'Investigate network connectivity and API endpoints';
      case ErrorCategory.API:
        return 'Review API implementation and error handling';
      case ErrorCategory.UI:
        return 'Examine component state and user interactions';
      case ErrorCategory.AUDIO:
        return 'Check audio permissions and device compatibility';
      case ErrorCategory.SPEECH:
        return 'Verify speech recognition setup and browser support';
      case ErrorCategory.GAME:
        return 'Review game logic and state management';
      case ErrorCategory.PERFORMANCE:
        return 'Optimize performance and resource usage';
      default:
        return 'Review error logs and implement targeted fixes';
    }
  }

  private updateErrorFrequency(event: ErrorEvent): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old trend data
    this.errorTrends = this.errorTrends.filter(trend => trend.timestamp > oneMinuteAgo);

    // Calculate current frequency
    const recentEvents = this.errorTrends.filter(trend =>
      trend.timestamp > oneMinuteAgo
    ).length;

    const errorRate = recentEvents / 60; // errors per second

    // Add new trend data point
    this.errorTrends.push({
      timestamp: now,
      errorCount: recentEvents + 1,
      errorRate,
      severityBreakdown: this.getSeverityBreakdown(),
      categoryBreakdown: this.getCategoryBreakdown()
    });

    // Keep only recent trends
    if (this.errorTrends.length > 100) {
      this.errorTrends = this.errorTrends.slice(-100);
    }
  }

  private getSeverityBreakdown(): Record<ErrorSeverity, number> {
    const logs = errorLogger.getLogEntries(100);
    const breakdown: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;

    Object.values(ErrorSeverity).forEach(severity => {
      breakdown[severity] = logs.filter(entry => entry.error.severity === severity).length;
    });

    return breakdown;
  }

  private getCategoryBreakdown(): Record<ErrorCategory, number> {
    const logs = errorLogger.getLogEntries(100);
    const breakdown: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;

    Object.values(ErrorCategory).forEach(category => {
      breakdown[category] = logs.filter(entry => entry.error.category === category).length;
    });

    return breakdown;
  }

  private getCurrentErrorRate(): number {
    const recentTrends = this.errorTrends.filter(trend =>
      trend.timestamp > Date.now() - 300000 // Last 5 minutes
    );

    if (recentTrends.length === 0) return 0;

    const totalErrors = recentTrends.reduce((sum, trend) => sum + trend.errorCount, 0);
    return totalErrors / (recentTrends.length * 60); // errors per second
  }

  private trackPerformanceMetrics(correlation: PerformanceCorrelation): void {
    this.performanceData.push(correlation);

    // Keep only recent data
    if (this.performanceData.length > 1000) {
      this.performanceData = this.performanceData.slice(-1000);
    }
  }

  private performPeriodicAnalysis(): void {
    // Calculate health indicators
    const health = this.calculateHealthIndicators();
    this.healthIndicators.push(health);

    // Keep only recent health data
    if (this.healthIndicators.length > 1440) { // 24 hours of minute data
      this.healthIndicators = this.healthIndicators.slice(-1440);
    }

    // Log analytics summary
    console.log('Error Analytics Summary:', {
      errorRate: this.getCurrentErrorRate(),
      healthScore: health.overallHealth,
      activePatterns: this.errorPatterns.length,
      userImpact: this.userImpactData.satisfactionImpact
    });
  }

  private calculateHealthIndicators(): HealthIndicator {
    const currentErrorRate = this.getCurrentErrorRate();
    const metrics = errorLogger.getErrorStatistics();

    // Error health (0-100)
    const errorHealth = Math.max(0, 100 - (currentErrorRate * 1000) - (metrics.totalErrors * 0.1));

    // Performance health (0-100)
    const avgPageLoadTime = this.getAveragePageLoadTime();
    const avgMemoryUsage = this.getAverageMemoryUsage();
    const performanceHealth = Math.max(0, 100 - (avgPageLoadTime / 10) - (avgMemoryUsage * 50));

    // User experience health (0-100)
    const userExperienceHealth = this.userImpactData.satisfactionImpact;

    // Overall health
    const overallHealth = (errorHealth + performanceHealth + userExperienceHealth) / 3;

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      errorRate: currentErrorRate,
      errorHealth,
      performanceHealth,
      userExperienceHealth,
      metrics
    });

    return {
      overallHealth: Math.round(overallHealth),
      errorHealth: Math.round(errorHealth),
      performanceHealth: Math.round(performanceHealth),
      userExperienceHealth: Math.round(userExperienceHealth),
      timestamp: Date.now(),
      recommendations
    };
  }

  private getAveragePageLoadTime(): number {
    if (this.performanceData.length === 0) return 0;
    const totalTime = this.performanceData.reduce((sum, data) => sum + data.pageLoadTime, 0);
    return totalTime / this.performanceData.length;
  }

  private getAverageMemoryUsage(): number {
    if (this.performanceData.length === 0) return 0;
    const totalMemory = this.performanceData.reduce((sum, data) => sum + data.memoryUsage, 0);
    return totalMemory / this.performanceData.length;
  }

  private generateRecommendations(data: {
    errorRate: number;
    errorHealth: number;
    performanceHealth: number;
    userExperienceHealth: number;
    metrics: any;
  }): string[] {
    const recommendations: string[] = [];

    // Error-based recommendations
    if (data.errorHealth < 70) {
      recommendations.push('High error rate detected. Review error logs and implement fixes.');
    }

    if (data.errorRate > 0.1) {
      recommendations.push('Frequent errors occurring. Consider implementing circuit breakers.');
    }

    // Performance-based recommendations
    if (data.performanceHealth < 70) {
      recommendations.push('Performance degradation detected. Optimize resource usage.');
    }

    if (this.getAveragePageLoadTime() > 3000) {
      recommendations.push('Slow page load times. Consider implementing lazy loading.');
    }

    // User experience recommendations
    if (data.userExperienceHealth < 70) {
      recommendations.push('User satisfaction declining. Review user feedback and error patterns.');
    }

    // Pattern-based recommendations
    this.errorPatterns.forEach(pattern => {
      if (pattern.frequency > 10 && pattern.confidence > 0.7) {
        recommendations.push(`High-frequency pattern detected: ${pattern.suggestedAction}`);
      }
    });

    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  // Public API methods
  getAnalytics(): {
    trends: ErrorTrend[];
    patterns: ErrorPattern[];
    health: HealthIndicator | null;
    userImpact: UserImpactAnalysis;
    performanceCorrelation: PerformanceCorrelation[];
  } {
    return {
      trends: [...this.errorTrends],
      patterns: [...this.errorPatterns],
      health: this.healthIndicators[this.healthIndicators.length - 1] || null,
      userImpact: { ...this.userImpactData },
      performanceCorrelation: [...this.performanceData]
    };
  }

  getErrorStatistics(): ErrorStatistics {
    return errorLogger.getErrorStatistics();
  }

  getErrorPatterns(): ErrorPattern[] {
    return [...this.errorPatterns].sort((a, b) => b.frequency - a.frequency);
  }

  getHealthStatus(): HealthIndicator | null {
    return this.healthIndicators[this.healthIndicators.length - 1] || null;
  }

  getTopErrors(limit: number = 10): Array<{
    error: AppError;
    count: number;
    percentage: number;
  }> {
    const logs = errorLogger.getLogEntries();
    const errorCounts: Record<string, { error: AppError; count: number }> = {};

    logs.forEach(entry => {
      const key = `${entry.error.name}:${entry.error.message}`;
      if (!errorCounts[key]) {
        errorCounts[key] = { error: entry.error, count: 0 };
      }
      errorCounts[key].count++;
    });

    return Object.values(errorCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(item => ({
        ...item,
        percentage: (item.count / logs.length) * 100
      }));
  }

  getPerformanceCorrelation(): PerformanceCorrelation[] {
    return [...this.performanceData];
  }

  exportAnalytics(): string {
    return JSON.stringify({
      trends: this.errorTrends,
      patterns: this.errorPatterns,
      health: this.healthIndicators,
      userImpact: this.userImpactData,
      performance: this.performanceData,
      exportedAt: Date.now()
    }, null, 2);
  }

  clearAnalytics(): void {
    this.errorTrends = [];
    this.errorPatterns = [];
    this.performanceData = [];
    this.healthIndicators = [];
    this.userImpactData = {
      totalAffectedUsers: 0,
      averageErrorsPerUser: 0,
      userRetentionImpact: 0,
      satisfactionImpact: 0,
      criticalErrorUsers: 0,
      recoverySuccessByUser: {}
    };
  }

  updateConfig(config: Partial<ErrorAnalyticsConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart analysis interval if needed
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }

    if (this.config.enabled) {
      this.analysisInterval = setInterval(() => {
        this.performPeriodicAnalysis();
      }, this.config.aggregationInterval);
    }
  }

  destroy(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
  }
}

// Export singleton instance
export const errorAnalytics = ErrorAnalytics.getInstance();

// Export utility functions
export const trackError = (error: AppError, context?: any) => {
  errorAnalytics.trackError(error, context);
};

export const getErrorAnalytics = () => {
  return errorAnalytics.getAnalytics();
};

export const getHealthStatus = () => {
  return errorAnalytics.getHealthStatus();
};

export const getTopErrors = (limit?: number) => {
  return errorAnalytics.getTopErrors(limit);
};