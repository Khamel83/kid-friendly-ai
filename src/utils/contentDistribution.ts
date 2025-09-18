/**
 * Content Distribution System
 * Provides CDN integration, content delivery optimization, and performance monitoring
 */

import {
  ContentMetadata,
  ContentDistribution,
  DistributionStrategy,
  GeoOptimization,
  CompressionSettings,
  CachingStrategy,
  CacheConfig,
  DistributionMetrics,
  FailoverConfig,
  ContentError
} from '../types/content';

interface DistributionConfig {
  cdnEndpoints: string[];
  defaultStrategy: DistributionStrategy;
  enableGeoOptimization: boolean;
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'brotli' | 'zstd';
    level: number;
    threshold: number;
  };
  caching: {
    clientTTL: number;
    serverTTL: number;
    cdnTTL: number;
    maxSize: number;
    evictionPolicy: 'lru' | 'lfu' | 'fifo';
  };
  failover: {
    enabled: boolean;
    backupEndpoints: string[];
    healthCheckInterval: number;
    maxRetries: number;
    retryDelay: number;
  };
  performance: {
    timeout: number;
    retries: number;
    bandwidthLimit: number;
    preloading: boolean;
  };
}

interface DeliveryEndpoint {
  url: string;
  region: string;
  priority: number;
  isHealthy: boolean;
  responseTime: number;
  bandwidth: number;
}

interface DeliveryRequest {
  contentId: string;
  userId?: string;
  region?: string;
  deviceType?: string;
  connectionSpeed?: string;
  preferredFormat?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

interface DeliveryResponse {
  url: string;
  headers: Record<string, string>;
  cacheControl: string;
  expires: Date;
  size: number;
  estimatedTime: number;
  compressionRatio: number;
}

interface CacheEntry {
  key: string;
  data: any;
  timestamp: Date;
  ttl: number;
  hits: number;
  size: number;
}

interface HealthCheck {
  endpoint: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  errorCount: number;
}

export class ContentDistributionManager {
  private config: DistributionConfig;
  private endpoints: DeliveryEndpoint[];
  private clientCache: Map<string, CacheEntry>;
  private healthChecks: Map<string, HealthCheck>;
  private metrics: DistributionMetrics;
  private compressor: ContentCompressor;
  private optimizer: DeliveryOptimizer;
  private failover: FailoverManager;

  constructor(config?: Partial<DistributionConfig>) {
    this.config = {
      cdnEndpoints: [
        'https://cdn.kidfriendly-ai.com',
        'https://cdn-backup.kidfriendly-ai.com',
        'https://cdn-edge.kidfriendly-ai.com',
      ],
      defaultStrategy: 'cdn',
      enableGeoOptimization: true,
      compression: {
        enabled: true,
        algorithm: 'brotli',
        level: 6,
        threshold: 1024,
      },
      caching: {
        clientTTL: 3600, // 1 hour
        serverTTL: 7200, // 2 hours
        cdnTTL: 86400, // 24 hours
        maxSize: 100 * 1024 * 1024, // 100MB
        evictionPolicy: 'lru',
      },
      failover: {
        enabled: true,
        backupEndpoints: ['https://backup-cdn.kidfriendly-ai.com'],
        healthCheckInterval: 30, // 30 seconds
        maxRetries: 3,
        retryDelay: 1000, // 1 second
      },
      performance: {
        timeout: 30000, // 30 seconds
        retries: 2,
        bandwidthLimit: 10 * 1024 * 1024, // 10MB/s
        preloading: true,
      },
      ...config,
    };

    this.initializeEndpoints();
    this.initializeCache();
    this.initializeHealthChecks();
    this.initializeManagers();
    this.startHealthChecks();
  }

  /**
   * Get content URL with optimal delivery configuration
   */
  async getContentUrl(
    contentId: string,
    request?: Partial<DeliveryRequest>
  ): Promise<DeliveryResponse> {
    try {
      const deliveryRequest: DeliveryRequest = {
        contentId,
        userId: request?.userId,
        region: request?.region || await this.detectRegion(),
        deviceType: request?.deviceType || await this.detectDeviceType(),
        connectionSpeed: request?.connectionSpeed || await this.detectConnectionSpeed(),
        preferredFormat: request?.preferredFormat,
        quality: request?.quality || 'auto',
      };

      // Check cache first
      const cacheKey = this.generateCacheKey(deliveryRequest);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      // Get optimal endpoint
      const endpoint = await this.getOptimalEndpoint(deliveryRequest);
      if (!endpoint) {
        throw this.createError('NO_ENDPOINTS_AVAILABLE', 'No healthy endpoints available');
      }

      // Generate optimized URL
      const optimizedUrl = await this.generateOptimizedUrl(contentId, deliveryRequest, endpoint);

      // Apply compression if needed
      const compressionSettings = this.getCompressionSettings(deliveryRequest);
      const compressedUrl = await this.applyCompression(optimizedUrl, compressionSettings);

      // Set cache headers
      const cacheHeaders = this.generateCacheHeaders(deliveryRequest);

      const response: DeliveryResponse = {
        url: compressedUrl,
        headers: cacheHeaders,
        cacheControl: cacheHeaders['Cache-Control'],
        expires: this.calculateExpiry(),
        size: await this.estimateSize(contentId),
        estimatedTime: endpoint.responseTime,
        compressionRatio: compressionSettings.enabled ? 0.3 : 0, // 30% compression
      };

      // Cache the response
      this.addToCache(cacheKey, response, this.config.caching.clientTTL);

      // Update metrics
      this.updateMetrics(response, endpoint);

      return response;

    } catch (error) {
      throw this.createError('DELIVERY_FAILED', 'Failed to get content URL', error);
    }
  }

  /**
   * Preload content for optimal performance
   */
  async preloadContent(contentIds: string[], context?: Partial<DeliveryRequest>): Promise<void> {
    if (!this.config.performance.preloading) return;

    try {
      const preloadPromises = contentIds.map(contentId =>
        this.getContentUrl(contentId, context)
      );

      await Promise.allSettled(preloadPromises);

    } catch (error) {
      console.error('Failed to preload content:', error);
    }
  }

  /**
   * Stream content with adaptive delivery
   */
  async streamContent(
    contentId: string,
    request?: Partial<DeliveryRequest>
  ): Promise<ReadableStream> {
    try {
      const deliveryRequest: DeliveryRequest = {
        contentId,
        ...request,
      };

      const response = await this.getContentUrl(contentId, deliveryRequest);
      const stream = await this.fetchStream(response.url, deliveryRequest);

      return this.optimizeStream(stream, deliveryRequest);

    } catch (error) {
      throw this.createError('STREAMING_FAILED', 'Failed to stream content', error);
    }
  }

  /**
   * Get content distribution metrics
   */
  async getDistributionMetrics(contentId?: string): Promise<DistributionMetrics> {
    try {
      if (contentId) {
        return await this.getContentMetrics(contentId);
      }

      return this.metrics;

    } catch (error) {
      throw this.createError('METRICS_FETCH_FAILED', 'Failed to get distribution metrics', error);
    }
  }

  /**
   * Optimize content delivery for specific conditions
   */
  async optimizeDelivery(
    conditions: {
      networkType?: 'wifi' | '4g' | '3g' | '2g' | 'slow-2g';
      deviceType?: 'desktop' | 'mobile' | 'tablet';
      region?: string;
      bandwidth?: number;
    },
    contentId: string
  ): Promise<DeliveryResponse> {
    try {
      const optimization = await this.optimizer.optimizeForConditions(conditions, contentId);
      return await this.getContentUrl(contentId, optimization);

    } catch (error) {
      throw this.createError('OPTIMIZATION_FAILED', 'Failed to optimize delivery', error);
    }
  }

  /**
   * Get delivery health status
   */
  async getHealthStatus(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    endpoints: HealthCheck[];
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const healthChecks = Array.from(this.healthChecks.values());
      const healthyCount = healthChecks.filter(h => h.status === 'healthy').length;
      const totalCount = healthChecks.length;

      let overall: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyCount / totalCount >= 0.8) {
        overall = 'healthy';
      } else if (healthyCount / totalCount >= 0.5) {
        overall = 'degraded';
      } else {
        overall = 'unhealthy';
      }

      const issues = this.identifyHealthIssues(healthChecks);
      const recommendations = this.generateHealthRecommendations(issues);

      return {
        overall,
        endpoints: healthChecks,
        issues,
        recommendations,
      };

    } catch (error) {
      throw this.createError('HEALTH_CHECK_FAILED', 'Failed to get health status', error);
    }
  }

  /**
   * Test delivery performance
   */
  async testDeliveryPerformance(contentId: string): Promise<{
    endpoints: Array<{
      url: string;
      responseTime: number;
      downloadSpeed: number;
      success: boolean;
      error?: string;
    }>;
    recommendations: string[];
  }> {
    try {
      const testResults = await Promise.allSettled(
        this.endpoints.map(async (endpoint) => {
          try {
            const response = await this.getContentUrl(contentId, {
              region: endpoint.region,
            });

            const performance = await this.measurePerformance(response.url);

            return {
              url: endpoint.url,
              responseTime: performance.responseTime,
              downloadSpeed: performance.downloadSpeed,
              success: true,
            };
          } catch (error) {
            return {
              url: endpoint.url,
              responseTime: 0,
              downloadSpeed: 0,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      const endpoints = testResults.map(result =>
        result.status === 'fulfilled' ? result.value : {
          url: 'unknown',
          responseTime: 0,
          downloadSpeed: 0,
          success: false,
          error: 'Test failed',
        }
      );

      const recommendations = this.generatePerformanceRecommendations(endpoints);

      return {
        endpoints,
        recommendations,
      };

    } catch (error) {
      throw this.createError('PERFORMANCE_TEST_FAILED', 'Failed to test delivery performance', error);
    }
  }

  /**
   * Get content distribution configuration
   */
  getDistributionConfig(): ContentDistribution {
    return {
      id: 'default',
      contentId: 'global',
      strategy: this.config.defaultStrategy,
      cdnEndpoints: this.config.cdnEndpoints,
      geographicOptimization: this.config.enableGeoOptimization ? 'enabled' : 'disabled',
      compressionSettings: this.config.compression,
      cachingStrategy: {
        client: {
          enabled: true,
          ttl: this.config.caching.clientTTL,
          maxSize: this.config.caching.maxSize,
          evictionPolicy: this.config.caching.evictionPolicy,
        },
        server: {
          enabled: true,
          ttl: this.config.caching.serverTTL,
          maxSize: this.config.caching.maxSize * 2,
          evictionPolicy: this.config.caching.evictionPolicy,
        },
        cdn: {
          enabled: true,
          ttl: this.config.caching.cdnTTL,
          maxSize: this.config.caching.maxSize * 10,
          evictionPolicy: this.config.caching.evictionPolicy,
        },
      },
      performanceMetrics: this.metrics,
      failoverConfig: this.config.failover,
    };
  }

  /**
   * Update distribution configuration
   */
  updateConfig(config: Partial<DistributionConfig>): void {
    this.config = { ...this.config, ...config };
    this.initializeEndpoints();
    this.initializeHealthChecks();
  }

  // Private methods
  private initializeEndpoints(): void {
    this.endpoints = this.config.cdnEndpoints.map((url, index) => ({
      url,
      region: this.extractRegionFromUrl(url),
      priority: index,
      isHealthy: true,
      responseTime: Math.random() * 200 + 50, // 50-250ms
      bandwidth: Math.random() * 100 + 10, // 10-110 MB/s
    }));
  }

  private initializeCache(): void {
    this.clientCache = new Map();
  }

  private initializeHealthChecks(): void {
    this.healthChecks = new Map();

    this.endpoints.forEach(endpoint => {
      this.healthChecks.set(endpoint.url, {
        endpoint: endpoint.url,
        status: 'healthy',
        responseTime: endpoint.responseTime,
        lastCheck: new Date(),
        errorCount: 0,
      });
    });
  }

  private initializeManagers(): void {
    this.compressor = new ContentCompressor(this.config.compression);
    this.optimizer = new DeliveryOptimizer(this.config);
    this.failover = new FailoverManager(this.config.failover);

    this.metrics = {
      deliveryTime: 0,
      successRate: 1,
      errorRate: 0,
      bandwidthUsage: 0,
      cacheHitRate: 0,
      geographicDistribution: {},
    };
  }

  private startHealthChecks(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, this.config.failover.healthCheckInterval * 1000);
  }

  private async performHealthChecks(): Promise<void> {
    const checkPromises = this.endpoints.map(async (endpoint) => {
      try {
        const responseTime = await this.checkEndpointHealth(endpoint.url);
        const healthCheck = this.healthChecks.get(endpoint.url);

        if (healthCheck) {
          healthCheck.status = responseTime < 1000 ? 'healthy' : responseTime < 3000 ? 'degraded' : 'unhealthy';
          healthCheck.responseTime = responseTime;
          healthCheck.lastCheck = new Date();
          healthCheck.errorCount = healthCheck.status === 'unhealthy' ? healthCheck.errorCount + 1 : 0;

          endpoint.isHealthy = healthCheck.status === 'healthy';
          endpoint.responseTime = responseTime;
        }
      } catch (error) {
        const healthCheck = this.healthChecks.get(endpoint.url);
        if (healthCheck) {
          healthCheck.status = 'unhealthy';
          healthCheck.lastCheck = new Date();
          healthCheck.errorCount++;
          endpoint.isHealthy = false;
        }
      }
    });

    await Promise.allSettled(checkPromises);
  }

  private async checkEndpointHealth(url: string): Promise<number> {
    const start = Date.now();
    try {
      const response = await fetch(`${url}/health`, {
        method: 'HEAD',
        timeout: 5000,
      });
      return Date.now() - start;
    } catch (error) {
      throw new Error(`Health check failed for ${url}`);
    }
  }

  private async getOptimalEndpoint(request: DeliveryRequest): Promise<DeliveryEndpoint | null> {
    const availableEndpoints = this.endpoints.filter(e => e.isHealthy);

    if (availableEndpoints.length === 0) {
      return null;
    }

    // Geographic optimization
    if (this.config.enableGeoOptimization && request.region) {
      const geographicEndpoints = availableEndpoints.filter(e => e.region === request.region);
      if (geographicEndpoints.length > 0) {
        return geographicEndpoints.reduce((best, current) =>
          current.responseTime < best.responseTime ? current : best
        );
      }
    }

    // Performance-based selection
    return availableEndpoints.reduce((best, current) =>
      this.calculateEndpointScore(current) > this.calculateEndpointScore(best) ? current : best
    );
  }

  private calculateEndpointScore(endpoint: DeliveryEndpoint): number {
    const responseTimeScore = Math.max(0, 1000 - endpoint.responseTime) / 1000;
    const bandwidthScore = Math.min(endpoint.bandwidth / 100, 1);
    const healthScore = endpoint.isHealthy ? 1 : 0;

    return (responseTimeScore * 0.4 + bandwidthScore * 0.3 + healthScore * 0.3);
  }

  private async generateOptimizedUrl(
    contentId: string,
    request: DeliveryRequest,
    endpoint: DeliveryEndpoint
  ): Promise<string> {
    const baseUrl = `${endpoint.url}/content/${contentId}`;
    const params = new URLSearchParams();

    // Add optimization parameters
    if (request.deviceType) {
      params.set('device', request.deviceType);
    }

    if (request.connectionSpeed) {
      params.set('speed', request.connectionSpeed);
    }

    if (request.quality && request.quality !== 'auto') {
      params.set('quality', request.quality);
    }

    if (request.preferredFormat) {
      params.set('format', request.preferredFormat);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  private getCompressionSettings(request: DeliveryRequest): CompressionSettings {
    if (!this.config.compression.enabled) {
      return { ...this.config.compression, enabled: false };
    }

    // Disable compression for very fast connections
    if (request.connectionSpeed === 'fast' || request.connectionSpeed === 'wifi') {
      return { ...this.config.compression, enabled: false };
    }

    return this.config.compression;
  }

  private async applyCompression(url: string, settings: CompressionSettings): Promise<string> {
    if (!settings.enabled) {
      return url;
    }

    const compressionParam = `compression=${settings.algorithm}&level=${settings.level}`;
    return url.includes('?') ? `${url}&${compressionParam}` : `${url}?${compressionParam}`;
  }

  private generateCacheHeaders(request: DeliveryRequest): Record<string, string> {
    const headers: Record<string, string> = {};

    // Cache-Control header
    const cacheDirectives = [`max-age=${this.config.caching.clientTTL}`];

    if (request.connectionSpeed === 'slow-2g' || request.connectionSpeed === '2g') {
      cacheDirectives.push('immutable');
    }

    headers['Cache-Control'] = cacheDirectives.join(', ');
    headers['ETag'] = this.generateETag(request.contentId);
    headers['Vary'] = 'Accept-Encoding, User-Agent';

    return headers;
  }

  private calculateExpiry(): Date {
    const expiry = new Date();
    expiry.setSeconds(expiry.getSeconds() + this.config.caching.clientTTL);
    return expiry;
  }

  private async estimateSize(contentId: string): Promise<number> {
    // Simplified size estimation
    return Math.random() * 5 * 1024 * 1024 + 1 * 1024 * 1024; // 1-6MB
  }

  private updateMetrics(response: DeliveryResponse, endpoint: DeliveryEndpoint): void {
    this.metrics.deliveryTime = response.estimatedTime;
    this.metrics.bandwidthUsage = response.size;
    this.metrics.geographicDistribution[endpoint.region] =
      (this.metrics.geographicDistribution[endpoint.region] || 0) + 1;
  }

  private async getContentMetrics(contentId: string): Promise<DistributionMetrics> {
    // Simulated content-specific metrics
    return {
      ...this.metrics,
      deliveryTime: Math.random() * 1000 + 500,
      successRate: Math.random() * 0.1 + 0.9,
      errorRate: Math.random() * 0.1,
      bandwidthUsage: Math.random() * 10 * 1024 * 1024,
      cacheHitRate: Math.random() * 0.3 + 0.6,
      geographicDistribution: {
        'us-east': Math.floor(Math.random() * 1000),
        'us-west': Math.floor(Math.random() * 800),
        'eu-west': Math.floor(Math.random() * 600),
        'asia-east': Math.floor(Math.random() * 400),
      },
    };
  }

  private async fetchStream(url: string, request: DeliveryRequest): Promise<ReadableStream> {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept-Encoding': this.config.compression.enabled ? 'gzip, deflate, br' : '',
          'User-Agent': `KidFriendlyAI/${request.deviceType || 'unknown'}`,
        },
        timeout: this.config.performance.timeout,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.body as ReadableStream;

    } catch (error) {
      throw this.createError('STREAM_FETCH_FAILED', 'Failed to fetch stream', error);
    }
  }

  private optimizeStream(stream: ReadableStream, request: DeliveryRequest): ReadableStream {
    // Apply stream optimizations based on request conditions
    return stream;
  }

  private async detectRegion(): Promise<string> {
    // Simplified region detection
    return 'us-east';
  }

  private async detectDeviceType(): Promise<string> {
    // Simplified device detection
    return navigator?.userAgent?.includes('Mobile') ? 'mobile' : 'desktop';
  }

  private async detectConnectionSpeed(): Promise<string> {
    // Simplified connection speed detection
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn.effectiveType) {
        return conn.effectiveType;
      }
    }
    return '4g';
  }

  private generateCacheKey(request: DeliveryRequest): string {
    const keyData = {
      contentId: request.contentId,
      region: request.region,
      deviceType: request.deviceType,
      quality: request.quality,
      connectionSpeed: request.connectionSpeed,
    };
    return btoa(JSON.stringify(keyData));
  }

  private getFromCache(key: string): DeliveryResponse | null {
    const entry = this.clientCache.get(key);
    if (!entry) return null;

    const now = new Date();
    const age = (now.getTime() - entry.timestamp.getTime()) / 1000;

    if (age > entry.ttl) {
      this.clientCache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  private addToCache(key: string, response: DeliveryResponse, ttl: number): void {
    // Apply eviction policy if cache is full
    if (this.clientCache.size >= 100) {
      this.evictFromCache();
    }

    this.clientCache.set(key, {
      key,
      data: response,
      timestamp: new Date(),
      ttl,
      hits: 0,
      size: response.size,
    });
  }

  private evictFromCache(): void {
    switch (this.config.caching.evictionPolicy) {
      case 'lru':
        this.evictLRU();
        break;
      case 'lfu':
        this.evictLFU();
        break;
      case 'fifo':
        this.evictFIFO();
        break;
    }
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    this.clientCache.forEach((entry, key) => {
      if (entry.timestamp.getTime() < oldestTime) {
        oldestTime = entry.timestamp.getTime();
        oldestKey = key;
      }
    });

    if (oldestKey) {
      this.clientCache.delete(oldestKey);
    }
  }

  private evictLFU(): void {
    let leastUsedKey = '';
    let leastUsedHits = Infinity;

    this.clientCache.forEach((entry, key) => {
      if (entry.hits < leastUsedHits) {
        leastUsedHits = entry.hits;
        leastUsedKey = key;
      }
    });

    if (leastUsedKey) {
      this.clientCache.delete(leastUsedKey);
    }
  }

  private evictFIFO(): void {
    const firstKey = this.clientCache.keys().next().value;
    if (firstKey) {
      this.clientCache.delete(firstKey);
    }
  }

  private identifyHealthIssues(healthChecks: HealthCheck[]): string[] {
    const issues: string[] = [];

    healthChecks.forEach(check => {
      if (check.status === 'unhealthy') {
        issues.push(`Endpoint ${check.endpoint} is unhealthy`);
      }
      if (check.responseTime > 2000) {
        issues.push(`Endpoint ${check.endpoint} has high response time`);
      }
      if (check.errorCount > 5) {
        issues.push(`Endpoint ${check.endpoint} has frequent errors`);
      }
    });

    return issues;
  }

  private generateHealthRecommendations(issues: string[]): string[] {
    const recommendations: string[] = [];

    if (issues.some(issue => issue.includes('unhealthy'))) {
      recommendations.push('Consider adding backup endpoints');
      recommendations.push('Review endpoint health monitoring');
    }

    if (issues.some(issue => issue.includes('high response time'))) {
      recommendations.push('Optimize endpoint performance');
      recommendations.push('Consider geographic distribution');
    }

    return recommendations;
  }

  private async measurePerformance(url: string): Promise<{
    responseTime: number;
    downloadSpeed: number;
  }> {
    const start = Date.now();
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const responseTime = Date.now() - start;

      // Simulate download speed measurement
      const downloadSpeed = Math.random() * 50 + 5; // 5-55 MB/s

      return {
        responseTime,
        downloadSpeed,
      };
    } catch (error) {
      return {
        responseTime: Date.now() - start,
        downloadSpeed: 0,
      };
    }
  }

  private generatePerformanceRecommendations(endpoints: any[]): string[] {
    const recommendations: string[] = [];
    const successfulEndpoints = endpoints.filter(e => e.success);

    if (successfulEndpoints.length === 0) {
      recommendations.push('All endpoints are unavailable');
      recommendations.push('Check network connectivity');
      return recommendations;
    }

    const avgResponseTime = successfulEndpoints.reduce((sum, e) => sum + e.responseTime, 0) / successfulEndpoints.length;
    const avgDownloadSpeed = successfulEndpoints.reduce((sum, e) => sum + e.downloadSpeed, 0) / successfulEndpoints.length;

    if (avgResponseTime > 1000) {
      recommendations.push('High response times detected');
      recommendations.push('Consider optimizing endpoint locations');
    }

    if (avgDownloadSpeed < 10) {
      recommendations.push('Low download speeds detected');
      recommendations.push('Consider bandwidth optimization');
    }

    return recommendations;
  }

  private extractRegionFromUrl(url: string): string {
    // Simple region extraction from URL
    if (url.includes('us-east')) return 'us-east';
    if (url.includes('us-west')) return 'us-west';
    if (url.includes('eu-west')) return 'eu-west';
    if (url.includes('asia-east')) return 'asia-east';
    return 'global';
  }

  private generateETag(contentId: string): string {
    return `W/"${contentId}-${Date.now()}"`;
  }

  private createError(code: string, message: string, error?: any): ContentError {
    return {
      name: 'ContentDistributionError',
      message,
      code,
      type: 'general',
      severity: 'high',
      recoverable: true,
      timestamp: new Date(),
      stack: error?.stack,
    } as ContentError;
  }
}

// Supporting classes
class ContentCompressor {
  constructor(private settings: CompressionSettings) {}

  async compress(data: any, algorithm?: string): Promise<any> {
    // Placeholder for compression implementation
    return data;
  }

  async decompress(data: any, algorithm?: string): Promise<any> {
    // Placeholder for decompression implementation
    return data;
  }

  getCompressionRatio(originalSize: number, compressedSize: number): number {
    return compressedSize / originalSize;
  }
}

class DeliveryOptimizer {
  constructor(private config: DistributionConfig) {}

  async optimizeForConditions(conditions: any, contentId: string): Promise<Partial<DeliveryRequest>> {
    const optimizations: Partial<DeliveryRequest> = {};

    // Network-based optimization
    switch (conditions.networkType) {
      case 'slow-2g':
      case '2g':
        optimizations.quality = 'low';
        optimizations.preferredFormat = 'webp';
        break;
      case '3g':
        optimizations.quality = 'medium';
        break;
      case '4g':
      case 'wifi':
        optimizations.quality = 'high';
        break;
    }

    // Device-based optimization
    switch (conditions.deviceType) {
      case 'mobile':
        optimizations.quality = conditions.quality || 'medium';
        break;
      case 'desktop':
        optimizations.quality = conditions.quality || 'high';
        break;
    }

    // Bandwidth-based optimization
    if (conditions.bandwidth && conditions.bandwidth < 1) {
      optimizations.quality = 'low';
    }

    return optimizations;
  }
}

class FailoverManager {
  constructor(private config: any) {}

  async getFallbackEndpoint(primaryUrl: string): Promise<string | null> {
    const backupEndpoints = this.config.backupEndpoints.filter(url => url !== primaryUrl);

    for (const endpoint of backupEndpoints) {
      if (await this.testEndpoint(endpoint)) {
        return endpoint;
      }
    }

    return null;
  }

  private async testEndpoint(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/health`, { method: 'HEAD', timeout: 3000 });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const contentDistribution = new ContentDistributionManager();

// Export utility functions
export const getContentUrl = (contentId: string, request?: Partial<DeliveryRequest>) =>
  contentDistribution.getContentUrl(contentId, request);
export const preloadContent = (contentIds: string[], context?: Partial<DeliveryRequest>) =>
  contentDistribution.preloadContent(contentIds, context);
export const streamContent = (contentId: string, request?: Partial<DeliveryRequest>) =>
  contentDistribution.streamContent(contentId, request);
export const getDistributionMetrics = (contentId?: string) =>
  contentDistribution.getDistributionMetrics(contentId);
export const optimizeDelivery = (conditions: any, contentId: string) =>
  contentDistribution.optimizeDelivery(conditions, contentId);
export const getHealthStatus = () =>
  contentDistribution.getHealthStatus();
export const testDeliveryPerformance = (contentId: string) =>
  contentDistribution.testDeliveryPerformance(contentId);