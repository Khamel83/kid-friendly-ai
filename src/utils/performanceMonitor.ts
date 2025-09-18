/**
 * Performance monitoring utilities for the Kid-Friendly AI Assistant
 */

import React from 'react';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceThreshold {
  name: string;
  warning: number;
  critical: number;
  unit: string;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private observers: Set<(metric: PerformanceMetric) => void> = new Set();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Set performance thresholds for metrics
   */
  setThreshold(name: string, warning: number, critical: number, unit: string): void {
    this.thresholds.set(name, { name, warning, critical, unit });
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, unit: string, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);
    this.checkThresholds(metric);
    this.notifyObservers(metric);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Measure execution time of a function
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, 'ms', metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(`${name}_error`, duration, 'ms', { ...metadata, error: error.message });
      throw error;
    }
  }

  /**
   * Measure execution time of a synchronous function
   */
  measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const startTime = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration, 'ms', metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(`${name}_error`, duration, 'ms', { ...metadata, error: error.message });
      throw error;
    }
  }

  /**
   * Check if metric exceeds thresholds
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.name);
    if (!threshold) return;

    if (metric.value >= threshold.critical) {
      console.error(`🚨 CRITICAL PERFORMANCE: ${metric.name} = ${metric.value}${metric.unit} (threshold: ${threshold.critical}${threshold.unit})`);
      this.notifyObservers({ ...metric, severity: 'critical' });
    } else if (metric.value >= threshold.warning) {
      console.warn(`⚠️  PERFORMANCE WARNING: ${metric.name} = ${metric.value}${metric.unit} (threshold: ${threshold.warning}${threshold.unit})`);
      this.notifyObservers({ ...metric, severity: 'warning' });
    }
  }

  /**
   * Notify observers of new metrics
   */
  private notifyObservers(metric: PerformanceMetric & { severity?: string }): void {
    this.observers.forEach(observer => {
      try {
        observer(metric);
      } catch (error) {
        console.error('Performance observer error:', error);
      }
    });
  }

  /**
   * Add performance observer
   */
  addObserver(observer: (metric: PerformanceMetric) => void): void {
    this.observers.add(observer);
  }

  /**
   * Remove performance observer
   */
  removeObserver(observer: (metric: PerformanceMetric) => void): void {
    this.observers.delete(observer);
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(name?: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } {
    const metrics = name
      ? this.metrics.filter(m => m.name === name)
      : this.metrics;

    if (metrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const p95Index = Math.floor(values.length * 0.95);
    const p99Index = Math.floor(values.length * 0.99);

    return {
      count: values.length,
      avg,
      min: values[0],
      max: values[values.length - 1],
      p95: values[p95Index] || 0,
      p99: values[p99Index] || 0,
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(minutes: number = 60, name?: string): PerformanceMetric[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.filter(m =>
      m.timestamp >= cutoff &&
      (name ? m.name === name : true)
    );
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

// Web Vitals monitoring
export class WebVitalsMonitor {
  private static instance: WebVitalsMonitor;
  private metrics: Map<string, number> = new Map();

  static getInstance(): WebVitalsMonitor {
    if (!WebVitalsMonitor.instance) {
      WebVitalsMonitor.instance = new WebVitalsMonitor();
    }
    return WebVitalsMonitor.instance;
  }

  /**
   * Initialize Web Vitals monitoring
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Dynamically import web-vitals
    const { onCLS, onFID, onLCP, onTTFB, onINP } = await import('web-vitals');

    onCLS((metric) => this.recordMetric('cls', metric.value));
    onFID((metric) => this.recordMetric('fid', metric.value));
    onLCP((metric) => this.recordMetric('lcp', metric.value));
    onTTFB((metric) => this.recordMetric('ttfb', metric.value));
    onINP((metric) => this.recordMetric('inp', metric.value));
  }

  /**
   * Record web vital metric
   */
  private recordMetric(name: string, value: number): void {
    this.metrics.set(name, value);

    // Log significant performance issues
    const thresholds = {
      cls: 0.1,      // Cumulative Layout Shift
      fid: 100,      // First Input Delay (ms)
      lcp: 2500,     // Largest Contentful Paint (ms)
      ttfb: 800,     // Time to First Byte (ms)
      inp: 200,      // Interaction to Next Paint (ms)
    };

    const threshold = thresholds[name as keyof typeof thresholds];
    if (threshold && value > threshold) {
      console.warn(`⚠️  ${name.toUpperCase()} threshold exceeded: ${value} > ${threshold}`);
    }
  }

  /**
   * Get current web vitals
   */
  getVitals(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
}

// React component performance monitoring
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.FC<P> => {
  const performanceMonitor = PerformanceMonitor.getInstance();

  return (props: P) => {
    const renderStartTime = performance.now();

    React.useEffect(() => {
      const renderTime = performance.now() - renderStartTime;
      performanceMonitor.recordMetric(
        `${componentName}_render`,
        renderTime,
        'ms'
      );
    });

    return <Component {...props} />;
  };
};

// Memory usage monitoring
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private performanceMonitor: PerformanceMonitor;

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): void {
    if (typeof performance === 'undefined' || !(performance as any).memory) {
      return;
    }

    const memory = (performance as any).memory;

    this.performanceMonitor.recordMetric('js_heap_size_limit', memory.jsHeapSizeLimit, 'bytes');
    this.performanceMonitor.recordMetric('total_js_heap_size', memory.totalJSHeapSize, 'bytes');
    this.performanceMonitor.recordMetric('used_js_heap_size', memory.usedJSHeapSize, 'bytes');

    // Calculate memory usage percentage
    const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    this.performanceMonitor.recordMetric('memory_usage_percentage', usagePercentage, '%');
  }

  /**
   * Start periodic memory monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    this.recordMemoryUsage(); // Initial recording

    setInterval(() => {
      this.recordMemoryUsage();
    }, intervalMs);
  }
}

// Network performance monitoring
export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private performanceMonitor: PerformanceMonitor;

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
  }

  /**
   * Monitor network connection
   */
  monitorConnection(): void {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return;
    }

    const connection = (navigator as any).connection;

    this.performanceMonitor.recordMetric(
      'effective_connection_type',
      connection.effectiveType === '4g' ? 4 :
      connection.effectiveType === '3g' ? 3 :
      connection.effectiveType === '2g' ? 2 : 1,
      'type'
    );

    if (connection.downlink) {
      this.performanceMonitor.recordMetric('downlink', connection.downlink, 'mbps');
    }

    if (connection.rtt) {
      this.performanceMonitor.recordMetric('rtt', connection.rtt, 'ms');
    }

    // Listen for connection changes
    connection.addEventListener('change', () => {
      this.monitorConnection();
    });
  }
}

// Initialize default thresholds
const performanceMonitor = PerformanceMonitor.getInstance();
performanceMonitor.setThreshold('component_render', 16, 50, 'ms');      // 60fps target
performanceMonitor.setThreshold('api_call', 1000, 5000, 'ms');         // API response time
performanceMonitor.setThreshold('memory_usage_percentage', 80, 90, '%'); // Memory usage
performanceMonitor.setThreshold('bundle_load', 3000, 10000, 'ms');      // Bundle loading

export {
  PerformanceMonitor as default,
  WebVitalsMonitor,
  MemoryMonitor,
  NetworkMonitor,
};