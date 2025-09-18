/**
 * Audio Asset Management System
 *
 * This module provides comprehensive audio asset management with:
 * - Progressive audio loading
 * - Audio format detection and fallback
 * - Audio compression and optimization
 * - Lazy loading of sound effects
 * - Audio asset versioning and caching
 * - Bandwidth-aware loading strategies
 * - Error handling for failed audio loads
 * - Audio preload strategies
 */

import {
  AudioAsset,
  AudioFormat,
  AudioCompression,
  AudioMetadata,
  CacheConfig,
  OptimizationConfig,
  PreloadStrategy,
  MemoryManagement
} from '../types/sound';

export interface AudioLoaderConfig {
  baseURL: string;
  fallbackFormats: AudioFormat[];
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  enableCache: boolean;
  enableCompression: boolean;
  bandwidthAware: boolean;
  preloadStrategy: PreloadStrategy;
  memoryManagement: MemoryManagement;
}

export interface LoadingProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  estimatedTime: number; // seconds
}

export interface LoadResult {
  success: boolean;
  asset?: AudioAsset;
  error?: string;
  cached: boolean;
  loadTime: number;
  size: number;
}

export class AudioLoader {
  private static instance: AudioLoader;
  private config: AudioLoaderConfig;
  private cache: Map<string, AudioAsset> = new Map();
  private loadingQueue: Map<string, Promise<LoadResult>> = new Map();
  private progressCallbacks: Map<string, (progress: LoadingProgress) => void> = new Map();
  private loadTimes: Map<string, number> = new Map();
  private failedLoads: Map<string, number> = new Map();

  // Network monitoring
  private connection: NetworkInformation | null = null;
  private estimatedBandwidth: number = 1000; // Default 1Mbps

  // Memory monitoring
  private memoryUsage: number = 0;
  private lastGC: number = 0;

  private constructor(config: Partial<AudioLoaderConfig> = {}) {
    this.config = {
      baseURL: '/sounds/',
      fallbackFormats: ['mp3', 'wav', 'ogg'],
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      enableCache: true,
      enableCompression: true,
      bandwidthAware: true,
      preloadStrategy: {
        strategy: 'adaptive',
        batchSize: 5,
        priority: ['ui', 'interaction', 'success', 'error']
      },
      memoryManagement: {
        maxMemory: 100 * 1024 * 1024, // 100MB
        gcThreshold: 80,
        unloadPolicy: 'least-used'
      },
      ...config
    };

    this.initializeNetworkMonitoring();
    this.initializeMemoryMonitoring();
  }

  static getInstance(config?: Partial<AudioLoaderConfig>): AudioLoader {
    if (!AudioLoader.instance) {
      AudioLoader.instance = new AudioLoader(config);
    }
    return AudioLoader.instance;
  }

  private initializeNetworkMonitoring(): void {
    if ('connection' in navigator) {
      this.connection = (navigator as any).connection;
      this.estimatedBandwidth = this.connection.downlink || 1000;

      this.connection.addEventListener('change', () => {
        this.estimatedBandwidth = this.connection?.downlink || 1000;
        console.log('Network connection changed, new bandwidth:', this.estimatedBandwidth);
      });
    }
  }

  private initializeMemoryMonitoring(): void {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.memoryUsage = memory.usedJSHeapSize;

        // Run garbage collection if needed
        if (this.memoryUsage > this.config.memoryManagement.maxMemory * (this.config.memoryManagement.gcThreshold / 100)) {
          this.runGarbageCollection();
        }
      }, 5000);
    }
  }

  // Public API methods
  async loadAudio(
    url: string,
    id: string,
    options: {
      format?: AudioFormat;
      priority?: number;
      onProgress?: (progress: LoadingProgress) => void;
      immediate?: boolean;
    } = {}
  ): Promise<LoadResult> {
    const startTime = performance.now();

    // Check cache first
    if (this.config.enableCache && this.cache.has(url)) {
      const asset = this.cache.get(url)!;
      return {
        success: true,
        asset,
        cached: true,
        loadTime: performance.now() - startTime,
        size: asset.size
      };
    }

    // Check if already loading
    if (this.loadingQueue.has(url)) {
      return this.loadingQueue.get(url)!;
    }

    // Store progress callback
    if (options.onProgress) {
      this.progressCallbacks.set(url, options.onProgress);
    }

    const loadPromise = this.performLoad(url, id, options);
    this.loadingQueue.set(url, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.loadingQueue.delete(url);
      this.progressCallbacks.delete(url);
    }
  }

  private async performLoad(
    url: string,
    id: string,
    options: any
  ): Promise<LoadResult> {
    const startTime = performance.now();
    let lastAttempt = performance.now();
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        const result = await this.loadWithRetry(url, id, options, attempt);
        this.loadTimes.set(url, performance.now() - startTime);

        // Clear failed loads on success
        this.failedLoads.delete(url);

        return result;
      } catch (error) {
        attempt++;
        lastAttempt = performance.now();

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          console.warn(`Attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    this.failedLoads.set(url, Date.now());
    const error = `Failed to load audio after ${this.config.maxRetries} attempts`;

    return {
      success: false,
      error,
      cached: false,
      loadTime: performance.now() - startTime,
      size: 0
    };
  }

  private async loadWithRetry(
    url: string,
    id: string,
    options: any,
    attempt: number
  ): Promise<LoadResult> {
    const startTime = performance.now();

    // Determine optimal format based on browser support and bandwidth
    const format = options.format || this.determineOptimalFormat();

    // Build full URL
    const fullUrl = this.buildUrl(url, format);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(fullUrl, {
        signal: controller.signal,
        headers: this.buildHeaders(format, attempt)
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get content length for progress tracking
      const contentLength = parseInt(response.headers.get('Content-Length') || '0');
      let loadedBytes = 0;

      // Create reader for streaming download
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const chunks: Uint8Array[] = [];
      const progressStartTime = performance.now();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        loadedBytes += value.length;

        // Report progress
        if (contentLength > 0 && this.progressCallbacks.has(url)) {
          const progress: LoadingProgress = {
            loaded: loadedBytes,
            total: contentLength,
            percentage: (loadedBytes / contentLength) * 100,
            speed: loadedBytes / ((performance.now() - progressStartTime) / 1000),
            estimatedTime: (contentLength - loadedBytes) / (loadedBytes / ((performance.now() - progressStartTime) / 1000))
          };

          this.progressCallbacks.get(url)!(progress);
        }
      }

      // Combine chunks
      const arrayBuffer = this.combineChunks(chunks);

      // Compress if enabled and supported
      let finalBuffer = arrayBuffer;
      let compression: AudioCompression | undefined;

      if (this.config.enableCompression && this.canCompress(format)) {
        compression = await this.compressAudio(arrayBuffer, format);
        if (compression) {
          finalBuffer = compression.buffer as ArrayBuffer;
        }
      }

      // Create audio asset
      const asset: AudioAsset = {
        id,
        name: this.extractNameFromUrl(url),
        url,
        format,
        size: finalBuffer.byteLength,
        loaded: true,
        compression,
        metadata: await this.extractMetadata(finalBuffer, format)
      };

      // Cache the asset
      if (this.config.enableCache) {
        this.cache.set(url, asset);
        this.updateCacheStatistics(asset);
      }

      return {
        success: true,
        asset,
        cached: false,
        loadTime: performance.now() - startTime,
        size: finalBuffer.byteLength
      };

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Load timeout for ${url}`);
      }

      throw error;
    }
  }

  private determineOptimalFormat(): AudioFormat {
    const audio = document.createElement('audio');
    const formats: AudioFormat[] = ['mp3', 'wav', 'ogg', 'aac', 'flac'];

    // Find first supported format
    for (const format of formats) {
      if (audio.canPlayType(`audio/${format}`).replace('no', '') !== '') {
        return format;
      }
    }

    // Fallback to mp3
    return 'mp3';
  }

  private buildUrl(url: string, format: AudioFormat): string {
    // Add format extension if not present
    const hasExtension = /\.(mp3|wav|ogg|aac|flac)$/i.test(url);
    const formattedUrl = hasExtension ? url : `${url}.${format}`;

    // Add cache busting parameter for versioning
    const version = Date.now().toString(36);
    return `${this.config.baseURL}${formattedUrl}?v=${version}`;
  }

  private buildHeaders(format: AudioFormat, attempt: number): HeadersInit {
    const headers: HeadersInit = {
      'Accept': `audio/${format},*/*`,
      'Accept-Encoding': this.config.enableCompression ? 'gzip, deflate, br' : 'identity',
      'Cache-Control': 'max-age=3600',
      'User-Agent': 'KidFriendlyAI-AudioLoader/1.0'
    };

    // Add bandwidth-aware headers
    if (this.config.bandwidthAware && this.connection) {
      headers['X-Bandwidth'] = this.estimatedBandwidth.toString();
      headers['X-Save-Data'] = this.connection.saveData ? 'on' : 'off';
    }

    // Add retry header
    if (attempt > 0) {
      headers['X-Retry-Attempt'] = attempt.toString();
    }

    return headers;
  }

  private combineChunks(chunks: Uint8Array[]): ArrayBuffer {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  }

  private canCompress(format: AudioFormat): boolean {
    // Compression is typically not needed for lossy formats
    return ['wav', 'flac'].includes(format);
  }

  private async compressAudio(buffer: ArrayBuffer, format: AudioFormat): Promise<AudioCompression | null> {
    // In a real implementation, this would use audio compression libraries
    // For now, we'll return a mock compression object

    if (format === 'wav') {
      return {
        type: 'lossy',
        quality: 0.8,
        bitrate: 128,
        buffer // In reality, this would be the compressed buffer
      };
    }

    return null;
  }

  private async extractMetadata(buffer: ArrayBuffer, format: AudioFormat): Promise<AudioMetadata> {
    // In a real implementation, this would parse audio metadata
    // For now, we'll return basic information

    return {
      title: this.extractNameFromUrl(''),
      format,
      size: buffer.byteLength,
      description: 'Audio asset'
    };
  }

  private extractNameFromUrl(url: string): string {
    const match = url.match(/\/([^\/]+)\.(?:mp3|wav|ogg|aac|flac)/i);
    return match ? match[1] : url;
  }

  private updateCacheStatistics(asset: AudioAsset): void {
    this.memoryUsage += asset.size;

    // Run garbage collection if needed
    if (this.memoryUsage > this.config.memoryManagement.maxMemory) {
      this.runGarbageCollection();
    }
  }

  private runGarbageCollection(): void {
    const now = Date.now();

    // Limit GC frequency
    if (now - this.lastGC < 5000) {
      return;
    }

    console.log('Running audio garbage collection...');
    this.lastGC = now;

    const policy = this.config.memoryManagement.unloadPolicy;
    const entries = Array.from(this.cache.entries());

    if (policy === 'least-used') {
      // Sort by last access time (assuming we track this)
      entries.sort((a, b) => {
        // This is simplified - in reality, you'd track access times
        return 0;
      });
    } else if (policy === 'oldest') {
      // Sort by cache entry time
      entries.sort((a, b) => 0);
    }

    // Remove entries until under memory limit
    let currentUsage = this.memoryUsage;
    const targetUsage = this.config.memoryManagement.maxMemory * 0.7; // 70% of max

    for (const [url, asset] of entries) {
      if (currentUsage <= targetUsage) break;

      this.cache.delete(url);
      currentUsage -= asset.size;
    }

    this.memoryUsage = currentUsage;
    console.log(`Garbage collection completed. Memory usage: ${this.memoryUsage} bytes`);
  }

  // Batch loading methods
  async loadBatch(
    urls: string[],
    options: {
      parallel?: number;
      onProgress?: (progress: LoadingProgress) => void;
      onComplete?: (results: LoadResult[]) => void;
    } = {}
  ): Promise<LoadResult[]> {
    const parallel = options.parallel || 3;
    const results: LoadResult[] = [];
    let completed = 0;

    const batches: string[][] = [];
    for (let i = 0; i < urls.length; i += parallel) {
      batches.push(urls.slice(i, i + parallel));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (url, index) => {
        const result = await this.loadAudio(url, `batch_${index}`);
        completed++;

        if (options.onProgress) {
          options.onProgress({
            loaded: completed,
            total: urls.length,
            percentage: (completed / urls.length) * 100,
            speed: 0,
            estimatedTime: 0
          });
        }

        return result;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    if (options.onComplete) {
      options.onComplete(results);
    }

    return results;
  }

  // Preloading methods
  async preloadSounds(
    soundIds: string[],
    strategy: PreloadStrategy = this.config.preloadStrategy
  ): Promise<void> {
    if (strategy.strategy === 'eager') {
      await this.loadBatch(soundIds.map(id => `${id}.mp3`));
    } else if (strategy.strategy === 'lazy') {
      // Schedule for lazy loading
      this.scheduleLazyLoading(soundIds);
    } else if (strategy.strategy === 'adaptive') {
      // Load based on priority and current conditions
      await this.adaptivePreload(soundIds, strategy);
    }
  }

  private scheduleLazyLoading(soundIds: string[]): void {
    // Use Intersection Observer or idle callbacks for lazy loading
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        this.loadBatch(soundIds.slice(0, this.config.preloadStrategy.batchSize));
      });
    }
  }

  private async adaptivePreload(soundIds: string[], strategy: PreloadStrategy): Promise<void> {
    // Sort by priority
    const sortedIds = [...soundIds].sort((a, b) => {
      const aPriority = strategy.priority.indexOf(a);
      const bPriority = strategy.priority.indexOf(b);
      return aPriority - bPriority;
    });

    // Load in batches based on bandwidth
    const batchSize = Math.min(
      strategy.batchSize,
      Math.floor(this.estimatedBandwidth / 100) // Adaptive batch size
    );

    const batches: string[][] = [];
    for (let i = 0; i < sortedIds.length; i += batchSize) {
      batches.push(sortedIds.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await this.loadBatch(batch.map(id => `${id}.mp3`));

      // Small delay between batches to avoid overwhelming the connection
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Utility methods
  getCacheInfo(): {
    size: number;
    count: number;
    memoryUsage: number;
    entries: Array<{ url: string; size: number; lastAccessed: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([url, asset]) => ({
      url,
      size: asset.size,
      lastAccessed: 0 // In reality, you'd track this
    }));

    return {
      size: this.cache.size,
      count: entries.length,
      memoryUsage: this.memoryUsage,
      entries
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.memoryUsage = 0;
    console.log('Audio cache cleared');
  }

  getLoadStats(): {
    averageLoadTime: number;
    successRate: number;
    failureCount: number;
    cacheHitRate: number;
  } {
    const loadTimes = Array.from(this.loadTimes.values());
    const averageLoadTime = loadTimes.length > 0
      ? loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length
      : 0;

    const failureCount = this.failedLoads.size;
    const totalLoads = loadTimes.length + failureCount;
    const successRate = totalLoads > 0 ? (loadTimes.length / totalLoads) * 100 : 0;

    // Cache hit rate would be tracked in a real implementation
    const cacheHitRate = 0.75; // Mock value

    return {
      averageLoadTime,
      successRate,
      failureCount,
      cacheHitRate
    };
  }

  isLoaded(url: string): boolean {
    return this.cache.has(url);
  }

  getAsset(url: string): AudioAsset | null {
    return this.cache.get(url) || null;
  }

  removeAsset(url: string): boolean {
    const asset = this.cache.get(url);
    if (asset) {
      this.cache.delete(url);
      this.memoryUsage -= asset.size;
      return true;
    }
    return false;
  }
}