import { useEffect, useRef } from 'react';
import { PerformanceMonitor, WebVitalsMonitor, MemoryMonitor, NetworkMonitor } from '../utils/performanceMonitor';

interface PerformanceMetrics {
  fps: number;
  memory: {
    used: number;
    total: number;
    limit: number;
    percentage: number;
  };
  renderTime: number;
  interactionTime: number;
}

export function usePerformanceMonitoring(componentName: string) {
  const performanceMonitor = PerformanceMonitor.getInstance();
  const webVitalsMonitor = WebVitalsMonitor.getInstance();
  const memoryMonitor = MemoryMonitor.getInstance();
  const networkMonitor = NetworkMonitor.getInstance();

  const metricsRef = useRef<PerformanceMetrics>({
    fps: 0,
    memory: {
      used: 0,
      total: 0,
      limit: 0,
      percentage: 0,
    },
    renderTime: 0,
    interactionTime: 0,
  });

  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const mountTimeRef = useRef(performance.now());

  // Monitor frame rate (FPS)
  useEffect(() => {
    let animationFrameId: number;

    const measureFPS = (timestamp: number) => {
      frameCountRef.current++;

      const elapsed = timestamp - lastFrameTimeRef.current;
      if (elapsed >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / elapsed);

        performanceMonitor.recordMetric(`${componentName}_fps`, fps, 'fps');
        metricsRef.current.fps = fps;

        // Reset counters
        frameCountRef.current = 0;
        lastFrameTimeRef.current = timestamp;
      }

      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [componentName, performanceMonitor]);

  // Monitor memory usage
  useEffect(() => {
    const memoryInterval = setInterval(() => {
      memoryMonitor.recordMemoryUsage();
    }, 30000); // Every 30 seconds

    return () => clearInterval(memoryInterval);
  }, [memoryMonitor]);

  // Monitor network connection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      networkMonitor.monitorConnection();
    }
  }, [networkMonitor]);

  // Track component lifecycle metrics
  useEffect(() => {
    // Mount time
    const mountTime = performance.now() - mountTimeRef.current;
    performanceMonitor.recordMetric(`${componentName}_mount_time`, mountTime, 'ms');

    return () => {
      // Unmount time
      const lifetime = performance.now() - mountTimeRef.current;
      performanceMonitor.recordMetric(`${componentName}_lifetime`, lifetime, 'ms');
    };
  }, [componentName, performanceMonitor]);

  // Initialize web vitals
  useEffect(() => {
    if (typeof window !== 'undefined') {
      webVitalsMonitor.initialize().catch(error => {
        console.warn('Failed to initialize web vitals:', error);
      });
    }
  }, [webVitalsMonitor]);

  // Performance wrapper for functions
  const measurePerformance = async <T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    return performanceMonitor.measureAsync(
      `${componentName}_${name}`,
      fn,
      metadata
    );
  };

  // Track user interactions
  const trackInteraction = (interactionType: string) => {
    const startTime = performance.now();

    return {
      end: () => {
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric(
          `${componentName}_${interactionType}`,
          duration,
          'ms'
        );
        metricsRef.current.interactionTime = duration;
      },
    };
  };

  // Get performance summary
  const getPerformanceSummary = () => {
    const renderSummary = performanceMonitor.getMetricsSummary(`${componentName}_render`);
    const fpsSummary = performanceMonitor.getMetricsSummary(`${componentName}_fps`);

    return {
      render: renderSummary,
      fps: fpsSummary,
      currentMetrics: metricsRef.current,
      webVitals: webVitalsMonitor.getVitals(),
    };
  };

  return {
    measurePerformance,
    trackInteraction,
    getPerformanceSummary,
    metrics: metricsRef.current,
  };
}

// Hook for optimizing expensive operations
export function useOptimizedOperation<T>(
  operation: () => Promise<T>,
  deps: React.DependencyList,
  options: {
    name: string;
    debounceMs?: number;
    throttleMs?: number;
    cacheKey?: string;
  } = { name: 'operation' }
) {
  const { measurePerformance } = usePerformanceMonitoring(options.name);
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  const timeoutRef = useRef<NodeJS.Timeout>();

  const executeOperation = useCallback(async (): Promise<T> => {
    // Check cache first
    if (options.cacheKey) {
      const cached = cacheRef.current.get(options.cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
        return cached.data;
      }
    }

    // Execute with performance monitoring
    const result = await measurePerformance('execute', operation);

    // Cache result
    if (options.cacheKey) {
      cacheRef.current.set(options.cacheKey, {
        data: result,
        timestamp: Date.now(),
      });
    }

    return result;
  }, [operation, measurePerformance, options.cacheKey]);

  // Debounced version
  const debouncedExecute = useCallback(async (): Promise<T> => {
    return new Promise((resolve) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        const result = await executeOperation();
        resolve(result);
      }, options.debounceMs || 300);
    });
  }, [executeOperation, options.debounceMs]);

  // Throttled version
  const throttledExecute = useCallback(async (): Promise<T> => {
    return new Promise((resolve) => {
      if (timeoutRef.current) {
        resolve(cacheRef.current.get(options.cacheKey)?.data);
        return;
      }

      timeoutRef.current = setTimeout(async () => {
        const result = await executeOperation();
        resolve(result);

        setTimeout(() => {
          timeoutRef.current = undefined;
        }, options.throttleMs || 100);
      }, 0);
    });
  }, [executeOperation, options.cacheKey, options.throttleMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    execute: executeOperation,
    debouncedExecute,
    throttledExecute,
  };
}

// Hook for monitoring component render performance
export function useRenderPerformance(componentName: string) {
  const { measurePerformance } = usePerformanceMonitoring(componentName);
  const renderCountRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);

  const startRender = useCallback(() => {
    return performance.now();
  }, []);

  const endRender = useCallback((startTime: number) => {
    const renderTime = performance.now() - startTime;
    renderTimesRef.current.push(renderTime);

    // Keep only last 10 render times
    if (renderTimesRef.current.length > 10) {
      renderTimesRef.current = renderTimesRef.current.slice(-10);
    }

    renderCountRef.current++;

    // Record performance metric
    measurePerformance('render', async () => {
      return renderTime;
    });

    return {
      renderTime,
      renderCount: renderCountRef.current,
      averageRenderTime: renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length,
    };
  }, [measurePerformance]);

  const getRenderStats = useCallback(() => {
    const times = renderTimesRef.current;
    const average = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const max = times.length > 0 ? Math.max(...times) : 0;
    const min = times.length > 0 ? Math.min(...times) : 0;

    return {
      count: renderCountRef.current,
      average,
      max,
      min,
      recentTimes: [...times],
    };
  }, []);

  return {
    startRender,
    endRender,
    getRenderStats,
  };
}

// Hook for monitoring load performance
export function useLoadPerformance(resourceName: string) {
  const { measurePerformance } = usePerformanceMonitoring(resourceName);

  const monitorLoad = useCallback(async <T>(
    loadFn: () => Promise<T>,
    resourceType: string = 'resource'
  ): Promise<T> => {
    const startTime = performance.now();

    try {
      const result = await measurePerformance('load', loadFn, {
        resourceType,
        timestamp: Date.now(),
      });

      const loadTime = performance.now() - startTime;
      console.log(`${resourceName} loaded in ${loadTime.toFixed(2)}ms`);

      return result;
    } catch (error) {
      const loadTime = performance.now() - startTime;
      console.error(`${resourceName} failed to load after ${loadTime.toFixed(2)}ms:`, error);
      throw error;
    }
  }, [measurePerformance]);

  return { monitorLoad };
}