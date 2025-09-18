/**
 * Advanced caching strategies for the kid-friendly-ai project
 * Provides intelligent caching with multiple strategies, prefetching, and analytics
 */

import type {
  CacheConfig,
  CacheStrategy,
  PrefetchConfig,
  PrefetchStrategy,
  PrefetchCondition,
  OfflineError,
  OfflineErrorType
} from '../types/offline';
import { getOfflineStorage } from './offlineStorage';

interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expiry: number;
  metadata: Record<string, any>;
  strategy: CacheStrategy;
  hits: number;
  lastAccessed: number;
  size: number;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  evictionCount: number;
  prefetchCount: number;
  compressionRatio: number;
}

class OfflineCache {
  private config: CacheConfig;
  private storage: ReturnType<typeof getOfflineStorage>;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats;
  private prefetchQueue: Array<{ key: string; url: string; priority: number }> = [];
  private isPrefetching = false;
  private cleanupTimer: number | null = null;

  constructor(config: CacheConfig) {
    this.config = config;
    this.storage = getOfflineStorage();
    this.stats = this._initializeStats();
  }

  async initialize(): Promise<void> {
    await this.storage.initialize();
    await this._loadCacheFromStorage();
    await this._startCleanup();
    await this._startPrefetching();
    console.log('Offline cache initialized');
  }

  // Cache operations
  async set<T>(key: string, value: T, options: {
    strategy?: CacheStrategy;
    ttl?: number;
    metadata?: Record<string, any>;
    compress?: boolean;
  } = {}): Promise<void> {
    try {
      const strategy = options.strategy || this.config.defaultStrategy;
      const ttl = options.ttl || this.config.maxAge;
      const metadata = options.metadata || {};
      const compress = options.compress ?? this.config.compression;

      const entry: CacheEntry<T> = {
        key,
        value: compress ? await this._compress(value) : value,
        timestamp: Date.now(),
        expiry: Date.now() + ttl,
        metadata,
        strategy,
        hits: 0,
        lastAccessed: Date.now(),
        size: this._calculateSize(value)
      };

      // Store in memory cache
      this.memoryCache.set(key, entry);

      // Store in persistent cache
      await this.storage.store('cache', entry, key);

      // Enforce size limits
      await this._enforceSizeLimit();

      this._incrementStat('totalEntries');
      this._incrementStat('totalSize', entry.size);

      console.log(`Cache entry set: ${key} (${strategy})`);
    } catch (error) {
      throw this._createError(OfflineErrorType.CACHE_ERROR, `Failed to set cache entry ${key}`, error);
    }
  }

  async get<T>(key: string, options: {
    strategy?: CacheStrategy;
    fallback?: () => Promise<T>;
    revalidate?: boolean;
  } = {}): Promise<T | null> {
    const strategy = options.strategy || this.config.defaultStrategy;
    const fallback = options.fallback;
    const revalidate = options.revalidate || false;

    try {
      const startTime = Date.now();

      // Try memory cache first
      let entry = this.memoryCache.get(key);

      if (!entry) {
        // Try persistent cache
        entry = await this.storage.retrieve<CacheEntry<T>>('cache', key);
        if (entry) {
          this.memoryCache.set(key, entry);
        }
      }

      if (entry) {
        // Check if entry is expired
        if (Date.now() > entry.expiry) {
          await this.remove(key);
          return this._handleCacheMiss(key, startTime, fallback, strategy);
        }

        // Update access stats
        entry.hits++;
        entry.lastAccessed = Date.now();

        // Decompress if needed
        const value = this.config.compression && typeof entry.value === 'string'
          ? await this._decompress(entry.value)
          : entry.value;

        // Revalidate if needed (stale-while-revalidate)
        if (revalidate && strategy === CacheStrategy.STALE_WHILE_REVALIDATE) {
          this._revalidateEntry(key, fallback);
        }

        this._incrementStat('hitRate');
        this._updateResponseTime(Date.now() - startTime);

        return value as T;
      }

      return this._handleCacheMiss(key, startTime, fallback, strategy);
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return fallback ? fallback() : null;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const entry = this.memoryCache.get(key);
      if (entry) {
        this._incrementStat('totalSize', -entry.size);
      }

      this.memoryCache.delete(key);
      await this.storage.remove('cache', key);

      console.log(`Cache entry removed: ${key}`);
    } catch (error) {
      console.warn(`Failed to remove cache entry ${key}:`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      await this.storage.clear('cache');

      this.stats = this._initializeStats();

      console.log('Cache cleared');
    } catch (error) {
      throw this._createError(OfflineErrorType.CACHE_ERROR, 'Failed to clear cache', error);
    }
  }

  async keys(): Promise<string[]> {
    try {
      const entries = await this.storage.retrieveAll<CacheEntry>('cache');
      return entries.map(entry => entry.key);
    } catch (error) {
      console.warn('Failed to get cache keys:', error);
      return Array.from(this.memoryCache.keys());
    }
  }

  async has(key: string): Promise<boolean> {
    return this.memoryCache.has(key) ||
           !!(await this.storage.retrieve<CacheEntry>('cache', key));
  }

  // Prefetching methods
  async prefetch(key: string, url: string, options: {
    priority?: number;
    ttl?: number;
    metadata?: Record<string, any>;
  } = {}): Promise<void> {
    const priority = options.priority || 1;
    const ttl = options.ttl || this.config.maxAge;
    const metadata = options.metadata || {};

    this.prefetchQueue.push({ key, url, priority });
    this.prefetchQueue.sort((a, b) => b.priority - a.priority);

    this._incrementStat('prefetchCount');

    if (!this.isPrefetching) {
      this._processPrefetchQueue();
    }

    console.log(`Prefetch queued: ${key} (priority: ${priority})`);
  }

  // Cache management
  async getStats(): Promise<CacheStats> {
    const storageEntries = await this.storage.retrieveAll<CacheEntry>('cache');
    const totalEntries = this.memoryCache.size + storageEntries.length;

    return {
      ...this.stats,
      totalEntries,
      hitRate: this.stats.hitRate / Math.max(1, this.stats.hitRate + this.stats.missRate),
      missRate: this.stats.missRate / Math.max(1, this.stats.hitRate + this.stats.missRate)
    };
  }

  async prune(): Promise<void> {
    try {
      const now = Date.now();
      const keys = await this.keys();

      // Remove expired entries
      for (const key of keys) {
        const entry = this.memoryCache.get(key) ||
                     await this.storage.retrieve<CacheEntry>('cache', key);

        if (entry && now > entry.expiry) {
          await this.remove(key);
          this._incrementStat('evictionCount');
        }
      }

      // Remove least recently used entries if over size limit
      await this._enforceSizeLimit();

      console.log('Cache pruned');
    } catch (error) {
      console.warn('Cache pruning failed:', error);
    }
  }

  async warmup(keys: string[]): Promise<void> {
    try {
      const batchSize = this.config.prefetching.maxConcurrent;

      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await Promise.all(batch.map(key => this._warmupKey(key)));
      }

      console.log(`Cache warmup completed for ${keys.length} keys`);
    } catch (error) {
      console.warn('Cache warmup failed:', error);
    }
  }

  // Strategy-specific methods
  async cacheFirst<T>(key: string, fetchFn: () => Promise<T>, options: any = {}): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key, { strategy: CacheStrategy.CACHE_FIRST });
    if (cached) return cached;

    // Fetch from network
    const data = await fetchFn();
    await this.set(key, data, { strategy: CacheStrategy.CACHE_FIRST, ...options });
    return data;
  }

  async networkFirst<T>(key: string, fetchFn: () => Promise<T>, options: any = {}): Promise<T> {
    try {
      // Try network first
      const data = await fetchFn();
      await this.set(key, data, { strategy: CacheStrategy.NETWORK_FIRST, ...options });
      return data;
    } catch (error) {
      // Fall back to cache
      const cached = await this.get<T>(key, { strategy: CacheStrategy.NETWORK_FIRST });
      if (cached) return cached;
      throw error;
    }
  }

  async staleWhileRevalidate<T>(key: string, fetchFn: () => Promise<T>, options: any = {}): Promise<T> {
    // Return stale data immediately if available
    const cached = await this.get<T>(key, {
      strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
      revalidate: true
    });

    if (cached) return cached;

    // No cached data, fetch fresh
    const data = await fetchFn();
    await this.set(key, data, { strategy: CacheStrategy.STALE_WHILE_REVALIDATE, ...options });
    return data;
  }

  // Private helper methods
  private async _handleCacheMiss<T>(
    key: string,
    startTime: number,
    fallback: (() => Promise<T>) | undefined,
    strategy: CacheStrategy
  ): Promise<T | null> {
    this._incrementStat('missRate');
    this._updateResponseTime(Date.now() - startTime);

    if (fallback) {
      try {
        const data = await fallback();
        await this.set(key, data, { strategy });
        return data;
      } catch (error) {
        console.warn(`Fallback failed for key ${key}:`, error);
        return null;
      }
    }

    return null;
  }

  private async _revalidateEntry<T>(key: string, fallback?: () => Promise<T>): Promise<void> {
    if (!fallback) return;

    try {
      const data = await fallback();
      await this.set(key, data);
    } catch (error) {
      console.warn(`Revalidation failed for key ${key}:`, error);
    }
  }

  private async _loadCacheFromStorage(): Promise<void> {
    try {
      const entries = await this.storage.retrieveAll<CacheEntry>('cache');
      const now = Date.now();

      for (const entry of entries) {
        if (now <= entry.expiry) {
          this.memoryCache.set(entry.key, entry);
        } else {
          await this.storage.remove('cache', entry.key);
        }
      }

      console.log(`Loaded ${this.memoryCache.size} entries from persistent cache`);
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
    }
  }

  private async _enforceSizeLimit(): Promise<void> {
    const currentSize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.size, 0);

    if (currentSize <= this.config.maxSize) return;

    // Sort by last accessed time (LRU)
    const entries = Array.from(this.memoryCache.values())
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    // Remove entries until under limit
    for (const entry of entries) {
      if (currentSize <= this.config.maxSize * 0.8) break; // Remove 20% extra

      await this.remove(entry.key);
      this._incrementStat('evictionCount');
    }
  }

  private async _processPrefetchQueue(): Promise<void> {
    if (this.isPrefetching || this.prefetchQueue.length === 0) return;

    this.isPrefetching = true;

    try {
      const maxConcurrent = this.config.prefetching.maxConcurrent;
      const batch = this.prefetchQueue.splice(0, maxConcurrent);

      await Promise.all(batch.map(item => this._prefetchItem(item)));
    } catch (error) {
      console.warn('Prefetch processing failed:', error);
    } finally {
      this.isPrefetching = false;

      if (this.prefetchQueue.length > 0) {
        setTimeout(() => this._processPrefetchQueue(), 1000);
      }
    }
  }

  private async _prefetchItem(item: { key: string; url: string; priority: number }): Promise<void> {
    try {
      const response = await fetch(item.url);
      if (response.ok) {
        const data = await response.json();
        await this.set(item.key, data, {
          ttl: this.config.maxAge,
          metadata: { prefetch: true, priority: item.priority }
        });
      }
    } catch (error) {
      console.warn(`Prefetch failed for ${item.key}:`, error);
    }
  }

  private async _warmupKey(key: string): Promise<void> {
    try {
      const entry = await this.storage.retrieve<CacheEntry>('cache', key);
      if (entry) {
        this.memoryCache.set(key, entry);
      }
    } catch (error) {
      console.warn(`Warmup failed for key ${key}:`, error);
    }
  }

  private async _startCleanup(): Promise<void> {
    this.cleanupTimer = window.setInterval(
      () => this.prune(),
      60000 // Clean up every minute
    ) as unknown as number;
  }

  private async _startPrefetching(): Promise<void> {
    if (this.config.prefetching.enabled) {
      // Start prefetch processing
      this._processPrefetchQueue();
    }
  }

  private _calculateSize(value: any): number {
    return JSON.stringify(value).length;
  }

  private async _compress<T>(value: T): Promise<string | T> {
    if (!this.config.compression) return value;

    try {
      // Simple compression using JSON stringify and base64
      const serialized = JSON.stringify(value);
      return btoa(serialized);
    } catch (error) {
      console.warn('Compression failed, storing uncompressed:', error);
      return value;
    }
  }

  private async _decompress<T>(compressed: string): Promise<T> {
    try {
      const decompressed = atob(compressed);
      return JSON.parse(decompressed);
    } catch (error) {
      console.warn('Decompression failed:', error);
      throw error;
    }
  }

  private _initializeStats(): CacheStats {
    return {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      averageResponseTime: 0,
      evictionCount: 0,
      prefetchCount: 0,
      compressionRatio: 1
    };
  }

  private _incrementStat(stat: keyof CacheStats, value: number = 1): void {
    if (stat in this.stats) {
      (this.stats as any)[stat] += value;
    }
  }

  private _updateResponseTime(time: number): void {
    const current = this.stats.averageResponseTime;
    this.stats.averageResponseTime = (current * 0.9) + (time * 0.1);
  }

  private _createError(type: OfflineErrorType, message: string, cause?: any): OfflineError {
    const error = new Error(message) as OfflineError;
    error.type = type;
    error.recoverable = true;
    error.details = { cause };
    return error;
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Export singleton instance
let offlineCacheInstance: OfflineCache | null = null;

export function getOfflineCache(config?: CacheConfig): OfflineCache {
  if (!offlineCacheInstance) {
    const defaultConfig: CacheConfig = {
      defaultStrategy: CacheStrategy.CACHE_FIRST,
      maxSize: 50 * 1024 * 1024, // 50MB
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      compression: true,
      versioning: true,
      prefetching: {
        enabled: true,
        strategy: PrefetchStrategy.ADAPTIVE,
        maxConcurrent: 3,
        conditions: [
          { type: 'network', condition: 'effectiveType', value: '4g' },
          { type: 'storage', condition: 'available', value: 10 * 1024 * 1024 }
        ]
      }
    };

    offlineCacheInstance = new OfflineCache(config || defaultConfig);
  }

  return offlineCacheInstance;
}

// Export for testing
export { OfflineCache };