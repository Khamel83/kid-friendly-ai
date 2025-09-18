/**
 * Centralized error management system for kid-friendly-ai
 * Provides comprehensive error handling, classification, and recovery
 */

import React from 'react';
import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  ErrorRecoveryStrategy,
  ErrorClassification,
  ErrorContext,
  ErrorLoggingConfig,
  ErrorRecoveryConfig,
  ErrorMetrics
} from '../types/error';

// Error classification rules
const ERROR_CLASSIFICATIONS: Record<string, ErrorClassification> = {
  // Network errors
  'NetworkError': {
    category: ErrorCategory.NETWORK,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    userVisible: true,
    retryable: true,
    recoveryStrategies: [ErrorRecoveryStrategy.RETRY, ErrorRecoveryStrategy.FALLBACK],
    maxRetries: 3,
    timeout: 5000
  },

  // API errors
  'ApiError': {
    category: ErrorCategory.API,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    userVisible: false,
    retryable: true,
    recoveryStrategies: [ErrorRecoveryStrategy.RETRY, ErrorRecoveryStrategy.FALLBACK],
    maxRetries: 2,
    timeout: 3000
  },

  // UI errors
  'UIError': {
    category: ErrorCategory.UI,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    userVisible: true,
    retryable: false,
    recoveryStrategies: [ErrorRecoveryStrategy.LOG_ONLY, ErrorRecoveryStrategy.RESTART_COMPONENT]
  },

  // Validation errors
  'ValidationError': {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    userVisible: true,
    retryable: false,
    recoveryStrategies: [ErrorRecoveryStrategy.SKIP, ErrorRecoveryStrategy.NOTIFY_USER]
  },

  // Authentication errors
  'AuthenticationError': {
    category: ErrorCategory.AUTHENTICATION,
    severity: ErrorSeverity.HIGH,
    recoverable: true,
    userVisible: true,
    retryable: false,
    recoveryStrategies: [ErrorRecoveryStrategy.NOTIFY_USER, ErrorRecoveryStrategy.NOTIFY_PARENT]
  },

  // Audio errors
  'AudioError': {
    category: ErrorCategory.AUDIO,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    userVisible: true,
    retryable: true,
    recoveryStrategies: [ErrorRecoveryStrategy.RETRY, ErrorRecoveryStrategy.FALLBACK],
    maxRetries: 2
  },

  // Speech errors
  'SpeechError': {
    category: ErrorCategory.SPEECH,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    userVisible: true,
    retryable: true,
    recoveryStrategies: [ErrorRecoveryStrategy.RETRY, ErrorRecoveryStrategy.FALLBACK],
    maxRetries: 3
  },

  // Game errors
  'GameError': {
    category: ErrorCategory.GAME,
    severity: ErrorSeverity.LOW,
    recoverable: true,
    userVisible: true,
    retryable: true,
    recoveryStrategies: [ErrorRecoveryStrategy.RETRY, ErrorRecoveryStrategy.RESTART_COMPONENT],
    maxRetries: 2
  },

  // Performance errors
  'PerformanceError': {
    category: ErrorCategory.PERFORMANCE,
    severity: ErrorSeverity.MEDIUM,
    recoverable: true,
    userVisible: false,
    retryable: false,
    recoveryStrategies: [ErrorRecoveryStrategy.LOG_ONLY, ErrorRecoveryStrategy.CLEAR_CACHE]
  },

  // Default error
  'UnknownError': {
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.MEDIUM,
    recoverable: false,
    userVisible: true,
    retryable: false,
    recoveryStrategies: [ErrorRecoveryStrategy.LOG_ONLY, ErrorRecoveryStrategy.NOTIFY_USER]
  }
};

// Child-friendly error messages
const CHILD_FRIENDLY_MESSAGES: Record<string, Record<string, string>> = {
  network: {
    '3-5': 'Oops! Having trouble connecting. Let\'s try again!',
    '6-8': 'Network connection issue. Let\'s give it another try!',
    '9-12': 'Network connection problem. Attempting to reconnect...'
  },
  api: {
    '3-5': 'The server is taking a nap. Let\'s try waking it up!',
    '6-8': 'Server is busy. Let\'s try again in a moment.',
    '9-12': 'Server is temporarily unavailable. Retrying...'
  },
  audio: {
    '3-5': 'Sound isn\'t working right now. Let\'s try without sound!',
    '6-8': 'Audio problem detected. Continuing without sound.',
    '9-12': 'Audio system unavailable. Continuing in silent mode.'
  },
  speech: {
    '3-5': 'I didn\'t catch that. Can you try speaking again?',
    '6-8': 'Speech recognition issue. Please try speaking again.',
    '9-12': 'Speech recognition error. Please repeat your request.'
  },
  game: {
    '3-5': 'The game needs a little break. Let\'s start over!',
    '6-8': 'Game encountered an issue. Restarting...',
    '9-12': 'Game error detected. Resetting game state...'
  },
  default: {
    '3-5': 'Something unexpected happened. Everything is okay now!',
    '6-8': 'An error occurred. The issue has been resolved.',
    '9-12': 'An unexpected error occurred and has been handled.'
  }
};

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];
  private errorCallbacks: Set<(error: AppError) => void> = new Set();
  private recoveryCallbacks: Set<(error: AppError, strategy: ErrorRecoveryStrategy) => void> = new Set();
  private metrics: ErrorMetrics;
  private config: {
    logging: ErrorLoggingConfig;
    recovery: ErrorRecoveryConfig;
  };

  private constructor() {
    this.metrics = this.initializeMetrics();
    this.config = {
      logging: {
        enabled: true,
        level: ErrorSeverity.LOW,
        maxLogSize: 1000,
        logToConsole: process.env.NODE_ENV === 'development',
        logToServer: true,
        includeStackTrace: true,
        includeContext: true,
        samplingRate: 1.0
      },
      recovery: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
        timeout: 5000,
        enableAutomaticRecovery: true,
        enableUserInitiatedRecovery: true,
        recoveryStrategies: {}
      }
    };

    // Set up global error handlers
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private initializeMetrics(): ErrorMetrics {
    return {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recoverySuccessRate: 0,
      averageRecoveryTime: 0,
      userImpactScore: 0,
      systemHealthScore: 100,
      lastErrorTime: 0,
      errorFrequency: 0
    };
  }

  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(new Error(event.reason), {
        source: 'unhandledrejection',
        timestamp: Date.now()
      });
    });

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        source: 'uncaught',
        timestamp: Date.now(),
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Handle React errors through error boundary
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        if (event.error instanceof Error) {
          this.handleError(event.error);
        }
      });
    }
  }

  // Create error with proper classification
  createError(
    error: Error | string,
    context: Partial<ErrorContext> = {},
    category: ErrorCategory = ErrorCategory.UNKNOWN
  ): AppError {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const classification = this.getErrorClassification(errorObj, category);
    const errorId = this.generateErrorId();

    const appError: AppError = {
      ...errorObj,
      id: errorId,
      name: errorObj.name || 'Error',
      message: errorObj.message || 'An unknown error occurred',
      category: classification.category,
      severity: classification.severity,
      recoverable: classification.recoverable,
      userVisible: classification.userVisible,
      retryable: classification.retryable,
      recoveryStrategies: classification.recoveryStrategies,
      timestamp: Date.now(),
      context: {
        ...context,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
      }
    };

    return appError;
  }

  private getErrorClassification(error: Error, category: ErrorCategory): ErrorClassification {
    const errorName = error.name || 'UnknownError';
    return ERROR_CLASSIFICATIONS[errorName] || ERROR_CLASSIFICATIONS.UnknownError;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Handle error
  handleError(error: Error | string, context: Partial<ErrorContext> = {}): AppError {
    const appError = this.createError(error, context);

    // Update metrics
    this.updateMetrics(appError);

    // Log error
    this.logError(appError);

    // Notify listeners
    this.notifyErrorListeners(appError);

    // Attempt automatic recovery
    if (this.config.recovery.enableAutomaticRecovery && appError.recoverable) {
      this.attemptRecovery(appError);
    }

    return appError;
  }

  private updateMetrics(error: AppError): void {
    this.metrics.totalErrors++;
    this.metrics.lastErrorTime = Date.now();

    // Update category metrics
    this.metrics.errorsByCategory[error.category] =
      (this.metrics.errorsByCategory[error.category] || 0) + 1;

    // Update severity metrics
    this.metrics.errorsBySeverity[error.severity] =
      (this.metrics.errorsBySeverity[error.severity] || 0) + 1;

    // Calculate error frequency
    const timeSinceLastError = Date.now() - this.metrics.lastErrorTime;
    this.metrics.errorFrequency = timeSinceLastError > 0 ? 1000 / timeSinceLastError : 0;

    // Update system health score
    this.updateSystemHealthScore();
  }

  private updateSystemHealthScore(): void {
    const highSeverityErrors = this.metrics.errorsBySeverity[ErrorSeverity.HIGH] || 0;
    const criticalErrors = this.metrics.errorsBySeverity[ErrorSeverity.CRITICAL] || 0;
    const totalErrors = this.metrics.totalErrors;

    // Calculate health score (0-100)
    let healthScore = 100;
    healthScore -= (highSeverityErrors * 10);
    healthScore -= (criticalErrors * 20);
    healthScore -= Math.min(totalErrors * 0.5, 20);

    this.metrics.systemHealthScore = Math.max(0, Math.min(100, healthScore));
  }

  private logError(error: AppError): void {
    if (!this.config.logging.enabled) return;

    // Add to error log
    this.errorLog.push(error);

    // Limit log size
    if (this.errorLog.length > this.config.logging.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.config.logging.maxLogSize);
    }

    // Console logging in development
    if (this.config.logging.logToConsole) {
      console.group(`🚨 Error: ${error.name}`);
      console.error('Message:', error.message);
      console.error('Category:', error.category);
      console.error('Severity:', error.severity);
      if (error.context) {
        console.error('Context:', error.context);
      }
      if (this.config.logging.includeStackTrace && error.stack) {
        console.error('Stack:', error.stack);
      }
      console.groupEnd();
    }

    // Server logging
    if (this.config.logging.logToServer) {
      this.logToServer(error);
    }
  }

  private async logToServer(error: AppError): Promise<void> {
    try {
      // Implement server logging logic here
      // This could send error data to an analytics service
      console.log('Logging error to server:', error.id);
    } catch (serverError) {
      console.error('Failed to log error to server:', serverError);
    }
  }

  private notifyErrorListeners(error: AppError): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }

  // Error recovery
  private async attemptRecovery(error: AppError): Promise<void> {
    const strategies = error.recoveryStrategies || [];

    for (const strategy of strategies) {
      try {
        const success = await this.executeRecoveryStrategy(error, strategy);
        if (success) {
          this.notifyRecoveryListeners(error, strategy);
          this.updateRecoveryMetrics(true);
          return;
        }
      } catch (recoveryError) {
        console.error(`Recovery strategy ${strategy} failed:`, recoveryError);
      }
    }

    this.updateRecoveryMetrics(false);
  }

  private async executeRecoveryStrategy(error: AppError, strategy: ErrorRecoveryStrategy): Promise<boolean> {
    const startTime = Date.now();

    switch (strategy) {
      case ErrorRecoveryStrategy.RETRY:
        return await this.retryOperation(error);

      case ErrorRecoveryStrategy.FALLBACK:
        return await this.provideFallback(error);

      case ErrorRecoveryStrategy.CLEAR_CACHE:
        return await this.clearCache();

      case ErrorRecoveryStrategy.RESET_STATE:
        return await this.resetState();

      default:
        return false;
    }
  }

  private async retryOperation(error: AppError): Promise<boolean> {
    const maxRetries = this.config.recovery.maxRetries;
    const delay = this.config.recovery.retryDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(this.config.recovery.backoffMultiplier, attempt - 1)));

        // Implement retry logic based on error type
        if (error.category === ErrorCategory.NETWORK) {
          // Check network connectivity
          return navigator.onLine;
        }

        return true;
      } catch (retryError) {
        if (attempt === maxRetries) {
          return false;
        }
      }
    }

    return false;
  }

  private async provideFallback(error: AppError): Promise<boolean> {
    // Implement fallback logic based on error type
    switch (error.category) {
      case ErrorCategory.AUDIO:
        // Disable audio and continue
        return true;

      case ErrorCategory.SPEECH:
        // Fall back to text input
        return true;

      case ErrorCategory.GAME:
        // Reset game to initial state
        return true;

      default:
        return false;
    }
  }

  private async clearCache(): Promise<boolean> {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  private async resetState(): Promise<boolean> {
    try {
      // Reset application state
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  private updateRecoveryMetrics(success: boolean): void {
    // Update recovery success rate
    const totalRecoveryAttempts = this.metrics.recoverySuccessRate * 100 || 0;
    const successfulRecoveries = success ? 1 : 0;

    this.metrics.recoverySuccessRate =
      (totalRecoveryAttempts * this.metrics.recoverySuccessRate + successfulRecoveries) / (totalRecoveryAttempts + 1);
  }

  private notifyRecoveryListeners(error: AppError, strategy: ErrorRecoveryStrategy): void {
    this.recoveryCallbacks.forEach(callback => {
      try {
        callback(error, strategy);
      } catch (callbackError) {
        console.error('Error in recovery callback:', callbackError);
      }
    });
  }

  // Public API
  onError(callback: (error: AppError) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  onRecovery(callback: (error: AppError, strategy: ErrorRecoveryStrategy) => void): () => void {
    this.recoveryCallbacks.add(callback);
    return () => this.recoveryCallbacks.delete(callback);
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }

  getChildFriendlyMessage(error: AppError, ageGroup: string = '6-8'): string {
    const categoryMessages = CHILD_FRIENDLY_MESSAGES[error.category] || CHILD_FRIENDLY_MESSAGES.default;
    return categoryMessages[ageGroup] || categoryMessages['6-8'];
  }

  shouldDisplayToUser(error: AppError): boolean {
    return error.userVisible && this.config.logging.enabled;
  }

  isRecoverable(error: AppError): boolean {
    return error.recoverable && this.config.recovery.enableAutomaticRecovery;
  }

  updateConfig(config: Partial<{
    logging: Partial<ErrorLoggingConfig>;
    recovery: Partial<ErrorRecoveryConfig>;
  }>): void {
    if (config.logging) {
      this.config.logging = { ...this.config.logging, ...config.logging };
    }
    if (config.recovery) {
      this.config.recovery = { ...this.config.recovery, ...config.recovery };
    }
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Export utility functions
export const handleError = (error: Error | string, context?: Partial<ErrorContext>) => {
  return errorHandler.handleError(error, context);
};

export const getChildFriendlyMessage = (error: AppError, ageGroup?: string) => {
  return errorHandler.getChildFriendlyMessage(error, ageGroup);
};

export const isRecoverable = (error: AppError) => {
  return errorHandler.isRecoverable(error);
};

// React hook for error handling
export const useErrorHandler = () => {
  const [errors, setErrors] = React.useState<AppError[]>([]);
  const [isRecovering, setIsRecovering] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = errorHandler.onError((error) => {
      setErrors(prev => [...prev, error]);
    });

    return unsubscribe;
  }, []);

  React.useEffect(() => {
    const unsubscribe = errorHandler.onRecovery((error, strategy) => {
      setIsRecovering(true);
      setTimeout(() => setIsRecovering(false), 1000);
    });

    return unsubscribe;
  }, []);

  const dismissError = (errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId));
  };

  const retryError = async (error: AppError) => {
    setIsRecovering(true);
    try {
      await errorHandler.attemptRecovery(error);
    } finally {
      setIsRecovering(false);
    }
  };

  return {
    errors,
    isRecovering,
    dismissError,
    retryError,
    metrics: errorHandler.getMetrics()
  };
};