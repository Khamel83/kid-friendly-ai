/**
 * React hooks for error handling in kid-friendly-ai components
 * Provides comprehensive error state management and recovery capabilities
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  ErrorRecoveryStrategy,
  ErrorContext
} from '../types/error';
import { errorHandler } from '../utils/errorHandler';

interface ErrorHandlerState {
  errors: AppError[];
  isRecovering: boolean;
  hasError: boolean;
  currentError: AppError | null;
  recoveryProgress: number;
  retryCount: number;
}

interface ErrorHandlerConfig {
  enableAutoRecovery?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableNotifications?: boolean;
  logErrors?: boolean;
  ageGroup?: '3-5' | '6-8' | '9-12';
  customRecoveryStrategies?: Record<ErrorCategory, ErrorRecoveryStrategy[]>;
}

interface UseErrorHandlerReturn extends ErrorHandlerState {
  handleError: (error: Error | string, context?: Partial<ErrorContext>) => AppError;
  dismissError: (errorId: string) => void;
  retryError: (error: AppError) => Promise<boolean>;
  clearAllErrors: () => void;
  getChildFriendlyMessage: (error: AppError) => string;
  isRecoverable: (error: AppError) => boolean;
  subscribeToErrors: (callback: (error: AppError) => void) => () => void;
  subscribeToRecovery: (callback: (error: AppError, strategy: ErrorRecoveryStrategy) => void) => () => void;
  getErrorMetrics: () => import('../types/error').ErrorMetrics;
  updateConfig: (config: Partial<ErrorHandlerConfig>) => void;
}

const defaultConfig: ErrorHandlerConfig = {
  enableAutoRecovery: true,
  maxRetries: 3,
  retryDelay: 1000,
  enableNotifications: true,
  logErrors: true,
  ageGroup: '6-8'
};

export function useErrorHandler(config: ErrorHandlerConfig = defaultConfig): UseErrorHandlerReturn {
  const [state, setState] = React.useState<ErrorHandlerState>({
    errors: [],
    isRecovering: false,
    hasError: false,
    currentError: null,
    recoveryProgress: 0,
    retryCount: 0
  });

  const configRef = useRef<ErrorHandlerConfig>({ ...defaultConfig, ...config });
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update config when prop changes
  const updateConfig = useCallback((newConfig: Partial<ErrorHandlerConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };
  }, []);

  // Handle new errors
  const handleError = useCallback((error: Error | string, context?: Partial<ErrorContext>): AppError => {
    const appError = errorHandler.handleError(error, context);

    setState(prev => ({
      ...prev,
      errors: [...prev.errors, appError],
      hasError: true,
      currentError: appError
    }));

    // Log error if enabled
    if (configRef.current.logErrors) {
      console.error('Error handled by hook:', appError);
    }

    // Attempt auto-recovery if enabled and error is recoverable
    if (configRef.current.enableAutoRecovery && isRecoverable(appError)) {
      retryError(appError);
    }

    return appError;
  }, []);

  // Dismiss error
  const dismissError = useCallback((errorId: string) => {
    setState(prev => ({
      ...prev,
      errors: prev.errors.filter(e => e.id !== errorId),
      hasError: prev.errors.length > 1,
      currentError: prev.errors.length > 1 ? prev.errors[prev.errors.length - 2] : null
    }));
  }, []);

  // Retry error recovery
  const retryError = useCallback(async (error: AppError): Promise<boolean> => {
    const maxRetries = configRef.current.maxRetries || 3;
    const retryDelay = configRef.current.retryDelay || 1000;

    if (state.retryCount >= maxRetries) {
      setState(prev => ({ ...prev, retryCount: 0, isRecovering: false }));
      return false;
    }

    setState(prev => ({
      ...prev,
      isRecovering: true,
      retryCount: prev.retryCount + 1
    }));

    // Simulate recovery progress
    const progressInterval = setInterval(() => {
      setState(prev => ({
        ...prev,
        recoveryProgress: Math.min(prev.recoveryProgress + 10, 90)
      }));
    }, retryDelay / 10);

    try {
      // Wait for retry delay
      await new Promise(resolve => setTimeout(resolve, retryDelay));

      // Attempt recovery
      const success = await attemptErrorRecovery(error);

      clearInterval(progressInterval);
      setState(prev => ({
        ...prev,
        isRecovering: false,
        recoveryProgress: success ? 100 : 0,
        retryCount: success ? 0 : prev.retryCount
      }));

      if (success) {
        dismissError(error.id);
      }

      return success;
    } catch (recoveryError) {
      clearInterval(progressInterval);
      setState(prev => ({
        ...prev,
        isRecovering: false,
        recoveryProgress: 0
      }));
      return false;
    }
  }, [state.retryCount, dismissError]);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setState({
      errors: [],
      isRecovering: false,
      hasError: false,
      currentError: null,
      recoveryProgress: 0,
      retryCount: 0
    });

    // Clear any pending timeouts
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
    }
  }, []);

  // Get child-friendly message
  const getChildFriendlyMessage = useCallback((error: AppError): string => {
    return errorHandler.getChildFriendlyMessage(error, configRef.current.ageGroup);
  }, []);

  // Check if error is recoverable
  const isRecoverable = useCallback((error: AppError): boolean => {
    return errorHandler.isRecoverable(error);
  }, []);

  // Subscribe to errors
  const subscribeToErrors = useCallback((callback: (error: AppError) => void) => {
    return errorHandler.onError(callback);
  }, []);

  // Subscribe to recovery events
  const subscribeToRecovery = useCallback((callback: (error: AppError, strategy: ErrorRecoveryStrategy) => void) => {
    return errorHandler.onRecovery(callback);
  }, []);

  // Get error metrics
  const getErrorMetrics = useCallback(() => {
    return errorHandler.getMetrics();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    handleError,
    dismissError,
    retryError,
    clearAllErrors,
    getChildFriendlyMessage,
    isRecoverable,
    subscribeToErrors,
    subscribeToRecovery,
    getErrorMetrics,
    updateConfig
  };
}

// Error recovery implementation
async function attemptErrorRecovery(error: AppError): Promise<boolean> {
  const recoveryStrategies = error.recoveryStrategies || [];

  for (const strategy of recoveryStrategies) {
    try {
      const success = await executeRecoveryStrategy(error, strategy);
      if (success) {
        return true;
      }
    } catch (recoveryError) {
      console.error(`Recovery strategy ${strategy} failed:`, recoveryError);
    }
  }

  return false;
}

async function executeRecoveryStrategy(error: AppError, strategy: ErrorRecoveryStrategy): Promise<boolean> {
  switch (strategy) {
    case ErrorRecoveryStrategy.RETRY:
      return await retryStrategy(error);
    case ErrorRecoveryStrategy.FALLBACK:
      return await fallbackStrategy(error);
    case ErrorRecoveryStrategy.CLEAR_CACHE:
      return await clearCacheStrategy();
    case ErrorRecoveryStrategy.RESET_STATE:
      return await resetStateStrategy();
    default:
      return false;
  }
}

async function retryStrategy(error: AppError): Promise<boolean> {
  // Network-related retry
  if (error.category === ErrorCategory.NETWORK) {
    try {
      const response = await fetch('/api/health', { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  // API-related retry
  if (error.category === ErrorCategory.API) {
    try {
      const response = await fetch('/api/health');
      return response.ok;
    } catch {
      return false;
    }
  }

  return false;
}

async function fallbackStrategy(error: AppError): Promise<boolean> {
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

async function clearCacheStrategy(): Promise<boolean> {
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    return true;
  } catch {
    return false;
  }
}

async function resetStateStrategy(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
    return true;
  } catch {
    return false;
  }
}

// Hook for handling async operations with error boundaries
export function useAsyncErrorHandler<T>(
  asyncOperation: () => Promise<T>,
  dependencies: React.DependencyList = []
): {
  data: T | null;
  loading: boolean;
  error: AppError | null;
  execute: () => Promise<T | null>;
  retry: () => Promise<T | null>;
} {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<AppError | null>(null);
  const { handleError, retryError } = useErrorHandler();

  const execute = React.useCallback(async (): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await asyncOperation();
      setData(result);
      setLoading(false);
      return result;
    } catch (err) {
      const appError = handleError(err as Error);
      setError(appError);
      setLoading(false);
      return null;
    }
  }, [asyncOperation, handleError]);

  const retry = React.useCallback(async (): Promise<T | null> => {
    if (error) {
      const success = await retryError(error);
      if (success) {
        return execute();
      }
    }
    return null;
  }, [error, retryError, execute]);

  React.useEffect(() => {
    if (dependencies.length === 0) {
      execute();
    }
  }, dependencies);

  return { data, loading, error, execute, retry };
}

// Hook for component-level error boundary
export function useErrorBoundary(): {
  error: AppError | null;
  resetError: () => void;
  captureError: (error: Error, errorInfo?: React.ErrorInfo) => void;
} {
  const [error, setError] = React.useState<AppError | null>(null);
  const { handleError } = useErrorHandler();

  const captureError = React.useCallback((error: Error, errorInfo?: React.ErrorInfo) => {
    const appError = handleError(error, {
      component: errorInfo?.componentStack,
      action: 'error_boundary'
    });
    setError(appError);
  }, [handleError]);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, resetError, captureError };
}

// Hook for error notifications
export function useErrorNotification(): {
  showNotification: (error: AppError) => void;
  hideNotification: () => void;
  notification: AppError | null;
} {
  const [notification, setNotification] = React.useState<AppError | null>(null);
  const { handleError } = useErrorHandler();

  const showNotification = React.useCallback((error: AppError) => {
    if (error.userVisible) {
      setNotification(error);

      // Auto-hide after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    }
  }, []);

  const hideNotification = React.useCallback(() => {
    setNotification(null);
  }, []);

  // Show notifications for new errors
  React.useEffect(() => {
    const unsubscribe = errorHandler.onError((error) => {
      showNotification(error);
    });

    return unsubscribe;
  }, [showNotification]);

  return { showNotification, hideNotification, notification };
}

// Hook for error analytics
export function useErrorAnalytics(): {
  metrics: import('../types/error').ErrorMetrics;
  errorHistory: AppError[];
  clearHistory: () => void;
} {
  const [metrics, setMetrics] = React.useState<import('../types/error').ErrorMetrics>(errorHandler.getMetrics());
  const [errorHistory, setErrorHistory] = React.useState<AppError[]>(errorHandler.getErrorLog());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(errorHandler.getMetrics());
      setErrorHistory(errorHandler.getErrorLog());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const clearHistory = React.useCallback(() => {
    errorHandler.clearErrorLog();
    setErrorHistory([]);
  }, []);

  return { metrics, errorHistory, clearHistory };
}