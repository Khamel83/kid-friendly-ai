import {
  RequestConfig,
  RequestQueueItem,
  RequestError,
  RequestManagerConfig,
  RetryConfig,
  RequestInterceptor,
  PerformanceMetrics,
  ProgressInfo,
  RequestStats,
  BatchConfig
} from '../types/request';
import { networkMonitor } from './networkMonitor';
import { cacheManager } from './cacheManager';

export class RequestManager {
  private static instance: RequestManager;
  private config: Required<RequestManagerConfig>;
  private requestQueue: RequestQueueItem[] = [];
  private activeRequests: Map<string, RequestQueueItem> = new Map();
  private retryConfig: Required<RetryConfig>;
  private metrics: PerformanceMetrics;
  private interceptors: RequestInterceptor[] = [];
  private listeners: Set<(item: RequestQueueItem) => void> = new Set();
  private queueProcessingInterval: NodeJS.Timeout | null = null;
  private requestStats: Map<string, RequestStats> = new Map();
  private batchRequests: Map<string, RequestConfig[]> = new Map();

  private constructor(config: RequestManagerConfig = {}) {
    this.config = this.getDefaultConfig(config);
    this.retryConfig = this.getDefaultRetryConfig(config.retryConfig);
    this.metrics = this.getInitialMetrics();
    this.initialize();
  }

  static getInstance(config?: RequestManagerConfig): RequestManager {
    if (!RequestManager.instance) {
      RequestManager.instance = new RequestManager(config);
    }
    return RequestManager.instance;
  }

  private getDefaultConfig(config: RequestManagerConfig): Required<RequestManagerConfig> {
    return {
      baseUrl: config.baseUrl || '',
      timeout: config.timeout || 30000,
      maxConcurrentRequests: config.maxConcurrentRequests || 6,
      retryConfig: {
        maxRetries: config.retryConfig?.maxRetries || 3,
        baseDelay: config.retryConfig?.baseDelay || 1000,
        maxDelay: config.retryConfig?.maxDelay || 30000,
        backoffFactor: config.retryConfig?.backoffFactor || 2,
        retryCondition: config.retryConfig?.retryCondition || this.defaultRetryCondition
      },
      cacheConfig: {
        ttl: config.cacheConfig?.ttl || 5 * 60 * 1000,
        maxSize: config.cacheConfig?.maxSize || 100,
        strategy: config.cacheConfig?.strategy || 'lru',
        persistent: config.cacheConfig?.persistent || false
      },
      enableMetrics: config.enableMetrics || true,
      enableLogging: config.enableLogging || false,
      enableCompression: config.enableCompression || false,
      interceptors: config.interceptors || []
    };
  }

  private getDefaultRetryConfig(retryConfig?: Partial<RetryConfig>): Required<RetryConfig> {
    return {
      maxRetries: retryConfig?.maxRetries || 3,
      baseDelay: retryConfig?.baseDelay || 1000,
      maxDelay: retryConfig?.maxDelay || 30000,
      backoffFactor: retryConfig?.backoffFactor || 2,
      retryCondition: retryConfig?.retryCondition || this.defaultRetryCondition
    };
  }

  private getInitialMetrics(): PerformanceMetrics {
    return {
      requestCount: 0,
      successRate: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      totalBytes: 0,
      errorCount: 0,
      retryCount: 0,
      bandwidth: 0
    };
  }

  private initialize() {
    this.setupInterceptors();
    this.startQueueProcessing();
    this.setupNetworkMonitoring();
  }

  private setupInterceptors() {
    if (this.config.interceptors) {
      this.interceptors = [...this.config.interceptors];
    }
  }

  private startQueueProcessing() {
    this.queueProcessingInterval = setInterval(() => {
      this.processQueue();
    }, 100);
  }

  private stopQueueProcessing() {
    if (this.queueProcessingInterval) {
      clearInterval(this.queueProcessingInterval);
      this.queueProcessingInterval = null;
    }
  }

  private setupNetworkMonitoring() {
    networkMonitor.subscribe((info) => {
      this.adjustConfigBasedOnNetwork(info);
    });
  }

  private adjustConfigBasedOnNetwork(info: any) {
    const optimalConfig = networkMonitor.getOptimalRequestConfig();
    this.config.timeout = optimalConfig.timeout;
    this.config.maxConcurrentRequests = optimalConfig.batchSize;
  }

  private defaultRetryCondition(error: RequestError): boolean {
    return error.retryable &&
           (error.status === 429 ||
            error.status === 502 ||
            error.status === 503 ||
            error.status === 504 ||
            error.code === 'NETWORK_ERROR' ||
            error.code === 'TIMEOUT_ERROR');
  }

  async request(config: RequestConfig): Promise<any> {
    const startTime = Date.now();
    const requestStats: RequestStats = {
      startTime,
      bytesSent: 0,
      bytesReceived: 0,
      retries: 0,
      cacheHit: false,
      fromCache: false,
      priority: config.priority || 'normal'
    };

    try {
      const enhancedConfig = await this.applyRequestInterceptors(config);
      const cacheKey = cacheManager.get(enhancedConfig.url);

      if (cacheKey && enhancedConfig.cachePolicy !== 'no-store') {
        requestStats.cacheHit = true;
        requestStats.fromCache = true;
        this.updateMetrics({ ...requestStats, duration: 0, success: true });
        return cacheKey.data;
      }

      const queueItem = this.addToQueue(enhancedConfig, requestStats);
      return await this.processRequest(queueItem);
    } catch (error) {
      this.updateMetrics({ ...requestStats, duration: Date.now() - startTime, success: false });
      throw error;
    }
  }

  private addToQueue(config: RequestConfig, stats: RequestStats): RequestQueueItem {
    const queueItem: RequestQueueItem = {
      config,
      timestamp: Date.now(),
      attempt: 0,
      status: 'pending',
      abortController: new AbortController()
    };

    this.requestQueue.push(queueItem);
    this.requestStats.set(config.id, stats);
    this.notifyListeners(queueItem);

    return queueItem;
  }

  private async processQueue(): Promise<void> {
    if (this.activeRequests.size >= this.config.maxConcurrentRequests) {
      return;
    }

    const pendingRequests = this.requestQueue.filter(item => item.status === 'pending');
    if (pendingRequests.length === 0) {
      return;
    }

    pendingRequests.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.config.priority || 'normal'];
      const bPriority = priorityOrder[b.config.priority || 'normal'];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return a.timestamp - b.timestamp;
    });

    const availableSlots = this.config.maxConcurrentRequests - this.activeRequests.size;
    const requestsToProcess = pendingRequests.slice(0, availableSlots);

    for (const request of requestsToProcess) {
      this.activeRequests.set(request.config.id, request);
      request.status = 'running';
      this.notifyListeners(request);

      this.executeRequest(request)
        .catch(error => {
          this.config.enableLogging && console.error('Request execution error:', error);
        });
    }
  }

  private async executeRequest(queueItem: RequestQueueItem): Promise<any> {
    const { config, abortController } = queueItem;
    const stats = this.requestStats.get(config.id)!;

    try {
      const timeout = setTimeout(() => {
        abortController.abort();
      }, config.timeout || this.config.timeout);

      const response = await fetch(this.buildUrl(config.url), {
        method: config.method,
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal: abortController.signal
      });

      clearTimeout(timeout);

      const responseData = await this.handleResponse(response, config);

      queueItem.status = 'completed';
      queueItem.result = responseData;

      stats.endTime = Date.now();
      stats.duration = stats.endTime - stats.startTime;
      stats.bytesReceived = JSON.stringify(responseData).length;

      if (config.cachePolicy !== 'no-store') {
        cacheManager.set(config.url, responseData, 300000); // 5 minutes
      }

      this.updateMetrics({ ...stats, success: true });
      this.notifyListeners(queueItem);

      config.onSuccess?.(responseData);
      config.onFinally?.();

      return responseData;
    } catch (error) {
      const requestError = this.handleError(error, config);

      queueItem.status = 'failed';
      queueItem.error = requestError;

      stats.endTime = Date.now();
      stats.duration = stats.endTime - stats.startTime;
      stats.retries = queueItem.attempt;

      this.updateMetrics({ ...stats, success: false });

      if (queueItem.attempt < this.retryConfig.maxRetries &&
          this.retryConfig.retryCondition(requestError)) {
        await this.retryRequest(queueItem);
      } else {
        this.notifyListeners(queueItem);
        config.onError?.(requestError);
        config.onFinally?.();
        throw requestError;
      }
    } finally {
      this.activeRequests.delete(config.id);
      this.requestStats.delete(config.id);
    }
  }

  private async processRequest(queueItem: RequestQueueItem): Promise<any> {
    return this.executeRequest(queueItem);
  }

  private async retryRequest(queueItem: RequestQueueItem): Promise<any> {
    queueItem.attempt++;
    queueItem.status = 'pending';

    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, queueItem.attempt - 1),
      this.retryConfig.maxDelay
    );

    await new Promise(resolve => setTimeout(resolve, delay));

    this.requestQueue.push(queueItem);
    this.metrics.retryCount++;

    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        if (queueItem.status === 'completed') {
          resolve(queueItem.result);
        } else if (queueItem.status === 'failed') {
          reject(queueItem.error);
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
  }

  private buildUrl(url: string): string {
    if (this.config.baseUrl && !url.startsWith('http')) {
      return `${this.config.baseUrl}${url}`;
    }
    return url;
  }

  private async handleResponse(response: Response, config: RequestConfig): Promise<any> {
    let data = await response.json();

    if (config.transformResponse) {
      data = config.transformResponse(data);
    }

    if (!response.ok) {
      throw this.createError({
        message: data.message || `HTTP Error: ${response.status}`,
        code: `HTTP_${response.status}`,
        status: response.status,
        url: response.url,
        retryable: response.status >= 500 || response.status === 429
      });
    }

    return this.applyResponseInterceptors(data);
  }

  private handleError(error: any, config: RequestConfig): RequestError {
    if (error.name === 'AbortError') {
      return this.createError({
        message: 'Request was cancelled',
        code: 'CANCELLED',
        url: config.url,
        retryable: false
      });
    }

    if (error.name === 'TimeoutError') {
      return this.createError({
        message: 'Request timed out',
        code: 'TIMEOUT_ERROR',
        url: config.url,
        retryable: true
      });
    }

    if (error.name === 'NetworkError') {
      return this.createError({
        message: 'Network error',
        code: 'NETWORK_ERROR',
        url: config.url,
        retryable: true
      });
    }

    return this.createError({
      message: error.message || 'Unknown error',
      code: error.code || 'UNKNOWN_ERROR',
      url: config.url,
      retryable: false,
      cause: error
    });
  }

  private createError(errorData: Partial<RequestError>): RequestError {
    return {
      message: errorData.message || 'Unknown error',
      code: errorData.code || 'UNKNOWN_ERROR',
      status: errorData.status,
      url: errorData.url,
      timestamp: Date.now(),
      retryable: errorData.retryable || false,
      cause: errorData.cause,
      details: errorData.details
    };
  }

  private async applyRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let modifiedConfig = { ...config };

    for (const interceptor of this.interceptors) {
      if (interceptor.request) {
        modifiedConfig = await interceptor.request(modifiedConfig);
      }
    }

    return modifiedConfig;
  }

  private async applyResponseInterceptors(response: any): Promise<any> {
    let modifiedResponse = response;

    for (const interceptor of this.interceptors) {
      if (interceptor.response) {
        modifiedResponse = await interceptor.response(modifiedResponse);
      }
    }

    return modifiedResponse;
  }

  private updateMetrics(stats: RequestStats & { success: boolean }): void {
    if (!this.config.enableMetrics) return;

    this.metrics.requestCount++;
    this.metrics.totalBytes += stats.bytesSent + stats.bytesReceived;

    if (stats.success) {
      const successCount = this.metrics.requestCount - this.metrics.errorCount;
      this.metrics.successRate = successCount / this.metrics.requestCount;

      if (stats.duration) {
        this.metrics.averageResponseTime =
          (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + stats.duration) /
          this.metrics.requestCount;
      }
    } else {
      this.metrics.errorCount++;
      this.metrics.successRate = (this.metrics.requestCount - this.metrics.errorCount) / this.metrics.requestCount;
    }

    this.metrics.cacheHitRate = cacheManager.getMetrics().hitRate;
  }

  private notifyListeners(item: RequestQueueItem): void {
    this.listeners.forEach(listener => {
      try {
        listener(item);
      } catch (error) {
        this.config.enableLogging && console.error('Error in request listener:', error);
      }
    });
  }

  cancel(requestId: string): boolean {
    const activeRequest = this.activeRequests.get(requestId);
    if (activeRequest) {
      activeRequest.abortController?.abort();
      activeRequest.status = 'cancelled';
      this.notifyListeners(activeRequest);
      return true;
    }

    const pendingRequest = this.requestQueue.find(item => item.config.id === requestId);
    if (pendingRequest) {
      pendingRequest.status = 'cancelled';
      this.requestQueue = this.requestQueue.filter(item => item.config.id !== requestId);
      this.notifyListeners(pendingRequest);
      return true;
    }

    return false;
  }

  cancelAll(): void {
    this.activeRequests.forEach(item => {
      item.abortController?.abort();
      item.status = 'cancelled';
    });

    this.requestQueue.forEach(item => {
      item.status = 'cancelled';
    });

    this.activeRequests.clear();
    this.requestQueue = [];
  }

  getQueueStatus(): {
    active: number;
    pending: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const active = this.activeRequests.size;
    const pending = this.requestQueue.filter(item => item.status === 'pending').length;
    const completed = this.requestQueue.filter(item => item.status === 'completed').length;
    const failed = this.requestQueue.filter(item => item.status === 'failed').length;
    const cancelled = this.requestQueue.filter(item => item.status === 'cancelled').length;

    return { active, pending, completed, failed, cancelled };
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  subscribe(listener: (item: RequestQueueItem) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  addInterceptor(interceptor: RequestInterceptor): void {
    this.interceptors.push(interceptor);
  }

  removeInterceptor(interceptor: RequestInterceptor): void {
    const index = this.interceptors.indexOf(interceptor);
    if (index > -1) {
      this.interceptors.splice(index, 1);
    }
  }

  destroy(): void {
    this.stopQueueProcessing();
    this.cancelAll();
    this.listeners.clear();
    this.interceptors = [];
  }
}

export const requestManager = RequestManager.getInstance({
  maxConcurrentRequests: 6,
  timeout: 30000,
  enableMetrics: true,
  enableLogging: false,
  enableCompression: true
});

export const useRequestManager = () => {
  const [metrics, setMetrics] = useState(requestManager.getMetrics());
  const [queueStatus, setQueueStatus] = useState(requestManager.getQueueStatus());

  useEffect(() => {
    const unsubscribe = requestManager.subscribe(() => {
      setMetrics(requestManager.getMetrics());
      setQueueStatus(requestManager.getQueueStatus());
    });

    return unsubscribe;
  }, []);

  return {
    metrics,
    queueStatus,
    request: requestManager.request.bind(requestManager),
    cancel: requestManager.cancel.bind(requestManager),
    cancelAll: requestManager.cancelAll.bind(requestManager),
    subscribe: requestManager.subscribe.bind(requestManager)
  };
};

import { useState, useEffect } from 'react';