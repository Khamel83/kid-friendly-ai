/**
 * Comprehensive error logging system for kid-friendly-ai
 * Provides structured logging, aggregation, and analysis capabilities
 */

import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  ErrorContext,
  ErrorEvent,
  ErrorReport,
  ErrorStatistics,
  ErrorLoggingConfig
} from '../types/error';

interface LogEntry {
  id: string;
  timestamp: number;
  error: AppError;
  context: ErrorContext;
  sessionId: string;
  userId?: string;
  stackTrace?: string;
  userAgent: string;
  url: string;
  recoveryAttempt?: {
    strategy: string;
    success: boolean;
    duration: number;
  };
  userAction?: {
    type: string;
    timestamp: number;
    target: string;
  };
}

interface AggregatedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  affectedUsers: Set<string>;
  averageRecoveryTime: number;
  recoverySuccessRate: number;
}

interface ErrorPattern {
  id: string;
  pattern: string;
  frequency: number;
  severity: ErrorSeverity;
  impactScore: number;
  commonContext: Record<string, any>;
  suggestedAction: string;
}

export class ErrorLogger {
  private static instance: ErrorLogger;
  private logEntries: LogEntry[] = [];
  private aggregatedErrors: Map<string, AggregatedError> = new Map();
  private errorPatterns: ErrorPattern[] = [];
  private config: ErrorLoggingConfig;
  private sessionStartTime: number;
  private sessionId: string;
  private userInteractions: Array<{
    type: string;
    target: string;
    timestamp: number;
  }> = [];

  private constructor(config: Partial<ErrorLoggingConfig> = {}) {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.config = {
      enabled: true,
      level: ErrorSeverity.LOW,
      maxLogSize: 1000,
      logToConsole: process.env.NODE_ENV === 'development',
      logToServer: true,
      includeStackTrace: true,
      includeContext: true,
      samplingRate: 1.0,
      ...config
    };

    // Initialize logging system
    this.initializeLogger();
  }

  static getInstance(config?: Partial<ErrorLoggingConfig>): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger(config);
    }
    return ErrorLogger.instance;
  }

  private initializeLogger(): void {
    // Track user interactions for context
    if (typeof window !== 'undefined') {
      window.addEventListener('click', this.handleUserInteraction.bind(this));
      window.addEventListener('keydown', this.handleUserInteraction.bind(this));
      window.addEventListener('submit', this.handleUserInteraction.bind(this));
    }

    // Set up periodic log cleanup
    setInterval(() => this.cleanupOldLogs(), 60000); // Clean up every minute
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleUserInteraction(event: Event): void {
    const interaction = {
      type: event.type,
      target: (event.target as HTMLElement).tagName.toLowerCase(),
      timestamp: Date.now()
    };

    this.userInteractions.push(interaction);

    // Keep only last 100 interactions
    if (this.userInteractions.length > 100) {
      this.userInteractions = this.userInteractions.slice(-100);
    }
  }

  // Main logging method
  logError(error: AppError, context: Partial<ErrorContext> = {}): void {
    if (!this.config.enabled) return;

    // Apply sampling rate
    if (Math.random() > this.config.samplingRate) return;

    // Check severity threshold
    if (this.shouldLogError(error)) {
      const logEntry = this.createLogEntry(error, context);

      // Add to log entries
      this.logEntries.push(logEntry);

      // Limit log size
      if (this.logEntries.length > this.config.maxLogSize) {
        this.logEntries = this.logEntries.slice(-this.config.maxLogSize);
      }

      // Aggregate error data
      this.aggregateError(logEntry);

      // Console logging
      if (this.config.logToConsole) {
        this.logToConsole(logEntry);
      }

      // Server logging
      if (this.config.logToServer) {
        this.logToServer(logEntry);
      }

      // Analyze for patterns
      this.analyzeErrorPattern(logEntry);
    }
  }

  private shouldLogError(error: AppError): boolean {
    const severityLevels = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 1,
      [ErrorSeverity.HIGH]: 2,
      [ErrorSeverity.CRITICAL]: 3
    };

    const configLevel = severityLevels[this.config.level] || 0;
    const errorLevel = severityLevels[error.severity] || 0;

    return errorLevel >= configLevel;
  }

  private createLogEntry(error: AppError, context: Partial<ErrorContext>): LogEntry {
    return {
      id: this.generateLogId(),
      timestamp: Date.now(),
      error,
      context: {
        ...context,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        additionalData: {
          ...context.additionalData,
          sessionId: this.sessionId,
          sessionDuration: Date.now() - this.sessionStartTime,
          recentInteractions: this.getRecentInteractions()
        }
      },
      sessionId: this.sessionId,
      userId: context.userId,
      stackTrace: this.config.includeStackTrace ? error.stack : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      url: typeof window !== 'undefined' ? window.location.href : ''
    };
  }

  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRecentInteractions(): Array<{
    type: string;
    target: string;
    timestamp: number;
    timeSinceError: number;
  }> {
    const fiveSecondsAgo = Date.now() - 5000;
    return this.userInteractions
      .filter(interaction => interaction.timestamp >= fiveSecondsAgo)
      .map(interaction => ({
        ...interaction,
        timeSinceError: Date.now() - interaction.timestamp
      }));
  }

  private aggregateError(logEntry: LogEntry): void {
    const key = this.getAggregateKey(logEntry.error);

    if (!this.aggregatedErrors.has(key)) {
      this.aggregatedErrors.set(key, {
        category: logEntry.error.category,
        severity: logEntry.error.severity,
        message: logEntry.error.message,
        count: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        affectedUsers: new Set(),
        averageRecoveryTime: 0,
        recoverySuccessRate: 0
      });
    }

    const aggregated = this.aggregatedErrors.get(key)!;
    aggregated.count++;
    aggregated.lastSeen = Date.now();

    if (logEntry.userId) {
      aggregated.affectedUsers.add(logEntry.userId);
    }
  }

  private getAggregateKey(error: AppError): string {
    return `${error.category}:${error.name}:${error.message.split(':')[0]}`;
  }

  private logToConsole(logEntry: LogEntry): void {
    const { error, context } = logEntry;

    console.group(`🚨 Error [${error.category}] ${error.severity.toUpperCase()}`);
    console.error('Message:', error.message);
    console.error('Time:', new Date(logEntry.timestamp).toISOString());
    console.error('Session:', logEntry.sessionId);

    if (this.config.includeContext && context) {
      console.error('Context:', context);
    }

    if (this.config.includeStackTrace && logEntry.stackTrace) {
      console.error('Stack:', logEntry.stackTrace);
    }

    console.error('User interactions before error:', this.getRecentInteractions());
    console.groupEnd();
  }

  private async logToServer(logEntry: LogEntry): Promise<void> {
    try {
      // In a real implementation, this would send to your error tracking service
      const report = this.createErrorReport(logEntry);

      // Simulate server logging
      console.log('Error logged to server:', report.id);

      // You could integrate with services like Sentry, LogRocket, etc.
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(report)
      // });
    } catch (serverError) {
      console.error('Failed to log error to server:', serverError);
    }
  }

  private createErrorReport(logEntry: LogEntry): ErrorReport {
    return {
      id: logEntry.id,
      timestamp: logEntry.timestamp,
      error: logEntry.error,
      context: logEntry.context,
      stackTrace: logEntry.stackTrace,
      userSession: {
        id: logEntry.sessionId,
        duration: Date.now() - this.sessionStartTime,
        interactions: this.userInteractions.length
      },
      systemInfo: {
        userAgent: logEntry.userAgent,
        url: logEntry.url,
        memory: typeof performance !== 'undefined' ? performance.memory : undefined,
        connectivity: typeof navigator !== 'undefined' ? navigator.onLine ? 'online' : 'offline' : 'unknown'
      },
      recovery: {
        attempted: logEntry.recoveryAttempt !== undefined,
        strategy: logEntry.recoveryAttempt?.strategy as any,
        successful: logEntry.recoveryAttempt?.success || false,
        duration: logEntry.recoveryAttempt?.duration || 0
      }
    };
  }

  private analyzeErrorPattern(logEntry: LogEntry): void {
    // Simple pattern detection - can be enhanced with ML models
    const recentErrors = this.logEntries
      .filter(entry => Date.now() - entry.timestamp < 300000) // Last 5 minutes
      .slice(-10); // Last 10 errors

    if (recentErrors.length >= 5) {
      const sameCategoryErrors = recentErrors.filter(
        entry => entry.error.category === logEntry.error.category
      );

      if (sameCategoryErrors.length >= 3) {
        this.detectPattern(sameCategoryErrors);
      }
    }
  }

  private detectPattern(errors: LogEntry[]): void {
    const pattern: ErrorPattern = {
      id: this.generatePatternId(),
      pattern: this.generatePatternDescription(errors),
      frequency: errors.length,
      severity: this.getMaxSeverity(errors),
      impactScore: this.calculateImpactScore(errors),
      commonContext: this.extractCommonContext(errors),
      suggestedAction: this.generateSuggestedAction(errors)
    };

    this.errorPatterns.push(pattern);

    // Keep only recent patterns
    if (this.errorPatterns.length > 50) {
      this.errorPatterns = this.errorPatterns.slice(-50);
    }
  }

  private generatePatternId(): string {
    return `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePatternDescription(errors: LogEntry[]): string {
    const categories = [...new Set(errors.map(e => e.error.category))];
    const messages = [...new Set(errors.map(e => e.error.message.split(':')[0]))];

    return `Pattern: ${categories.join(', ')} errors - ${messages.join(', ')}`;
  }

  private getMaxSeverity(errors: LogEntry[]): ErrorSeverity {
    const severityOrder = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 1,
      [ErrorSeverity.HIGH]: 2,
      [ErrorSeverity.CRITICAL]: 3
    };

    let maxSeverity = ErrorSeverity.LOW;
    let maxScore = 0;

    errors.forEach(error => {
      const score = severityOrder[error.error.severity];
      if (score > maxScore) {
        maxScore = score;
        maxSeverity = error.error.severity;
      }
    });

    return maxSeverity;
  }

  private calculateImpactScore(errors: LogEntry[]): number {
    const severityScores = {
      [ErrorSeverity.LOW]: 1,
      [ErrorSeverity.MEDIUM]: 3,
      [ErrorSeverity.HIGH]: 7,
      [ErrorSeverity.CRITICAL]: 10
    };

    const frequencyScore = Math.min(errors.length / 5, 3); // Max 3 points for frequency
    const severityScore = errors.reduce((sum, error) =>
      sum + severityScores[error.error.severity], 0) / errors.length;

    return Math.min(frequencyScore + severityScore, 10);
  }

  private extractCommonContext(errors: LogEntry[]): Record<string, any> {
    const commonContext: Record<string, any> = {};

    // Find common URLs
    const urls = errors.map(e => e.url);
    const commonUrl = this.findMostCommon(urls);
    if (commonUrl) {
      commonContext.commonUrl = commonUrl;
    }

    // Find common user agents
    const userAgents = errors.map(e => e.userAgent);
    const commonUserAgent = this.findMostCommon(userAgents);
    if (commonUserAgent) {
      commonContext.commonUserAgent = commonUserAgent;
    }

    return commonContext;
  }

  private findMostCommon(items: string[]): string | null {
    const frequency: Record<string, number> = {};

    items.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });

    let mostCommon = null;
    let maxCount = 0;

    Object.entries(frequency).forEach(([item, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    });

    return mostCommon;
  }

  private generateSuggestedAction(errors: LogEntry[]): string {
    const category = errors[0].error.category;

    switch (category) {
      case ErrorCategory.NETWORK:
        return 'Check network connectivity and retry';
      case ErrorCategory.API:
        return 'Verify API endpoints and authentication';
      case ErrorCategory.UI:
        return 'Review component state and props';
      case ErrorCategory.AUDIO:
        return 'Check audio permissions and device compatibility';
      case ErrorCategory.SPEECH:
        return 'Verify speech recognition setup and permissions';
      default:
        return 'Investigate error patterns and implement targeted fixes';
    }
  }

  private cleanupOldLogs(): void {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Remove old log entries
    this.logEntries = this.logEntries.filter(entry => entry.timestamp > oneWeekAgo);

    // Clean up aggregated errors
    for (const [key, aggregated] of this.aggregatedErrors.entries()) {
      if (aggregated.lastSeen < oneWeekAgo) {
        this.aggregatedErrors.delete(key);
      }
    }

    // Clean up old patterns
    this.errorPatterns = this.errorPatterns.filter(pattern => {
      const patternTime = parseInt(pattern.id.split('_')[1]);
      return patternTime > oneWeekAgo;
    });
  }

  // Public API methods
  getErrorStatistics(): ErrorStatistics {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    const recentErrors = this.logEntries.filter(entry => entry.timestamp > oneHourAgo);
    const dailyErrors = this.logEntries.filter(entry => entry.timestamp > oneDayAgo);

    const topErrors = Array.from(this.aggregatedErrors.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(aggregated => ({
        error: {
          name: 'AggregatedError',
          message: aggregated.message,
          category: aggregated.category,
          severity: aggregated.severity
        } as AppError,
        count: aggregated.count,
        percentage: (aggregated.count / this.logEntries.length) * 100
      }));

    const recoveryStats = {
      totalAttempts: this.logEntries.filter(e => e.recoveryAttempt).length,
      successfulRecoveries: this.logEntries.filter(e => e.recoveryAttempt?.success).length,
      averageRecoveryTime: this.calculateAverageRecoveryTime(),
      successRate: this.calculateRecoverySuccessRate()
    };

    return {
      period: {
        start: oneHourAgo,
        end: now
      },
      totalErrors: recentErrors.length,
      uniqueErrors: new Set(recentErrors.map(e => e.error.id)).size,
      errorRate: recentErrors.length / (3600 / 1000), // Errors per second
      topErrors,
      categoryDistribution: this.getCategoryDistribution(recentErrors),
      severityDistribution: this.getSeverityDistribution(recentErrors),
      recoveryStats,
      userImpact: {
        affectedUsers: new Set(this.logEntries.map(e => e.userId).filter(Boolean)).size,
        averageErrorsPerUser: this.calculateAverageErrorsPerUser(),
        userSatisfactionImpact: this.calculateUserSatisfactionImpact()
      }
    };
  }

  private calculateAverageRecoveryTime(): number {
    const recoveryEntries = this.logEntries.filter(e => e.recoveryAttempt);
    if (recoveryEntries.length === 0) return 0;

    const totalTime = recoveryEntries.reduce((sum, entry) =>
      sum + (entry.recoveryAttempt?.duration || 0), 0);

    return totalTime / recoveryEntries.length;
  }

  private calculateRecoverySuccessRate(): number {
    const recoveryEntries = this.logEntries.filter(e => e.recoveryAttempt);
    if (recoveryEntries.length === 0) return 0;

    const successfulRecoveries = recoveryEntries.filter(e => e.recoveryAttempt?.success).length;
    return successfulRecoveries / recoveryEntries.length;
  }

  private getCategoryDistribution(errors: LogEntry[]): Record<ErrorCategory, number> {
    const distribution: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;

    errors.forEach(error => {
      distribution[error.error.category] = (distribution[error.error.category] || 0) + 1;
    });

    return distribution;
  }

  private getSeverityDistribution(errors: LogEntry[]): Record<ErrorSeverity, number> {
    const distribution: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;

    errors.forEach(error => {
      distribution[error.error.severity] = (distribution[error.error.severity] || 0) + 1;
    });

    return distribution;
  }

  private calculateAverageErrorsPerUser(): number {
    const userIds = new Set(this.logEntries.map(e => e.userId).filter(Boolean));
    if (userIds.size === 0) return 0;

    return this.logEntries.length / userIds.size;
  }

  private calculateUserSatisfactionImpact(): number {
    const criticalErrors = this.logEntries.filter(e => e.error.severity === ErrorSeverity.CRITICAL).length;
    const totalErrors = this.logEntries.length;

    if (totalErrors === 0) return 100;

    // Simple calculation: higher impact with more critical errors
    const impactScore = (criticalErrors / totalErrors) * 100;
    return Math.max(0, 100 - impactScore);
  }

  getErrorPatterns(): ErrorPattern[] {
    return [...this.errorPatterns];
  }

  getLogEntries(limit?: number): LogEntry[] {
    const entries = [...this.logEntries];
    return limit ? entries.slice(-limit) : entries;
  }

  getAggregatedErrors(): AggregatedError[] {
    return Array.from(this.aggregatedErrors.values());
  }

  clearLogs(): void {
    this.logEntries = [];
    this.aggregatedErrors.clear();
    this.errorPatterns = [];
    this.userInteractions = [];
  }

  updateConfig(config: Partial<ErrorLoggingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  exportLogs(): string {
    return JSON.stringify({
      logs: this.logEntries,
      aggregated: this.getAggregatedErrors(),
      patterns: this.errorPatterns,
      statistics: this.getErrorStatistics(),
      exportedAt: Date.now()
    }, null, 2);
  }

  importLogs(data: string): void {
    try {
      const parsed = JSON.parse(data);

      if (parsed.logs) {
        this.logEntries = parsed.logs;
      }

      if (parsed.aggregated) {
        this.aggregatedErrors = new Map(
          parsed.aggregated.map((agg: any) => [this.getAggregateKey(agg.error), agg])
        );
      }

      if (parsed.patterns) {
        this.errorPatterns = parsed.patterns;
      }
    } catch (error) {
      console.error('Failed to import logs:', error);
    }
  }
}

// Export singleton instance
export const errorLogger = ErrorLogger.getInstance();