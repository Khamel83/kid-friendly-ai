/**
 * User-friendly error display component for kid-friendly-ai
 * Provides age-appropriate error messages and interactive recovery options
 */

import React, { useState, useEffect } from 'react';
import {
  AppError,
  ErrorCategory,
  ErrorSeverity,
  ErrorInfo
} from '../types/error';
import { errorHandler } from '../utils/errorHandler';
import '../styles/errorDisplay.css';

interface ErrorDisplayProps {
  error: AppError;
  message?: string;
  onRetry?: () => void;
  onReset?: () => void;
  isRecovering?: boolean;
  retryCount?: number;
  maxRetries?: number;
  showDetails?: boolean;
  onToggleDetails?: () => void;
  errorInfo?: ErrorInfo | null;
  accessibilityMode?: boolean;
  ageGroup?: '3-5' | '6-8' | '9-12';
  componentName?: string;
  className?: string;
  autoHide?: boolean;
  soundEffects?: boolean;
  helpOptions?: boolean;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  message,
  onRetry,
  onReset,
  isRecovering = false,
  retryCount = 0,
  maxRetries = 3,
  showDetails = false,
  onToggleDetails,
  errorInfo,
  accessibilityMode = false,
  ageGroup = '6-8',
  componentName,
  className = '',
  autoHide = true,
  soundEffects = true,
  helpOptions = true
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [hideTimer, setHideTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Trigger entrance animation
    setIsAnimating(true);

    // Auto-hide if enabled and error is not critical
    if (autoHide && error.severity !== ErrorSeverity.CRITICAL && !isRecovering) {
      const timer = setTimeout(() => {
        if (onReset) {
          onReset();
        }
      }, 8000); // Hide after 8 seconds

      setHideTimer(timer);

      return () => {
        if (hideTimer) {
          clearTimeout(hideTimer);
        }
      };
    }

    return () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, [autoHide, error.severity, isRecovering, onReset, hideTimer]);

  useEffect(() => {
    // Play sound effect if enabled
    if (soundEffects && !isRecovering) {
      playErrorSound();
    }
  }, [soundEffects, isRecovering]);

  const playErrorSound = () => {
    try {
      // Create a gentle error sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.3);

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play error sound:', error);
    }
  };

  const getErrorIcon = (): string => {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return '🌐';
      case ErrorCategory.AUDIO:
        return '🔇';
      case ErrorCategory.SPEECH:
        return '🎤';
      case ErrorCategory.GAME:
        return '🎮';
      case ErrorCategory.API:
        return '🤖';
      case ErrorCategory.UI:
        return '🖼️';
      case ErrorCategory.VALIDATION:
        return '✅';
      default:
        return '⚠️';
    }
  };

  const getErrorColor = (): string => {
    switch (error.severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warning';
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.CRITICAL:
        return 'critical';
      default:
        return 'info';
    }
  };

  const getAgeAppropriateMessage = (): string => {
    if (message) return message;

    const messages: Record<string, Record<string, string>> = {
      '3-5': {
        network: 'Oops! The internet is sleeping. Let\'s try again! 💤',
        audio: 'Sound is taking a nap. We can play quietly! 🔇',
        speech: 'I didn\'t hear you well. Can you try again? 🎤',
        game: 'The game needs a little break. Let\'s start over! 🎮',
        api: 'My robot friend is busy. Let\'s wait a moment! 🤖',
        default: 'Something unexpected happened, but it\'s okay! ✨'
      },
      '6-8': {
        network: 'Network connection issue. Let\'s try to reconnect! 🌐',
        audio: 'Audio is unavailable. Continuing without sound. 🔇',
        speech: 'Speech recognition problem. Please try speaking again. 🎤',
        game: 'Game encountered an issue. Let\'s restart! 🎮',
        api: 'Server is temporarily unavailable. Please try again. 🤖',
        default: 'An error occurred. Everything should work now! ✨'
      },
      '9-12': {
        network: 'Network connectivity problem. Attempting to reconnect... 🌐',
        audio: 'Audio system unavailable. Operating in silent mode. 🔇',
        speech: 'Speech recognition error. Please repeat your request. 🎤',
        game: 'Game error detected. Resetting to initial state. 🎮',
        api: 'API service temporarily unavailable. Retrying connection... 🤖',
        default: 'Unexpected error encountered and handled. System recovering. ✨'
      }
    };

    return messages[ageGroup][error.category] || messages[ageGroup].default;
  };

  const getActionText = (): string => {
    if (isRecovering) {
      return ageGroup === '3-5' ? 'Fixing...' : 'Recovering...';
    }

    if (retryCount >= maxRetries) {
      return ageGroup === '3-5' ? 'Let\'s try later!' : 'Please try again later';
    }

    switch (ageGroup) {
      case '3-5':
        return 'Try Again! 🔄';
      case '6-8':
        return 'Retry';
      case '9-12':
        return 'Retry Operation';
      default:
        return 'Retry';
    }
  };

  const getHelpText = (): string => {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        return ageGroup === '3-5'
          ? 'Make sure your internet is working!'
          : 'Check your internet connection and try again.';
      case ErrorCategory.AUDIO:
        return ageGroup === '3-5'
          ? 'Check if your speakers are working!'
          : 'Verify your audio devices and volume settings.';
      case ErrorCategory.SPEECH:
        return ageGroup === '3-5'
          ? 'Speak clearly and hold the button!'
          : 'Speak clearly into your microphone while holding the button.';
      case ErrorCategory.GAME:
        return ageGroup === '3-5'
          ? 'Games sometimes need a break!'
          : 'Game errors are normal. Let\'s start fresh!';
      default:
        return ageGroup === '3-5'
          ? 'Everything is going to be okay!'
          : 'This error has been logged and will be fixed.';
    }
  };

  const handleRetry = () => {
    if (soundEffects) {
      playClickSound();
    }
    onRetry?.();
  };

  const handleReset = () => {
    if (soundEffects) {
      playClickSound();
    }
    onReset?.();
  };

  const handleToggleHelp = () => {
    setIsHelpOpen(!isHelpOpen);
    if (soundEffects) {
      playClickSound();
    }
  };

  const playClickSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.warn('Could not play click sound:', error);
    }
  };

  const errorColor = getErrorColor();
  const errorIcon = getErrorIcon();
  const errorMessage = getAgeAppropriateMessage();
  const actionText = getActionText();
  const helpText = getHelpText();

  return (
    <div
      className={`error-display ${errorColor} ${accessibilityMode ? 'accessibility-mode' : ''} ${className} ${isAnimating ? 'animate-in' : ''}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      aria-labelledby={`error-title-${error.id}`}
      aria-describedby={`error-message-${error.id}`}
    >
      <div className="error-content">
        <div className="error-header">
          <div className="error-icon-container" aria-hidden="true">
            <span className="error-icon">{errorIcon}</span>
            {isRecovering && (
              <span className="recovery-spinner" aria-hidden="true">🔄</span>
            )}
          </div>

          <div className="error-text-container">
            <h3
              id={`error-title-${error.id}`}
              className="error-title"
            >
              {componentName ? `${componentName} Error` : 'Oops!'}
            </h3>

            <p
              id={`error-message-${error.id}`}
              className="error-message"
            >
              {errorMessage}
            </p>
          </div>
        </div>

        <div className="error-actions">
          {onRetry && retryCount < maxRetries && (
            <button
              onClick={handleRetry}
              disabled={isRecovering}
              className="error-button retry-button"
              aria-label={actionText}
              aria-busy={isRecovering}
            >
              {isRecovering ? (
                <span className="button-content">
                  <span className="spinner" aria-hidden="true">🔄</span>
                  {actionText}
                </span>
              ) : (
                <span className="button-content">
                  <span aria-hidden="true">🔄</span>
                  {actionText}
                </span>
              )}
            </button>
          )}

          {onReset && (
            <button
              onClick={handleReset}
              disabled={isRecovering}
              className="error-button reset-button"
              aria-label={ageGroup === '3-5' ? 'Start over' : 'Reset'}
            >
              <span className="button-content">
                <span aria-hidden="true">🏠</span>
                {ageGroup === '3-5' ? 'Start Over' : 'Reset'}
              </span>
            </button>
          )}

          {helpOptions && (
            <button
              onClick={handleToggleHelp}
              className="error-button help-button"
              aria-label={isHelpOpen ? 'Hide help' : 'Show help'}
              aria-expanded={isHelpOpen}
            >
              <span className="button-content">
                <span aria-hidden="true">❓</span>
                Help
              </span>
            </button>
          )}
        </div>

        {isHelpOpen && (
          <div className="error-help" role="region" aria-label="Help information">
            <p className="help-text">{helpText}</p>
            <div className="help-tips">
              <h4>Tips:</h4>
              <ul>
                <li>Stay calm, errors happen sometimes!</li>
                <li>Try clicking the retry button</li>
                <li>If it keeps happening, ask a grown-up for help</li>
              </ul>
            </div>
          </div>
        )}

        {showDetails && !accessibilityMode && (
          <details className="error-details">
            <summary onClick={onToggleDetails}>
              Technical Details (for grown-ups)
            </summary>
            <div className="details-content">
              <p><strong>Error Type:</strong> {error.name}</p>
              <p><strong>Category:</strong> {error.category}</p>
              <p><strong>Severity:</strong> {error.severity}</p>
              <p><strong>Time:</strong> {new Date(error.timestamp).toLocaleString()}</p>
              {errorInfo && (
                <div className="component-stack">
                  <strong>Component Stack:</strong>
                  <pre>{errorInfo.componentStack}</pre>
                </div>
              )}
              {error.stack && (
                <div className="error-stack">
                  <strong>Stack Trace:</strong>
                  <pre>{error.stack}</pre>
                </div>
              )}
            </div>
          </details>
        )}

        {retryCount > 0 && (
          <div className="retry-info" aria-live="polite">
            <span aria-hidden="true">📊</span>
            Tried {retryCount} time{retryCount !== 1 ? 's' : ''}
            {maxRetries - retryCount > 0 && ` • ${maxRetries - retryCount} attempt${maxRetries - retryCount !== 1 ? 's' : ''} remaining`}
          </div>
        )}
      </div>

      {autoHide && error.severity !== ErrorSeverity.CRITICAL && (
        <div className="auto-hide-indicator" aria-hidden="true">
          <span className="countdown-circle"></span>
          <span className="hide-text">Auto-hiding soon...</span>
        </div>
      )}
    </div>
  );
};

// Specialized error display components for different age groups
export const ToddlerErrorDisplay: React.FC<Omit<ErrorDisplayProps, 'ageGroup'>> = (props) => (
  <ErrorDisplay {...props} ageGroup="3-5" soundEffects={true} helpOptions={false} />
);

export const KidErrorDisplay: React.FC<Omit<ErrorDisplayProps, 'ageGroup'>> = (props) => (
  <ErrorDisplay {...props} ageGroup="6-8" soundEffects={true} helpOptions={true} />
);

export const PreteenErrorDisplay: React.FC<Omit<ErrorDisplayProps, 'ageGroup'>> = (props) => (
  <ErrorDisplay {...props} ageGroup="9-12" soundEffects={false} helpOptions={true} />
);

// Toast-style error display for less critical errors
export const ErrorToast: React.FC<{
  error: AppError;
  onDismiss?: () => void;
  ageGroup?: '3-5' | '6-8' | '9-12';
}> = ({ error, onDismiss, ageGroup = '6-8' }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss?.(), 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="error-toast" role="alert" aria-live="polite">
      <div className="toast-content">
        <span className="toast-icon" aria-hidden="true">⚠️</span>
        <span className="toast-message">
          {errorHandler.getChildFriendlyMessage(error, ageGroup)}
        </span>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onDismiss?.(), 300);
          }}
          className="toast-dismiss"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// Error container for managing multiple errors
export const ErrorContainer: React.FC<{
  errors: AppError[];
  onDismiss?: (errorId: string) => void;
  onRetry?: (error: AppError) => void;
  maxVisible?: number;
  ageGroup?: '3-5' | '6-8' | '9-12';
}> = ({
  errors,
  onDismiss,
  onRetry,
  maxVisible = 3,
  ageGroup = '6-8'
}) => {
  const visibleErrors = errors.slice(-maxVisible);

  if (visibleErrors.length === 0) return null;

  return (
    <div className="error-container" role="region" aria-label="Error notifications">
      {visibleErrors.map((error, index) => (
        <ErrorDisplay
          key={error.id}
          error={error}
          onReset={() => onDismiss?.(error.id)}
          onRetry={() => onRetry?.(error)}
          ageGroup={ageGroup}
          className="error-container-item"
          autoHide={false}
        />
      ))}
      {errors.length > maxVisible && (
        <div className="error-summary">
          +{errors.length - maxVisible} more error{errors.length - maxVisible !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};