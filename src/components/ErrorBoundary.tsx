/**
 * React Error Boundary component for kid-friendly-ai
 * Provides comprehensive error catching and recovery for React components
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  ErrorBoundaryConfig,
  ErrorContext
} from '../types/error';
import { errorHandler } from '../utils/errorHandler';
import { ErrorDisplay } from './ErrorDisplay';

interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  isRecovering: boolean;
  showDetails: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackComponent?: React.ComponentType<{
    error: AppError;
    retry: () => void;
    retryCount: number;
    isRecovering: boolean;
  }>;
  onError?: (error: AppError, errorInfo: ErrorInfo) => void;
  config?: ErrorBoundaryConfig;
  componentName?: string;
  enableRecovery?: boolean;
  maxRetries?: number;
  resetTimeout?: number;
  ageGroup?: '3-5' | '6-8' | '9-12';
  accessibilityMode?: boolean;
  parentalNotification?: boolean;
}

class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error: errorHandler.createError(error, {}, ErrorCategory.UI)
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, componentName } = this.props;
    const appError = errorHandler.createError(error, {
      component: componentName || 'Unknown',
      action: 'error_boundary',
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });

    this.setState({
      error: appError,
      errorInfo
    });

    // Call custom error handler if provided
    if (onError) {
      onError(appError, errorInfo);
    }

    // Log the error
    console.error('Error Boundary caught an error:', {
      error: appError,
      errorInfo,
      componentName
    });

    // Auto-recover if enabled
    if (this.props.enableRecovery && appError.recoverable) {
      this.attemptRecovery();
    }
  }

  private attemptRecovery = async (): Promise<void> => {
    const { error, retryCount } = this.state;
    const { maxRetries = 3, resetTimeout = 5000 } = this.props;

    if (!error || retryCount >= maxRetries) {
      return;
    }

    this.setState({ isRecovering: true });

    try {
      // Attempt recovery
      const success = await errorHandler.attemptRecovery(error);

      if (success) {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: 0,
          isRecovering: false
        });
      } else {
        this.setState({
          retryCount: retryCount + 1,
          isRecovering: false
        });
      }
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      this.setState({
        retryCount: retryCount + 1,
        isRecovering: false
      });
    }
  };

  private handleRetry = (): void => {
    this.attemptRecovery();
  };

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false
    });
  };

  private toggleDetails = (): void => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  private getAgeGroup(): '3-5' | '6-8' | '9-12' {
    return this.props.ageGroup || '6-8';
  }

  private shouldShowError(): boolean {
    const { error } = this.state;
    const { config } = this.props;

    if (!error) return false;

    // Check severity threshold
    if (config?.severityThreshold) {
      const severityLevels = {
        [ErrorSeverity.LOW]: 0,
        [ErrorSeverity.MEDIUM]: 1,
        [ErrorSeverity.HIGH]: 2,
        [ErrorSeverity.CRITICAL]: 3
      };

      const errorLevel = severityLevels[error.severity];
      const thresholdLevel = severityLevels[config.severityThreshold];

      return errorLevel >= thresholdLevel;
    }

    return true;
  }

  private getChildFriendlyMessage(): string {
    const { error } = this.state;
    if (!error) return '';

    const ageGroup = this.getAgeGroup();
    return errorHandler.getChildFriendlyMessage(error, ageGroup);
  }

  private canRetry(): boolean {
    const { error, retryCount } = this.state;
    const { maxRetries = 3 } = this.props;

    return error?.recoverable && retryCount < maxRetries;
  }

  private notifyParentIfNeeded(): void {
    const { error } = this.state;
    const { parentalNotification } = this.props;

    if (error && parentalNotification && error.severity === ErrorSeverity.CRITICAL) {
      // Dispatch parental notification event
      const event = new CustomEvent('parental-notification', {
        detail: {
          type: 'error',
          message: `Critical error in ${this.props.componentName || 'component'}`,
          error: error.message,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(event);
    }
  }

  componentDidMount(): void {
    // Listen for recovery events
    window.addEventListener('error-recovery-complete', this.handleRecoveryComplete);
  }

  componentWillUnmount(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    window.removeEventListener('error-recovery-complete', this.handleRecoveryComplete);
  }

  private handleRecoveryComplete = (event: CustomEvent): void => {
    if (event.detail.success) {
      this.handleReset();
    }
  };

  componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState): void {
    // Notify parent if critical error occurs
    if (!prevState.error && this.state.error) {
      this.notifyParentIfNeeded();
    }

    // Auto-reset after timeout if configured
    if (this.props.resetTimeout && !prevState.hasError && this.state.hasError) {
      this.resetTimer = setTimeout(() => {
        this.handleReset();
      }, this.props.resetTimeout);
    }
  }

  render(): ReactNode {
    const { hasError, error, errorInfo, retryCount, isRecovering, showDetails } = this.state;
    const { children, fallbackComponent, accessibilityMode = false } = this.props;

    if (hasError && error && this.shouldShowError()) {
      // Use custom fallback component if provided
      if (fallbackComponent) {
        const FallbackComponent = fallbackComponent;
        return (
          <FallbackComponent
            error={error}
            retry={this.handleRetry}
            retryCount={retryCount}
            isRecovering={isRecovering}
          />
        );
      }

      // Use built-in error display
      return (
        <ErrorDisplay
          error={error}
          message={this.getChildFriendlyMessage()}
          onRetry={this.canRetry() ? this.handleRetry : undefined}
          onReset={this.handleReset}
          isRecovering={isRecovering}
          retryCount={retryCount}
          maxRetries={this.props.maxRetries || 3}
          showDetails={showDetails}
          onToggleDetails={this.toggleDetails}
          errorInfo={errorInfo}
          accessibilityMode={accessibilityMode}
          ageGroup={this.getAgeGroup()}
          componentName={this.props.componentName}
        />
      );
    }

    return children;
  }
}

// Functional wrapper for convenience
export const ErrorBoundary: React.FC<ErrorBoundaryProps> = (props) => {
  return <ErrorBoundaryClass {...props} />;
};

// Higher-order component for error boundaries
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `WithErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Hook-based error boundary for functional components
export function useErrorBoundary(): {
  error: AppError | null;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
  captureError: (error: Error, errorInfo?: ErrorInfo) => void;
} {
  const [state, setState] = React.useState<{
    error: AppError | null;
    errorInfo: ErrorInfo | null;
  }>({
    error: null,
    errorInfo: null
  });

  const resetError = React.useCallback(() => {
    setState({ error: null, errorInfo: null });
  }, []);

  const captureError = React.useCallback((error: Error, errorInfo?: ErrorInfo) => {
    const appError = errorHandler.createError(error, {
      component: 'useErrorBoundary',
      action: 'hook_error_boundary',
      additionalData: {
        componentStack: errorInfo?.componentStack,
        hookErrorBoundary: true
      }
    });

    setState({ error: appError, errorInfo });
  }, []);

  return {
    error: state.error,
    errorInfo: state.errorInfo,
    resetError,
    captureError
  };
}

// Pre-built fallback components
export const SimpleErrorFallback: React.FC<{
  error: AppError;
  retry: () => void;
  retryCount: number;
  isRecovering: boolean;
}> = ({ error, retry, retryCount, isRecovering }) => (
  <div className="simple-error-fallback" role="alert">
    <h3>Oops! Something went wrong</h3>
    <p>{error.message}</p>
    {error.recoverable && retryCount < 3 && (
      <button onClick={retry} disabled={isRecovering}>
        {isRecovering ? 'Trying to fix...' : 'Try Again'}
      </button>
    )}
  </div>
);

export const GameErrorFallback: React.FC<{
  error: AppError;
  retry: () => void;
  retryCount: number;
  isRecovering: boolean;
}> = ({ error, retry, retryCount, isRecovering }) => (
  <div className="game-error-fallback" role="alert">
    <div className="game-error-icon">🎮</div>
    <h3>Game Needs a Break</h3>
    <p>Let's give the game a fresh start!</p>
    {error.recoverable && retryCount < 3 && (
      <button
        onClick={retry}
        disabled={isRecovering}
        className="game-retry-button"
      >
        {isRecovering ? '🔄 Restarting...' : '🎮 Play Again'}
      </button>
    )}
  </div>
);

export const AudioErrorFallback: React.FC<{
  error: AppError;
  retry: () => void;
  retryCount: number;
  isRecovering: boolean;
}> = ({ error, retry, retryCount, isRecovering }) => (
  <div className="audio-error-fallback" role="alert">
    <div className="audio-error-icon">🔇</div>
    <h3>Sound is Taking a Nap</h3>
    <p>We can keep playing without sound!</p>
    {error.recoverable && retryCount < 3 && (
      <button
        onClick={retry}
        disabled={isRecovering}
        className="audio-retry-button"
      >
        {isRecovering ? '🔄 Trying...' : '🔊 Try Sound Again'}
      </button>
    )}
  </div>
);

// Error boundary context provider
interface ErrorBoundaryContextType {
  captureError: (error: Error, errorInfo?: ErrorInfo) => void;
  resetError: () => void;
  hasError: boolean;
  error: AppError | null;
}

const ErrorBoundaryContext = React.createContext<ErrorBoundaryContextType>({
  captureError: () => {},
  resetError: () => {},
  hasError: false,
  error: null
});

export const useErrorBoundaryContext = () => React.useContext(ErrorBoundaryContext);

export const ErrorBoundaryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<{
    error: AppError | null;
    hasError: boolean;
  }>({
    error: null,
    hasError: false
  });

  const captureError = React.useCallback((error: Error, errorInfo?: ErrorInfo) => {
    const appError = errorHandler.createError(error, {
      component: 'ErrorBoundaryProvider',
      action: 'context_error_boundary',
      additionalData: {
        componentStack: errorInfo?.componentStack,
        contextErrorBoundary: true
      }
    });

    setState({ error: appError, hasError: true });
  }, []);

  const resetError = React.useCallback(() => {
    setState({ error: null, hasError: false });
  }, []);

  const contextValue = React.useMemo(() => ({
    captureError,
    resetError,
    hasError: state.hasError,
    error: state.error
  }), [captureError, resetError, state.hasError, state.error]);

  return (
    <ErrorBoundaryContext.Provider value={contextValue}>
      {children}
    </ErrorBoundaryContext.Provider>
  );
};