import {
  CacheConfig,
  CacheEntry,
  CacheMetrics,
  CacheStrategy,
  RequestConfig
} from '../types/request';

interface CacheKey {
  method: string;
  url: string;
  headers: string;
  body: string;
}

export class CacheManager {
  private static instance: CacheManager;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private persistentCache: Storage | null = null;
  private config: Required<CacheConfig>;
  private metrics: CacheMetrics;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private listeners: Set<() => void> = new Set();

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = this.getDefaultConfig(config);
    this.metrics = this.getInitialMetrics();
    this.initialize();
  }

  static getInstance(config?: Partial<CacheConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  private getDefaultConfig(config: Partial<CacheConfig>): Required<CacheConfig> {
    return {
      ttl: config.ttl || 5 * 60 * 1000, // 5 minutes
      maxSize: config.maxSize || 100, // 100 entries
      strategy: config.strategy || 'lru',
      persistent: config.persistent || false,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator
    };
  }

  private getInitialMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      size: 0,
      itemCount: 0,
      hitRate: 0,
      evictionCount: 0,
      cleanupCount: 0
    };
  }

  private initialize() {
    if (this.config.persistent && typeof window !== 'undefined') {
      this.persistentCache = localStorage;
      this.loadFromPersistentCache();
    }

    this.startCleanupInterval();
  }

  private loadFromPersistentCache() {
    if (!this.persistentCache) return;

    try {
      const serializedCache = this.persistentCache.getItem('request_cache');
      if (serializedCache) {
        const cacheData = JSON.parse(serializedCache);
        Object.entries(cacheData).forEach(([key, entry]) => {
          if (this.isValidEntry(entry as CacheEntry)) {
            this.memoryCache.set(key, entry as CacheEntry);
          }
        });
      }
    } catch (error) {
      console.error('Error loading cache from persistent storage:', error);
    }
  }

  private saveToPersistentCache() {
    if (!this.persistentCache) return;

    try {
      const cacheData: Record<string, CacheEntry> = {};
      this.memoryCache.forEach((entry, key) => {
        cacheData[key] = entry;
      });
      this.persistentCache.setItem('request_cache', JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving cache to persistent storage:', error);
      this.handleStorageError();
    }
  }

  private handleStorageError() {
    if (this.persistentCache) {
      this.clearCache();
      console.warn('Cache cleared due to storage error');
    }
  }

  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  private stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private defaultKeyGenerator(config: RequestConfig): string {
    const keyData: CacheKey = {
      method: config.method,
      url: config.url,
      headers: JSON.stringify(config.headers || {}),
      body: JSON.stringify(config.body)
    };
    return btoa(JSON.stringify(keyData));
  }

  private isValidEntry(entry: CacheEntry): boolean {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.timestamp + entry.ttl <= Date.now()) return false;
    return true;
  }

  private getSizeOfEntry(entry: CacheEntry): number {
    return JSON.stringify(entry).length;
  }

  private evictEntries() {
    const entries = Array.from(this.memoryCache.entries());
    const strategy = this.config.strategy;

    switch (strategy) {
      case 'lru':
        this.evictLRU(entries);
        break;
      case 'lfu':
        this.evictLFU(entries);
        break;
      case 'fifo':
        this.evictFIFO(entries);
        break;
      case 'priority':
        this.evictByPriority(entries);
        break;
    }

    this.metrics.evictionCount++;
    this.notifyListeners();
  }

  private evictLRU(entries: [string, CacheEntry][]) {
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const entriesToRemove = entries.slice(0, Math.floor(entries.length * 0.2));
    entriesToRemove.forEach(([key]) => {
      this.memoryCache.delete(key);
    });
  }

  private evictLFU(entries: [string, CacheEntry][]) {
    entries.sort((a, b) => a[1].hits - b[1].hits);
    const entriesToRemove = entries.slice(0, Math.floor(entries.length * 0.2));
    entriesToRemove.forEach(([key]) => {
      this.memoryCache.delete(key);
    });
  }

  private evictFIFO(entries: [string, CacheEntry][]) {
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const entriesToRemove = entries.slice(0, Math.floor(entries.length * 0.2));
    entriesToRemove.forEach(([key]) => {
      this.memoryCache.delete(key);
    });
  }

  private evictByPriority(entries: [string, CacheEntry][]) {
    entries.sort((a, b) => {
      const priorityA = a[1].metadata?.priority || 0;
      const priorityB = b[1].metadata?.priority || 0;
      return priorityA - priorityB;
    });
    const entriesToRemove = entries.slice(0, Math.floor(entries.length * 0.2));
    entriesToRemove.forEach(([key]) => {
      this.memoryCache.delete(key);
    });
  }

  private cleanup() {
    let cleanedCount = 0;
    const now = Date.now();

    this.memoryCache.forEach((entry, key) => {
      if (entry.timestamp + entry.ttl <= now) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      this.metrics.cleanupCount += cleanedCount;
      this.updateMetrics();
      this.notifyListeners();
    }

    if (this.config.persistent) {
      this.saveToPersistentCache();
    }
  }

  private updateMetrics() {
    this.metrics.itemCount = this.memoryCache.size;
    this.metrics.size = Array.from(this.memoryCache.values()).reduce(
      (total, entry) => total + this.getSizeOfEntry(entry),
      0
    );
    this.metrics.hitRate = this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0;
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in cache listener:', error);
      }
    });
  }

  get(key: string): CacheEntry | null {
    const entry = this.memoryCache.get(key);

    if (!entry) {
      this.metrics.misses++;
      this.updateMetrics();
      return null;
    }

    if (!this.isValidEntry(entry)) {
      this.memoryCache.delete(key);
      this.metrics.misses++;
      this.updateMetrics();
      return null;
    }

    entry.hits++;
    this.metrics.hits++;
    this.updateMetrics();

    if (this.config.persistent) {
      this.saveToPersistentCache();
    }

    return entry;
  }

  set(key: string, data: any, ttl: number = this.config.ttl, metadata?: Record<string, any>): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      size: this.getSizeOfEntry({ data, timestamp: Date.now(), ttl, hits: 0, size: 0 }),
      metadata
    };

    this.memoryCache.set(key, entry);

    if (this.memoryCache.size > this.config.maxSize) {
      this.evictEntries();
    }

    this.updateMetrics();

    if (this.config.persistent) {
      this.saveToPersistentCache();
    }

    this.notifyListeners();
  }

  delete(key: string): boolean {
    const deleted = this.memoryCache.delete(key);

    if (deleted) {
      this.updateMetrics();

      if (this.config.persistent) {
        this.saveToPersistentCache();
      }

      this.notifyListeners();
    }

    return deleted;
  }

  clear(): void {
    this.memoryCache.clear();

    if (this.persistentCache) {
      this.persistentCache.removeItem('request_cache');
    }

    this.metrics = this.getInitialMetrics();
    this.notifyListeners();
  }

  has(key: string): boolean {
    const entry = this.memoryCache.get(key);
    return entry ? this.isValidEntry(entry) : false;
  }

  keys(): string[] {
    return Array.from(this.memoryCache.keys());
  }

  values(): CacheEntry[] {
    return Array.from(this.memoryCache.values()).filter(entry => this.isValidEntry(entry));
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async prefetch(urls: string[], config?: Partial<RequestConfig>): Promise<void> {
    const prefetchPromises = urls.map(async (url) => {
      const key = this.config.keyGenerator!({
        id: `prefetch-${Date.now()}`,
        url,
        method: 'GET',
        ...config
      });

      if (!this.has(key)) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            this.set(key, data);
          }
        } catch (error) {
          console.error(`Error prefetching ${url}:`, error);
        }
      }
    });

    await Promise.allSettled(prefetchPromises);
  }

  warmCache(keyDataPairs: Array<{key: string, data: any, ttl?: number}>): void {
    keyDataPairs.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl || this.config.ttl);
    });
  }

  invalidatePattern(pattern: RegExp): number {
    let invalidationCount = 0;

    this.memoryCache.forEach((entry, key) => {
      if (pattern.test(key)) {
        this.memoryCache.delete(key);
        invalidationCount++;
      }
    });

    if (invalidationCount > 0) {
      this.updateMetrics();

      if (this.config.persistent) {
        this.saveToPersistentCache();
      }

      this.notifyListeners();
    }

    return invalidationCount;
  }

  destroy() {
    this.stopCleanupInterval();
    this.clear();
    this.listeners.clear();
  }
}

export const cacheManager = CacheManager.getInstance({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  strategy: 'lru',
  persistent: true
});

export const useCacheManager = () => {
  const [metrics, setMetrics] = useState(cacheManager.getMetrics());

  useEffect(() => {
    const unsubscribe = cacheManager.subscribe(() => {
      setMetrics(cacheManager.getMetrics());
    });

    return unsubscribe;
  }, []);

  return {
    metrics,
    get: cacheManager.get.bind(cacheManager),
    set: cacheManager.set.bind(cacheManager),
    delete: cacheManager.delete.bind(cacheManager),
    clear: cacheManager.clear.bind(cacheManager),
    has: cacheManager.has.bind(cacheManager),
    prefetch: cacheManager.prefetch.bind(cacheManager),
    warmCache: cacheManager.warmCache.bind(cacheManager),
    invalidatePattern: cacheManager.invalidatePattern.bind(cacheManager)
  };
};

import { useState, useEffect } from 'react';