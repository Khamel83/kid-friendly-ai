import {
  RequestConfig,
  RequestQueueItem,
  RequestPriority,
  BatchConfig,
  RequestError,
  PerformanceMetrics
} from '../types/request';
import { networkMonitor } from './networkMonitor';
import { cacheManager } from './cacheManager';

interface OptimizationConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  enableDeduplication: boolean;
  enableCompression: boolean;
  enablePrefetching: boolean;
  batteryAware: boolean;
  memoryAware: boolean;
  adaptiveTimeout: boolean;
}

interface BatchGroup {
  key: string;
  requests: RequestConfig[];
  timeout: NodeJS.Timeout;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

interface RequestSignature {
  method: string;
  url: string;
  headers: string;
  body: string;
}

export class RequestOptimizer {
  private static instance: RequestOptimizer;
  private config: OptimizationConfig;
  private activeBatches: Map<string, BatchGroup> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private requestSignatures: Set<string> = new Set();
  private metrics: PerformanceMetrics;
  private prefetchQueue: string[] = [];
  private isPrefetching = false;
  private batteryLevel = 1;
  private memoryUsage = 0;

  private constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = this.getDefaultConfig(config);
    this.metrics = this.getInitialMetrics();
    this.initialize();
  }

  static getInstance(config?: Partial<OptimizationConfig>): RequestOptimizer {
    if (!RequestOptimizer.instance) {
      RequestOptimizer.instance = new RequestOptimizer(config);
    }
    return RequestOptimizer.instance;
  }

  private getDefaultConfig(config: Partial<OptimizationConfig>): OptimizationConfig {
    return {
      maxBatchSize: config.maxBatchSize || 10,
      maxWaitTime: config.maxWaitTime || 100,
      enableDeduplication: config.enableDeduplication ?? true,
      enableCompression: config.enableCompression ?? true,
      enablePrefetching: config.enablePrefetching ?? true,
      batteryAware: config.batteryAware ?? true,
      memoryAware: config.memoryAware ?? true,
      adaptiveTimeout: config.adaptiveTimeout ?? true
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
    this.setupBatteryMonitoring();
    this.setupMemoryMonitoring();
    this.startPrefetching();
  }

  private setupBatteryMonitoring() {
    if (this.config.batteryAware && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.batteryLevel = battery.level;
        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
        });
      });
    }
  }

  private setupMemoryMonitoring() {
    if (this.config.memoryAware && 'memory' in (window as any).performance) {
      setInterval(() => {
        const memory = (window as any).performance.memory;
        this.memoryUsage = memory ? memory.usedJSHeapSize / memory.jsHeapSizeLimit : 0;
      }, 5000);
    }
  }

  private startPrefetching() {
    if (!this.config.enablePrefetching) return;

    setInterval(() => {
      this.processPrefetchQueue();
    }, 30000);
  }

  private async processPrefetchQueue() {
    if (this.isPrefetching || this.prefetchQueue.length === 0) return;

    if (this.shouldSkipPrefetching()) return;

    this.isPrefetching = true;
    const urlsToPrefetch = [...this.prefetchQueue];
    this.prefetchQueue = [];

    try {
      await cacheManager.prefetch(urlsToPrefetch);
    } catch (error) {
      console.error('Prefetching error:', error);
    } finally {
      this.isPrefetching = false;
    }
  }

  private shouldSkipPrefetching(): boolean {
    if (this.config.batteryAware && this.batteryLevel < 0.2) return true;
    if (this.config.memoryAware && this.memoryUsage > 0.8) return true;
    if (!networkMonitor.isOnline()) return true;
    if (networkMonitor.getCurrentInfo().quality === 'poor') return true;

    return false;
  }

  private getRequestSignature(config: RequestConfig): string {
    const signature: RequestSignature = {
      method: config.method,
      url: config.url,
      headers: JSON.stringify(config.headers || {}),
      body: JSON.stringify(config.body)
    };
    return btoa(JSON.stringify(signature));
  }

  async optimizeRequest<T = any>(
    config: RequestConfig,
    batchConfig?: BatchConfig
  ): Promise<T> {
    if (this.config.enableDeduplication) {
      const signature = this.getRequestSignature(config);

      if (this.pendingRequests.has(signature)) {
        return this.pendingRequests.get(signature) as Promise<T>;
      }

      const requestPromise = this.executeOptimizedRequest(config, batchConfig);
      this.pendingRequests.set(signature, requestPromise);

      requestPromise
        .finally(() => {
          this.pendingRequests.delete(signature);
        });

      return requestPromise;
    }

    return this.executeOptimizedRequest(config, batchConfig);
  }

  private async executeOptimizedRequest<T = any>(
    config: RequestConfig,
    batchConfig?: BatchConfig
  ): Promise<T> {
    if (batchConfig) {
      return this.batchRequest(config, batchConfig);
    }

    const optimizedConfig = await this.applyOptimizations(config);

    return fetch(optimizedConfig.url, {
      method: optimizedConfig.method,
      headers: optimizedConfig.headers,
      body: optimizedConfig.body
    }).then(response => response.json());
  }

  private async applyOptimizations(config: RequestConfig): Promise<RequestConfig> {
    const optimizedConfig = { ...config };

    if (this.config.adaptiveTimeout) {
      optimizedConfig.timeout = this.calculateAdaptiveTimeout();
    }

    if (this.config.enableCompression && !optimizedConfig.headers?.['Accept-Encoding']) {
      optimizedConfig.headers = {
        ...optimizedConfig.headers,
        'Accept-Encoding': 'gzip, deflate'
      };
    }

    if (this.config.batteryAware && this.batteryLevel < 0.3) {
      optimizedConfig.priority = 'low';
    }

    return optimizedConfig;
  }

  private calculateAdaptiveTimeout(): number {
    const networkInfo = networkMonitor.getCurrentInfo();
    const baseTimeout = 30000;

    switch (networkInfo.quality) {
      case 'excellent':
        return baseTimeout;
      case 'good':
        return baseTimeout * 1.5;
      case 'fair':
        return baseTimeout * 2;
      case 'poor':
        return baseTimeout * 3;
      default:
        return baseTimeout * 2;
    }
  }

  private async batchRequest<T = any>(
    config: RequestConfig,
    batchConfig: BatchConfig
  ): Promise<T> {
    const batchKey = batchConfig.key || 'default';
    const batchGroup = this.activeBatches.get(batchKey);

    if (batchGroup) {
      batchGroup.requests.push(config);
      return batchGroup.resolve;
    }

    return new Promise((resolve, reject) => {
      const batchGroup: BatchGroup = {
        key: batchKey,
        requests: [config],
        timeout: setTimeout(() => {
          this.executeBatch(batchKey);
        }, batchConfig.maxWaitTime || this.config.maxWaitTime),
        resolve,
        reject
      };

      this.activeBatches.set(batchKey, batchGroup);

      if (batchGroup.requests.length >= (batchConfig.maxBatchSize || this.config.maxBatchSize)) {
        clearTimeout(batchGroup.timeout);
        this.executeBatch(batchKey);
      }
    });
  }

  private async executeBatch(batchKey: string): Promise<void> {
    const batchGroup = this.activeBatches.get(batchKey);
    if (!batchGroup) return;

    this.activeBatches.delete(batchKey);

    try {
      const results = await this.processBatchRequests(batchGroup.requests);

      batchGroup.requests.forEach((request, index) => {
        const signature = this.getRequestSignature(request);
        this.pendingRequests.delete(signature);
      });

      batchGroup.resolve(results);
    } catch (error) {
      batchGroup.reject(error);
    }
  }

  private async processBatchRequests(requests: RequestConfig[]): Promise<any[]> {
    if (requests.length === 1) {
      return [await this.executeOptimizedRequest(requests[0])];
    }

    const batchUrl = this.createBatchUrl(requests);
    const batchBody = this.createBatchBody(requests);

    const response = await fetch(batchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Batch-Request': 'true'
      },
      body: JSON.stringify(batchBody)
    });

    return response.json();
  }

  private createBatchUrl(requests: RequestConfig[]): string {
    const baseUrls = [...new Set(requests.map(r => r.url.split('?')[0]))];
    return baseUrls[0] + '/batch';
  }

  private createBatchBody(requests: RequestConfig[]): any {
    return {
      requests: requests.map(r => ({
        method: r.method,
        url: r.url,
        headers: r.headers,
        body: r.body
      }))
    };
  }

  async prioritizeRequests(requests: RequestConfig[]): Promise<RequestConfig[]> {
    const networkInfo = networkMonitor.getCurrentInfo();
    const batteryOptimized = this.batteryOptimizePriorities(requests);
    const networkOptimized = this.networkOptimizePriorities(batteryOptimized, networkInfo);

    return this.sortByPriority(networkOptimized);
  }

  private batteryOptimizePriorities(requests: RequestConfig[]): RequestConfig[] {
    if (!this.config.batteryAware || this.batteryLevel > 0.5) {
      return requests;
    }

    return requests.map(request => {
      if (request.method === 'GET' && request.priority === 'normal') {
        return { ...request, priority: 'low' };
      }
      return request;
    });
  }

  private networkOptimizePriorities(
    requests: RequestConfig[],
    networkInfo: any
  ): RequestConfig[] {
    if (networkInfo.quality === 'excellent') {
      return requests;
    }

    return requests.map(request => {
      if (request.method === 'POST' || request.method === 'PUT') {
        return { ...request, priority: 'high' };
      }
      if (request.method === 'GET' && !request.priority) {
        return { ...request, priority: 'normal' };
      }
      return request;
    });
  }

  private sortByPriority(requests: RequestConfig[]): RequestConfig[] {
    const priorityOrder: Record<RequestPriority, number> = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1
    };

    return requests.sort((a, b) => {
      const aPriority = priorityOrder[a.priority || 'normal'];
      const bPriority = priorityOrder[b.priority || 'normal'];
      return bPriority - aPriority;
    });
  }

  prefetchUrls(urls: string[]): void {
    if (!this.config.enablePrefetching) return;

    const uniqueUrls = [...new Set(urls)];
    this.prefetchQueue.push(...uniqueUrls);

    if (this.prefetchQueue.length > 50) {
      this.prefetchQueue = this.prefetchQueue.slice(-50);
    }
  }

  clearPrefetchQueue(): void {
    this.prefetchQueue = [];
  }

  getOptimalBatchSize(): number {
    const networkInfo = networkMonitor.getCurrentInfo();
    const baseSize = this.config.maxBatchSize;

    switch (networkInfo.quality) {
      case 'excellent':
        return baseSize;
      case 'good':
        return Math.floor(baseSize * 0.8);
      case 'fair':
        return Math.floor(baseSize * 0.6);
      case 'poor':
        return Math.floor(baseSize * 0.4);
      default:
        return Math.floor(baseSize * 0.6);
    }
  }

  shouldCompressRequest(config: RequestConfig): boolean {
    if (!this.config.enableCompression) return false;
    if (config.method === 'GET') return false;
    if (!config.body) return false;

    const bodySize = JSON.stringify(config.body).length;
    return bodySize > 1024; // Compress if larger than 1KB
  }

  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  getBatteryLevel(): number {
    return this.batteryLevel;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  cancelAllPendingRequests(): void {
    this.pendingRequests.clear();
    this.activeBatches.forEach(batch => {
      clearTimeout(batch.timeout);
    });
    this.activeBatches.clear();
  }

  destroy(): void {
    this.cancelAllPendingRequests();
    this.clearPrefetchQueue();
  }
}

export const requestOptimizer = RequestOptimizer.getInstance({
  maxBatchSize: 10,
  maxWaitTime: 100,
  enableDeduplication: true,
  enableCompression: true,
  enablePrefetching: true,
  batteryAware: true,
  memoryAware: true,
  adaptiveTimeout: true
});

export const useRequestOptimizer = () => {
  const [metrics, setMetrics] = useState(requestOptimizer.getMetrics());
  const [batteryLevel, setBatteryLevel] = useState(requestOptimizer.getBatteryLevel());
  const [memoryUsage, setMemoryUsage] = useState(requestOptimizer.getMemoryUsage());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(requestOptimizer.getMetrics());
      setBatteryLevel(requestOptimizer.getBatteryLevel());
      setMemoryUsage(requestOptimizer.getMemoryUsage());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    metrics,
    batteryLevel,
    memoryUsage,
    optimizeRequest: requestOptimizer.optimizeRequest.bind(requestOptimizer),
    prioritizeRequests: requestOptimizer.prioritizeRequests.bind(requestOptimizer),
    prefetchUrls: requestOptimizer.prefetchUrls.bind(requestOptimizer),
    getOptimalBatchSize: requestOptimizer.getOptimalBatchSize.bind(requestOptimizer),
    shouldCompressRequest: requestOptimizer.shouldCompressRequest.bind(requestOptimizer),
    cancelAllPendingRequests: requestOptimizer.cancelAllPendingRequests.bind(requestOptimizer)
  };
};

import { useState, useEffect } from 'react';