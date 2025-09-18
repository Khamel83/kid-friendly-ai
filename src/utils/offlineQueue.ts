/**
 * Offline operation queue management for the kid-friendly-ai project
 * Provides persistent queuing with retry logic, priority management, and analytics
 */

import type {
  OfflineOperation,
  QueueConfig,
  QueueStats,
  RetryBackoffConfig,
  OfflineError,
  OfflineErrorType,
  OperationStatus,
  OperationPriority
} from '../types/offline';
import { getOfflineStorage } from './offlineStorage';

class OfflineQueue {
  private config: QueueConfig;
  private storage: ReturnType<typeof getOfflineStorage>;
  private isProcessing = false;
  private processingTimer: number | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: QueueConfig) {
    this.config = config;
    this.storage = getOfflineStorage();
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
    await this._recoverQueue();
    console.log('Offline queue initialized');
  }

  // Queue operations
  async add(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const fullOperation: OfflineOperation = {
      ...operation,
      id: this._generateId(),
      timestamp: Date.now(),
      retryCount: 0
    };

    try {
      await this.storage.store('operations', fullOperation);

      // Maintain queue size limit
      await this._enforceQueueLimit();

      // Emit event
      this._emit('operation_added', fullOperation);

      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessing();
      }

      console.log(`Operation added to queue: ${fullOperation.id} (${fullOperation.type})`);
      return fullOperation.id;
    } catch (error) {
      throw this._createError(OfflineErrorType.QUEUE_ERROR, 'Failed to add operation to queue', error);
    }
  }

  async remove(operationId: string): Promise<void> {
    try {
      await this.storage.remove('operations', operationId);
      this._emit('operation_removed', { operationId });
    } catch (error) {
      console.warn(`Failed to remove operation ${operationId}:`, error);
    }
  }

  async update(operationId: string, updates: Partial<OfflineOperation>): Promise<void> {
    try {
      const existing = await this.storage.retrieve<OfflineOperation>('operations', operationId);
      if (!existing) {
        throw new Error(`Operation ${operationId} not found`);
      }

      const updated = { ...existing, ...updates };
      await this.storage.store('operations', updated);

      this._emit('operation_updated', updated);
    } catch (error) {
      throw this._createError(OfflineErrorType.QUEUE_ERROR, 'Failed to update operation', error);
    }
  }

  async get(operationId: string): Promise<OfflineOperation | null> {
    try {
      return await this.storage.retrieve<OfflineOperation>('operations', operationId);
    } catch (error) {
      console.warn(`Failed to get operation ${operationId}:`, error);
      return null;
    }
  }

  async getAll(filter?: {
    status?: OperationStatus;
    type?: string;
    priority?: OperationPriority;
  }): Promise<OfflineOperation[]> {
    try {
      let operations = await this.storage.retrieveAll<OfflineOperation>('operations');

      if (filter) {
        if (filter.status) {
          operations = operations.filter(op => op.status === filter.status);
        }
        if (filter.type) {
          operations = operations.filter(op => op.type === filter.type);
        }
        if (filter.priority) {
          operations = operations.filter(op => op.priority === filter.priority);
        }
      }

      // Sort by priority and timestamp
      return operations.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.timestamp - b.timestamp;
      });
    } catch (error) {
      throw this._createError(OfflineErrorType.QUEUE_ERROR, 'Failed to get operations', error);
    }
  }

  // Processing methods
  async startProcessing(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this._emit('processing_started');

    // Process immediately
    await this._processQueue();

    // Set up periodic processing
    this.processingTimer = window.setInterval(
      () => this._processQueue(),
      this.config.processingDelay
    ) as unknown as number;

    console.log('Queue processing started');
  }

  async stopProcessing(): Promise<void> {
    if (!this.isProcessing) return;

    this.isProcessing = false;

    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }

    this._emit('processing_stopped');
    console.log('Queue processing stopped');
  }

  private async _processQueue(): Promise<void> {
    if (!this.isProcessing) return;

    try {
      const operations = await this.getAll({
        status: OperationStatus.PENDING
      });

      if (operations.length === 0) {
        return;
      }

      // Process operations by priority
      for (const operation of operations) {
        if (!this.isProcessing) break;

        try {
          await this._processOperation(operation);
        } catch (error) {
          console.error(`Failed to process operation ${operation.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    }
  }

  private async _processOperation(operation: OfflineOperation): Promise<void> {
    // Update status to processing
    await this.update(operation.id, {
      status: OperationStatus.PROCESSING
    });

    try {
      // Execute the operation
      const success = await this._executeOperation(operation);

      if (success) {
        // Mark as completed
        await this.update(operation.id, {
          status: OperationStatus.COMPLETED,
          timestamp: Date.now()
        });

        this._emit('operation_completed', operation);

        // Remove from queue after completion
        setTimeout(() => this.remove(operation.id), 5000);
      } else {
        // Handle failure
        await this._handleOperationFailure(operation);
      }
    } catch (error) {
      await this._handleOperationFailure(operation, error);
    }
  }

  private async _executeOperation(operation: OfflineOperation): Promise<boolean> {
    // This is where you would implement the actual operation execution
    // For now, we'll simulate success
    console.log(`Executing operation: ${operation.type} (${operation.id})`);

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));

    return true;
  }

  private async _handleOperationFailure(operation: OfflineOperation, error?: any): Promise<void> {
    const newRetryCount = operation.retryCount + 1;

    if (newRetryCount >= operation.maxRetries) {
      // Max retries reached, mark as failed
      await this.update(operation.id, {
        status: OperationStatus.FAILED,
        retryCount: newRetryCount,
        timestamp: Date.now()
      });

      this._emit('operation_failed', { operation, error });
    } else {
      // Calculate next retry time with exponential backoff
      const backoffConfig = this.config.retryBackoff;
      const delay = this._calculateBackoffDelay(newRetryCount, backoffConfig);

      // Schedule retry
      setTimeout(async () => {
        await this.update(operation.id, {
          status: OperationStatus.RETRYING,
          retryCount: newRetryCount,
          timestamp: Date.now()
        });
      }, delay);

      this._emit('operation_retry', { operation, delay });
    }
  }

  // Utility methods
  async getStats(): Promise<QueueStats> {
    try {
      const operations = await this.getAll();
      const now = Date.now();

      const stats: QueueStats = {
        totalOperations: operations.length,
        pendingOperations: operations.filter(op => op.status === OperationStatus.PENDING).length,
        processingOperations: operations.filter(op => op.status === OperationStatus.PROCESSING).length,
        completedOperations: operations.filter(op => op.status === OperationStatus.COMPLETED).length,
        failedOperations: operations.filter(op => op.status === OperationStatus.FAILED).length,
        averageProcessingTime: 0,
        oldestOperation: operations.length > 0 ? Math.min(...operations.map(op => op.timestamp)) : null
      };

      // Calculate average processing time
      const completedOps = operations.filter(op => op.status === OperationStatus.COMPLETED);
      if (completedOps.length > 0) {
        const totalTime = completedOps.reduce((sum, op) => {
          return sum + (op.timestamp - op.timestamp); // This would need actual completion time
        }, 0);
        stats.averageProcessingTime = totalTime / completedOps.length;
      }

      return stats;
    } catch (error) {
      throw this._createError(OfflineErrorType.QUEUE_ERROR, 'Failed to get queue stats', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storage.clear('operations');
      this._emit('queue_cleared');
    } catch (error) {
      throw this._createError(OfflineErrorType.QUEUE_ERROR, 'Failed to clear queue', error);
    }
  }

  async clearCompleted(): Promise<void> {
    try {
      const operations = await this.getAll({
        status: OperationStatus.COMPLETED
      });

      for (const operation of operations) {
        await this.remove(operation.id);
      }

      this._emit('completed_operations_cleared');
    } catch (error) {
      throw this._createError(OfflineErrorType.QUEUE_ERROR, 'Failed to clear completed operations', error);
    }
  }

  async retryFailed(): Promise<void> {
    try {
      const operations = await this.getAll({
        status: OperationStatus.FAILED
      });

      for (const operation of operations) {
        await this.update(operation.id, {
          status: OperationStatus.PENDING,
          retryCount: 0
        });
      }

      this._emit('failed_operations_retried');
    } catch (error) {
      throw this._createError(OfflineErrorType.QUEUE_ERROR, 'Failed to retry failed operations', error);
    }
  }

  // Event handling
  on(event: string, callback: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }

    const listeners = this.eventListeners.get(event)!;
    listeners.push(callback);

    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  private _emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // Private helper methods
  private _generateId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async _enforceQueueLimit(): Promise<void> {
    const operations = await this.getAll();
    if (operations.length > this.config.maxSize) {
      const toRemove = operations.slice(0, operations.length - this.config.maxSize);
      for (const operation of toRemove) {
        await this.remove(operation.id);
      }
    }
  }

  private async _recoverQueue(): Promise<void> {
    try {
      const operations = await this.getAll();

      // Reset processing operations to pending
      const processingOps = operations.filter(op => op.status === OperationStatus.PROCESSING);
      for (const operation of processingOps) {
        await this.update(operation.id, {
          status: OperationStatus.PENDING
        });
      }

      console.log(`Recovered ${processingOps.length} operations from previous session`);
    } catch (error) {
      console.warn('Failed to recover queue:', error);
    }
  }

  private _calculateBackoffDelay(retryCount: number, config: RetryBackoffConfig): number {
    let delay = config.initialDelay * Math.pow(config.multiplier, retryCount - 1);
    delay = Math.min(delay, config.maxDelay);

    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return delay;
  }

  private _createError(type: OfflineErrorType, message: string, cause?: any): OfflineError {
    const error = new Error(message) as OfflineError;
    error.type = type;
    error.recoverable = true;
    error.details = { cause };
    return error;
  }
}

// Export singleton instance
let offlineQueueInstance: OfflineQueue | null = null;

export function getOfflineQueue(config?: QueueConfig): OfflineQueue {
  if (!offlineQueueInstance) {
    const defaultConfig: QueueConfig = {
      maxSize: 1000,
      processingDelay: 5000, // 5 seconds
      retryBackoff: {
        initialDelay: 1000, // 1 second
        maxDelay: 300000, // 5 minutes
        multiplier: 2,
        jitter: true
      },
      persistence: true,
      compression: true
    };

    offlineQueueInstance = new OfflineQueue(config || defaultConfig);
  }

  return offlineQueueInstance;
}

// Export for testing
export { OfflineQueue };