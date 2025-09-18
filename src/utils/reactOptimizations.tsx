import React, { useMemo, useCallback, memo, useRef, useEffect } from 'react';
import { PerformanceMonitor } from './performanceMonitor';

const performanceMonitor = PerformanceMonitor.getInstance();

/**
 * Performance-optimized memo HOC with automatic monitoring
 */
export function optimizedMemo<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.FC<P> {
  const MemoizedComponent = memo(Component);

  const WrappedComponent: React.FC<P> = (props) => {
    const renderStartTime = performance.now();

    useEffect(() => {
      const renderTime = performance.now() - renderStartTime;
      performanceMonitor.recordMetric(
        `${componentName}_render`,
        renderTime,
        'ms'
      );
    });

    return <MemoizedComponent {...props} />;
  };

  WrappedComponent.displayName = `Optimized(${componentName})`;
  return WrappedComponent;
}

/**
 * Optimized useCallback with performance monitoring
 */
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  name: string
): T {
  const monitoredCallback = useCallback((...args: Parameters<T>) => {
    const startTime = performance.now();
    try {
      const result = callback(...args);
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric(`${name}_execution`, duration, 'ms');
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric(`${name}_error`, duration, 'ms', { error: error.message });
      throw error;
    }
  }, deps);

  return monitoredCallback as T;
}

/**
 * Optimized useMemo with performance monitoring
 */
export function useOptimizedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  name: string
): T {
  const startTime = performance.now();
  const result = useMemo(factory, deps);
  const duration = performance.now() - startTime;

  useEffect(() => {
    performanceMonitor.recordMetric(`${name}_memoization`, duration, 'ms');
  }, deps);

  return result;
}

/**
 * Virtual list component for long lists
 */
export interface VirtualListItem {
  id: string | number;
  height: number;
  content: React.ReactNode;
}

export interface VirtualListProps {
  items: VirtualListItem[];
  height: number;
  width: number;
  itemHeight: number;
  renderItem: (item: VirtualListItem) => React.ReactNode;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export const VirtualList: React.FC<VirtualListProps> = memo(({
  items,
  height,
  width,
  itemHeight,
  renderItem,
  onEndReached,
  endReachedThreshold = 200,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate visible items
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(height / itemHeight) + 1,
    items.length - 1
  );

  // Check if end reached
  useEffect(() => {
    if (containerRef.current && onEndReached) {
      const container = containerRef.current;
      const scrollBottom = container.scrollTop + container.clientHeight;
      const threshold = container.scrollHeight - endReachedThreshold;

      if (scrollBottom >= threshold) {
        onEndReached();
      }
    }
  }, [scrollTop, onEndReached, endReachedThreshold]);

  // Get visible items
  const visibleItems = useOptimizedMemo(
    () => items.slice(startIndex, endIndex + 1),
    [items, startIndex, endIndex],
    'virtual_list_items'
  );

  // Calculate offset for positioning
  const offsetY = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height,
        width,
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map(item => (
            <div key={item.id} style={{ height: itemHeight }}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

VirtualList.displayName = 'VirtualList';

/**
 * Lazy loading component
 */
export interface LazyLoadProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  offset?: number;
  onVisible?: () => void;
}

export const LazyLoad: React.FC<LazyLoadProps> = memo(({
  children,
  placeholder = <div>Loading...</div>,
  offset = 100,
  onVisible,
}) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          onVisible?.();
          observer.disconnect();
        }
      },
      { rootMargin: `${offset}px` }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [offset, onVisible]);

  return (
    <div ref={elementRef}>
      {isVisible ? children : placeholder}
    </div>
  );
});

LazyLoad.displayName = 'LazyLoad';

/**
 * Debounced input component
 */
export interface DebouncedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

export const DebouncedInput: React.FC<DebouncedInputProps> = memo(({
  value,
  onChange,
  debounceMs = 300,
  ...props
}) => {
  const [displayValue, setDisplayValue] = React.useState(value);
  const timeoutRef = useRef<NodeJS.Timeout>();

  React.useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, debounceMs);
  }, [onChange, debounceMs]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return <input {...props} value={displayValue} onChange={handleChange} />;
});

DebouncedInput.displayName = 'DebouncedInput';

/**
 * Performance-optimized image component
 */
export interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  placeholder?: string;
  blurDataURL?: string;
  loading?: 'lazy' | 'eager';
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = memo(({
  src,
  alt,
  width,
  height,
  placeholder,
  blurDataURL,
  loading = 'lazy',
  className = '',
  onLoad,
  onError,
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  if (hasError && placeholder) {
    return <div className={className}>{placeholder}</div>;
  }

  return (
    <div
      className={`optimized-image-container ${className}`}
      style={{ position: 'relative', width, height }}
    >
      {!isLoaded && blurDataURL && (
        <img
          src={blurDataURL}
          alt=""
          className="blur-placeholder"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            filter: 'blur(10px)',
            transform: 'scale(1.1)',
          }}
        />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          width: '100%',
          height: '100%',
        }}
        className="optimized-image"
      />
    </div>
  );
});

OptimizedImage.displayName = 'OptimizedImage';

/**
 * Performance monitoring wrapper
 */
export interface PerformanceWrapperProps {
  children: React.ReactNode;
  componentName: string;
  logRenders?: boolean;
}

export const PerformanceWrapper: React.FC<PerformanceWrapperProps> = memo(({
  children,
  componentName,
  logRenders = false,
}) => {
  const renderCount = React.useRef(0);
  const lastRenderTime = React.useRef(0);

  React.useEffect(() => {
    renderCount.current += 1;
    const now = performance.now();

    if (lastRenderTime.current > 0) {
      const timeSinceLastRender = now - lastRenderTime.current;
      performanceMonitor.recordMetric(
        `${componentName}_time_between_renders`,
        timeSinceLastRender,
        'ms',
        { renderCount: renderCount.current }
      );
    }

    lastRenderTime.current = now;

    if (logRenders && renderCount.current % 10 === 0) {
      console.warn(`⚠️  ${componentName} has rendered ${renderCount.current} times`);
    }
  });

  return <>{children}</>;
});

PerformanceWrapper.displayName = 'PerformanceWrapper';

/**
 * Hook for performance monitoring
 */
export function usePerformanceMonitoring(componentName: string) {
  const renderCount = React.useRef(0);
  const mountTime = React.useRef(performance.now());

  React.useEffect(() => {
    renderCount.current += 1;

    if (renderCount.current > 1) {
      performanceMonitor.recordMetric(
        `${componentName}_render_count`,
        renderCount.current,
        'count'
      );
    }
  });

  React.useEffect(() => {
    return () => {
      const componentLifetime = performance.now() - mountTime.current;
      performanceMonitor.recordMetric(
        `${componentName}_lifetime`,
        componentLifetime,
        'ms'
      );
    };
  }, []);
}