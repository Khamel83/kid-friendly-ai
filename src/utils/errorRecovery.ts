/**
 * Error recovery strategies for kid-friendly-ai
 * Provides comprehensive recovery mechanisms and graceful degradation
 */

import {
  AppError,
  ErrorCategory,
  ErrorRecoveryStrategy,
  ErrorContext,
  ErrorRecoveryConfig
} from '../types/error';

interface RecoveryAttempt {
  id: string;
  error: AppError;
  strategy: ErrorRecoveryStrategy;
  startTime: number;
  endTime?: number;
  success: boolean;
  details?: any;
}

interface RecoveryState {
  isRecovering: boolean;
  currentAttempt: RecoveryAttempt | null;
  recoveryHistory: RecoveryAttempt[];
  successRate: number;
  averageRecoveryTime: number;
}

interface FallbackContent {
  type: 'text' | 'image' | 'audio' | 'video' | 'component';
  content: any;
  accessibility: {
    altText?: string;
    description?: string;
    ariaLabel?: string;
  };
}

export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private state: RecoveryState;
  private config: ErrorRecoveryConfig;
  private fallbackContent: Map<string, FallbackContent> = new Map();
  private recoveryCallbacks: Set<(attempt: RecoveryAttempt) => void> = new Set();

  private constructor(config: Partial<ErrorRecoveryConfig> = {}) {
    this.state = {
      isRecovering: false,
      currentAttempt: null,
      recoveryHistory: [],
      successRate: 0,
      averageRecoveryTime: 0
    };

    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 2,
      timeout: 5000,
      enableAutomaticRecovery: true,
      enableUserInitiatedRecovery: true,
      recoveryStrategies: {},
      ...config
    };

    this.initializeFallbackContent();
    this.setupRecoveryStrategies();
  }

  static getInstance(config?: Partial<ErrorRecoveryConfig>): ErrorRecoveryManager {
    if (!ErrorRecoveryManager.instance) {
      ErrorRecoveryManager.instance = new ErrorRecoveryManager(config);
    }
    return ErrorRecoveryManager.instance;
  }

  private initializeFallbackContent(): void {
    // Audio fallbacks
    this.fallbackContent.set('audio_default', {
      type: 'text',
      content: 'Audio is not available right now. Please continue without sound.',
      accessibility: {
        altText: 'Audio unavailable message',
        description: 'Message indicating audio is unavailable',
        ariaLabel: 'Audio unavailable notification'
      }
    });

    // Speech fallbacks
    this.fallbackContent.set('speech_recognition', {
      type: 'component',
      content: 'text_input',
      accessibility: {
        altText: 'Speech recognition fallback to text input',
        description: 'Text input field when speech recognition fails',
        ariaLabel: 'Text input fallback for speech'
      }
    });

    // Image fallbacks
    this.fallbackContent.set('image_default', {
      type: 'text',
      content: 'Image unavailable',
      accessibility: {
        altText: 'Image placeholder',
        description: 'Placeholder when image cannot be loaded',
        ariaLabel: 'Image unavailable'
      }
    });

    // Game fallbacks
    this.fallbackContent.set('game_default', {
      type: 'component',
      content: 'simple_game',
      accessibility: {
        altText: 'Simplified game version',
        description: 'Basic game version when full game fails',
        ariaLabel: 'Simplified game mode'
      }
    });

    // Network fallbacks
    this.fallbackContent.set('network_offline', {
      type: 'component',
      content: 'offline_mode',
      accessibility: {
        altText: 'Offline mode activated',
        description: 'Offline mode when network is unavailable',
        ariaLabel: 'Offline mode indicator'
      }
    });
  }

  private setupRecoveryStrategies(): void {
    // Default recovery strategies by category
    this.config.recoveryStrategies = {
      [ErrorCategory.NETWORK]: [
        ErrorRecoveryStrategy.RETRY,
        ErrorRecoveryStrategy.FALLBACK,
        ErrorRecoveryStrategy.NOTIFY_USER
      ],
      [ErrorCategory.API]: [
        ErrorRecoveryStrategy.RETRY,
        ErrorRecoveryStrategy.FALLBACK,
        ErrorRecoveryStrategy.NOTIFY_USER
      ],
      [ErrorCategory.UI]: [
        ErrorRecoveryStrategy.RESTART_COMPONENT,
        ErrorRecoveryStrategy.FALLBACK,
        ErrorRecoveryStrategy.LOG_ONLY
      ],
      [ErrorCategory.AUDIO]: [
        ErrorRecoveryStrategy.RETRY,
        ErrorRecoveryStrategy.FALLBACK,
        ErrorRecoveryStrategy.NOTIFY_USER
      ],
      [ErrorCategory.SPEECH]: [
        ErrorRecoveryStrategy.RETRY,
        ErrorRecoveryStrategy.FALLBACK,
        ErrorRecoveryStrategy.NOTIFY_USER
      ],
      [ErrorCategory.GAME]: [
        ErrorRecoveryStrategy.RETRY,
        ErrorRecoveryStrategy.RESET_STATE,
        ErrorRecoveryStrategy.RESTART_COMPONENT
      ],
      [ErrorCategory.PERFORMANCE]: [
        ErrorRecoveryStrategy.CLEAR_CACHE,
        ErrorRecoveryStrategy.RELOAD_PAGE,
        ErrorRecoveryStrategy.NOTIFY_USER
      ],
      [ErrorCategory.VALIDATION]: [
        ErrorRecoveryStrategy.SKIP,
        ErrorRecoveryStrategy.NOTIFY_USER,
        ErrorRecoveryStrategy.LOG_ONLY
      ]
    };
  }

  // Main recovery method
  async recoverFromError(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    if (!this.config.enableAutomaticRecovery || !error.recoverable) {
      return false;
    }

    const strategies = this.getRecoveryStrategies(error);

    for (const strategy of strategies) {
      try {
        const success = await this.executeRecoveryStrategy(error, strategy, context);
        if (success) {
          this.updateRecoveryStats(true);
          return true;
        }
      } catch (recoveryError) {
        console.error(`Recovery strategy ${strategy} failed:`, recoveryError);
        this.updateRecoveryStats(false);
      }
    }

    return false;
  }

  private getRecoveryStrategies(error: AppError): ErrorRecoveryStrategy[] {
    // Get category-specific strategies
    const categoryStrategies = this.config.recoveryStrategies[error.category] || [];

    // Get error-specific strategies
    const errorStrategies = error.recoveryStrategies || [];

    // Combine and deduplicate
    const allStrategies = [...errorStrategies, ...categoryStrategies];
    return [...new Set(allStrategies)];
  }

  private async executeRecoveryStrategy(
    error: AppError,
    strategy: ErrorRecoveryStrategy,
    context?: Partial<ErrorContext>
  ): Promise<boolean> {
    const attempt: RecoveryAttempt = {
      id: this.generateRecoveryId(),
      error,
      strategy,
      startTime: Date.now(),
      success: false
    };

    this.state.isRecovering = true;
    this.state.currentAttempt = attempt;

    try {
      let success = false;

      switch (strategy) {
        case ErrorRecoveryStrategy.RETRY:
          success = await this.executeRetry(error, context);
          break;
        case ErrorRecoveryStrategy.FALLBACK:
          success = await this.executeFallback(error, context);
          break;
        case ErrorRecoveryStrategy.SKIP:
          success = await this.executeSkip(error, context);
          break;
        case ErrorRecoveryStrategy.LOG_ONLY:
          success = await this.executeLogOnly(error, context);
          break;
        case ErrorRecoveryStrategy.NOTIFY_USER:
          success = await this.executeNotifyUser(error, context);
          break;
        case ErrorRecoveryStrategy.NOTIFY_PARENT:
          success = await this.executeNotifyParent(error, context);
          break;
        case ErrorRecoveryStrategy.RESTART_COMPONENT:
          success = await this.executeRestartComponent(error, context);
          break;
        case ErrorRecoveryStrategy.RELOAD_PAGE:
          success = await this.executeReloadPage(error, context);
          break;
        case ErrorRecoveryStrategy.CLEAR_CACHE:
          success = await this.executeClearCache(error, context);
          break;
        case ErrorRecoveryStrategy.RESET_STATE:
          success = await this.executeResetState(error, context);
          break;
        default:
          success = false;
      }

      attempt.success = success;
      attempt.endTime = Date.now();
      attempt.details = { strategy, duration: attempt.endTime - attempt.startTime };

      return success;
    } finally {
      this.state.isRecovering = false;
      this.state.currentAttempt = null;
      this.state.recoveryHistory.push(attempt);

      // Keep only recent recovery attempts
      if (this.state.recoveryHistory.length > 100) {
        this.state.recoveryHistory = this.state.recoveryHistory.slice(-100);
      }

      // Notify callbacks
      this.notifyRecoveryCallbacks(attempt);
    }
  }

  private generateRecoveryId(): string {
    return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Recovery strategy implementations
  private async executeRetry(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    const maxRetries = this.config.maxRetries;
    const baseDelay = this.config.retryDelay;
    const backoffMultiplier = this.config.backoffMultiplier;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait with exponential backoff
        const delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
        await this.sleep(delay);

        // Execute retry based on error type
        switch (error.category) {
          case ErrorCategory.NETWORK:
            return await this.retryNetworkOperation(error);
          case ErrorCategory.API:
            return await this.retryApiOperation(error);
          case ErrorCategory.AUDIO:
            return await this.retryAudioOperation(error);
          case ErrorCategory.SPEECH:
            return await this.retrySpeechOperation(error);
          case ErrorCategory.GAME:
            return await this.retryGameOperation(error);
          default:
            return await this.retryGenericOperation(error);
        }
      } catch (retryError) {
        if (attempt === maxRetries) {
          return false;
        }
      }
    }

    return false;
  }

  private async retryNetworkOperation(error: AppError): Promise<boolean> {
    try {
      // Check network connectivity
      if (!navigator.onLine) {
        return false;
      }

      // Test network with a simple request
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private async retryApiOperation(error: AppError): Promise<boolean> {
    try {
      // Test API endpoint
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache'
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private async retryAudioOperation(error: AppError): Promise<boolean> {
    try {
      // Test audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      await audioContext.resume();
      audioContext.close();
      return true;
    } catch {
      return false;
    }
  }

  private async retrySpeechOperation(error: AppError): Promise<boolean> {
    try {
      // Test speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.abort(); // Just test if we can create and abort
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async retryGameOperation(error: AppError): Promise<boolean> {
    // Generic game retry - just return true to allow game to restart
    return true;
  }

  private async retryGenericOperation(error: AppError): Promise<boolean> {
    // Generic retry - just wait and return true
    await this.sleep(this.config.retryDelay);
    return true;
  }

  private async executeFallback(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    const fallbackKey = this.getFallbackKey(error);
    const fallback = this.fallbackContent.get(fallbackKey);

    if (!fallback) {
      return false;
    }

    try {
      // Apply fallback based on type
      switch (fallback.type) {
        case 'text':
          return this.applyTextFallback(fallback.content);
        case 'component':
          return this.applyComponentFallback(fallback.content);
        case 'image':
          return this.applyImageFallback(fallback.content);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  private getFallbackKey(error: AppError): string {
    switch (error.category) {
      case ErrorCategory.AUDIO:
        return 'audio_default';
      case ErrorCategory.SPEECH:
        return 'speech_recognition';
      case ErrorCategory.NETWORK:
        return navigator.onLine ? 'network_default' : 'network_offline';
      case ErrorCategory.GAME:
        return 'game_default';
      default:
        return 'default';
    }
  }

  private applyTextFallback(content: string): boolean {
    // Dispatch custom event for text fallback
    const event = new CustomEvent('error-fallback', {
      detail: { type: 'text', content }
    });
    window.dispatchEvent(event);
    return true;
  }

  private applyComponentFallback(component: string): boolean {
    // Dispatch custom event for component fallback
    const event = new CustomEvent('error-fallback', {
      detail: { type: 'component', component }
    });
    window.dispatchEvent(event);
    return true;
  }

  private applyImageFallback(imageUrl: string): boolean {
    // Dispatch custom event for image fallback
    const event = new CustomEvent('error-fallback', {
      detail: { type: 'image', imageUrl }
    });
    window.dispatchEvent(event);
    return true;
  }

  private async executeSkip(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    // Skip the operation that caused the error
    const event = new CustomEvent('error-skip', {
      detail: { error, context }
    });
    window.dispatchEvent(event);
    return true;
  }

  private async executeLogOnly(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    // Just log the error (already done by error handler)
    return true;
  }

  private async executeNotifyUser(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    // Show user-friendly notification
    const event = new CustomEvent('error-notify', {
      detail: { error, context }
    });
    window.dispatchEvent(event);
    return true;
  }

  private async executeNotifyParent(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    // Notify parent (if parental controls are enabled)
    if (context?.additionalData?.parentalControlsEnabled) {
      const event = new CustomEvent('error-notify-parent', {
        detail: { error, context }
      });
      window.dispatchEvent(event);
    }
    return true;
  }

  private async executeRestartComponent(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    // Restart the component that caused the error
    const event = new CustomEvent('error-restart-component', {
      detail: { error, context, component: context?.component }
    });
    window.dispatchEvent(event);
    return true;
  }

  private async executeReloadPage(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    try {
      // Save current state before reload
      if (context?.additionalData?.saveState) {
        localStorage.setItem('error-recovery-state', JSON.stringify({
          error: error.message,
          timestamp: Date.now(),
          url: window.location.href
        }));
      }

      // Reload page
      window.location.reload();
      return true;
    } catch {
      return false;
    }
  }

  private async executeClearCache(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    try {
      // Clear browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Clear local storage (except for essential data)
      const essentialKeys = ['user-preferences', 'parental-controls'];
      const localStorageData: Record<string, string> = {};

      essentialKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          localStorageData[key] = value;
        }
      });

      localStorage.clear();

      // Restore essential data
      Object.entries(localStorageData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      return true;
    } catch {
      return false;
    }
  }

  private async executeResetState(error: AppError, context?: Partial<ErrorContext>): Promise<boolean> {
    try {
      // Reset application state
      sessionStorage.clear();

      // Reset specific state if context provides component info
      if (context?.component) {
        const stateKey = `component-state-${context.component}`;
        localStorage.removeItem(stateKey);
      }

      return true;
    } catch {
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateRecoveryStats(success: boolean): void {
    const recentAttempts = this.state.recoveryHistory.slice(-20);
    const successfulAttempts = recentAttempts.filter(a => a.success).length;

    this.state.successRate = successfulAttempts / recentAttempts.length;

    const totalTime = recentAttempts.reduce((sum, attempt) => {
      const duration = attempt.endTime ? attempt.endTime - attempt.startTime : 0;
      return sum + duration;
    }, 0);

    this.state.averageRecoveryTime = totalTime / recentAttempts.length;
  }

  private notifyRecoveryCallbacks(attempt: RecoveryAttempt): void {
    this.recoveryCallbacks.forEach(callback => {
      try {
        callback(attempt);
      } catch (callbackError) {
        console.error('Error in recovery callback:', callbackError);
      }
    });
  }

  // Public API methods
  getState(): RecoveryState {
    return { ...this.state };
  }

  getRecoveryHistory(limit?: number): RecoveryAttempt[] {
    const history = [...this.state.recoveryHistory];
    return limit ? history.slice(-limit) : history;
  }

  onRecovery(callback: (attempt: RecoveryAttempt) => void): () => void {
    this.recoveryCallbacks.add(callback);
    return () => this.recoveryCallbacks.delete(callback);
  }

  addFallbackContent(key: string, fallback: FallbackContent): void {
    this.fallbackContent.set(key, fallback);
  }

  getFallbackContent(key: string): FallbackContent | undefined {
    return this.fallbackContent.get(key);
  }

  clearRecoveryHistory(): void {
    this.state.recoveryHistory = [];
  }

  updateConfig(config: Partial<ErrorRecoveryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Graceful degradation methods
  enableGracefulDegradation(): void {
    // Enable fallback modes for various features
    const event = new CustomEvent('graceful-degradation-enable');
    window.dispatchEvent(event);
  }

  disableGracefulDegradation(): void {
    // Disable fallback modes
    const event = new CustomEvent('graceful-degradation-disable');
    window.dispatchEvent(event);
  }

  isGracefulDegradationActive(): boolean {
    return localStorage.getItem('graceful-degradation-active') === 'true';
  }

  // Connection recovery
  async recoverConnection(): Promise<boolean> {
    try {
      // Test basic connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });

      if (response.ok) {
        // Reconnect any WebSocket connections or real-time features
        const event = new CustomEvent('connection-recovered');
        window.dispatchEvent(event);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // State restoration
  restoreState(component?: string): any {
    try {
      if (component) {
        const stateKey = `component-state-${component}`;
        const state = localStorage.getItem(stateKey);
        return state ? JSON.parse(state) : null;
      }

      // Restore general application state
      const recoveryState = localStorage.getItem('error-recovery-state');
      if (recoveryState) {
        const parsed = JSON.parse(recoveryState);
        localStorage.removeItem('error-recovery-state');
        return parsed;
      }

      return null;
    } catch {
      return null;
    }
  }

  saveState(state: any, component?: string): void {
    try {
      if (component) {
        const stateKey = `component-state-${component}`;
        localStorage.setItem(stateKey, JSON.stringify(state));
      } else {
        localStorage.setItem('app-state', JSON.stringify(state));
      }
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }
}

// Export singleton instance
export const errorRecoveryManager = ErrorRecoveryManager.getInstance();

// Export utility functions
export const recoverFromError = (error: AppError, context?: Partial<ErrorContext>) => {
  return errorRecoveryManager.recoverFromError(error, context);
};

export const getRecoveryState = () => {
  return errorRecoveryManager.getState();
};

export const enableGracefulDegradation = () => {
  errorRecoveryManager.enableGracefulDegradation();
};

export const recoverConnection = () => {
  return errorRecoveryManager.recoverConnection();
};