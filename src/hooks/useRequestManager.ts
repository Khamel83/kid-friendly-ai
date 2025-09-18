import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo
} from 'react';
import {
  RequestConfig,
  RequestState,
  RequestError,
  UseRequestManagerOptions,
  ProgressInfo,
  BatchRequestResult
} from '../types/request';
import { requestManager } from '../utils/requestManager';
import { cacheManager } from '../utils/cacheManager';
import { networkMonitor } from '../utils/networkMonitor';
import { requestOptimizer } from '../utils/requestOptimizer';

interface UseRequestResult<T = any> {
  data: T | null;
  error: RequestError | null;
  loading: boolean;
  progress: ProgressInfo | null;
  request: (config: RequestConfig) => Promise<T>;
  cancel: () => void;
  retry: () => Promise<T>;
  refetch: () => Promise<T>;
  mutate: (data: T | ((oldData: T) => T)) => void;
  isStale: boolean;
  lastFetch: number | null;
}

interface UseBatchRequestResult<T = any> {
  data: T[] | null;
  errors: RequestError[];
  loading: boolean;
  request: (configs: RequestConfig[]) => Promise<T[]>;
  cancel: () => void;
  retry: () => Promise<T[]>;
  results: BatchRequestResult | null;
}

export function useRequestManager<T = any>(
  config: RequestConfig | null,
  options: UseRequestManagerOptions = {}
): UseRequestResult<T> {
  const [state, setState] = useState<RequestState>({
    data: null,
    error: null,
    loading: false,
    progress: null,
    lastFetch: null,
    isStale: true,
    retries: 0
  });

  const requestIdRef = useRef<string>('');
  const optionsRef = useRef(options);
  const configRef = useRef(config);
  const abortControllerRef = useRef<AbortController | null>(null);

  optionsRef.current = options;
  configRef.current = config;

  const isMountedRef = useRef(true);
  const isStaleRef = useRef(true);
  const refetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const calculateStaleness = useCallback((lastFetch: number | null): boolean => {
    if (!lastFetch) return true;
    const staleTime = optionsRef.current.staleTime || 5 * 60 * 1000; // 5 minutes default
    return Date.now() - lastFetch > staleTime;
  }, []);

  const executeRequest = useCallback(async (requestConfig: RequestConfig): Promise<T> => {
    if (!isMountedRef.current) return state.data as T;

    setState(prev => ({ ...prev, loading: true, error: null }));
    optionsRef.current.onLoading?.(true);

    const startTime = Date.now();
    requestIdRef.current = `request-${Date.now()}-${Math.random()}`;

    try {
      const result = await requestManager.request({
        ...requestConfig,
        id: requestIdRef.current,
        onProgress: (progress: ProgressInfo) => {
          if (isMountedRef.current) {
            setState(prev => ({ ...prev, progress }));
            optionsRef.current.onProgress?.(progress);
          }
        }
      });

      if (isMountedRef.current) {
        const endTime = Date.now();
        setState(prev => ({
          ...prev,
          data: result,
          error: null,
          loading: false,
          progress: null,
          lastFetch: endTime,
          isStale: false,
          retries: prev.retries
        }));

        isStaleRef.current = false;
        optionsRef.current.onLoading?.(false);
        optionsRef.current.onSuccess?.(result);
      }

      return result;
    } catch (error) {
      const requestError = error as RequestError;

      if (isMountedRef.current) {
        const shouldRetry = optionsRef.current.retryCondition?.(requestError) ?? true;
        const canRetry = state.retries < (requestConfig.retries || 3);

        if (shouldRetry && canRetry) {
          setState(prev => ({ ...prev, retries: prev.retries + 1 }));
          return executeRequest(requestConfig);
        }

        setState(prev => ({
          ...prev,
          error: requestError,
          loading: false,
          progress: null
        }));

        optionsRef.current.onLoading?.(false);
        optionsRef.current.onError?.(requestError);
      }

      throw requestError;
    }
  }, [state.retries]);

  const request = useCallback(async (requestConfig: RequestConfig): Promise<T> => {
    return executeRequest(requestConfig);
  }, [executeRequest]);

  const cancel = useCallback(() => {
    if (requestIdRef.current) {
      requestManager.cancel(requestIdRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (isMountedRef.current) {
      setState(prev => ({ ...prev, loading: false, progress: null }));
      optionsRef.current.onLoading?.(false);
    }
  }, []);

  const retry = useCallback(async (): Promise<T> => {
    if (configRef.current) {
      setState(prev => ({ ...prev, retries: 0 }));
      return executeRequest(configRef.current);
    }
    throw new Error('No request configuration available for retry');
  }, [executeRequest]);

  const refetch = useCallback(async (): Promise<T> => {
    if (configRef.current) {
      return executeRequest(configRef.current);
    }
    throw new Error('No request configuration available for refetch');
  }, [executeRequest]);

  const mutate = useCallback((data: T | ((oldData: T) => T)) => {
    if (isMountedRef.current) {
      setState(prev => ({
        ...prev,
        data: typeof data === 'function' ? (data as (oldData: T) => T)(prev.data as T) : data,
        isStale: false
      }));

      if (configRef.current) {
        const cacheKey = configRef.current.url;
        if (typeof data === 'function') {
          const currentData = cacheManager.get(cacheKey)?.data;
          if (currentData) {
            const newData = (data as (oldData: T) => T)(currentData);
            cacheManager.set(cacheKey, newData);
          }
        } else {
          cacheManager.set(cacheKey, data);
        }
      }
    }
  }, []);

  const checkStaleness = useCallback(() => {
    if (isMountedRef.current) {
      const isStale = calculateStaleness(state.lastFetch);
      setState(prev => ({ ...prev, isStale }));
      isStaleRef.current = isStale;

      if (isStale && optionsRef.current.refetchOnReconnect && networkMonitor.isOnline()) {
        if (configRef.current) {
          executeRequest(configRef.current);
        }
      }
    }
  }, [state.lastFetch, calculateStaleness, executeRequest]);

  // Effect for initial request
  useEffect(() => {
    if (config && options.enabled !== false && options.refetchOnMount !== false) {
      executeRequest(config);
    }

    return () => {
      cancel();
    };
  }, []);

  // Effect for refetch on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (options.refetchOnWindowFocus && isStaleRef.current && configRef.current) {
        executeRequest(configRef.current);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [options.refetchOnWindowFocus, executeRequest]);

  // Effect for network reconnection
  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(() => {
      if (options.refetchOnReconnect && isStaleRef.current && configRef.current) {
        executeRequest(configRef.current);
      }
    });

    return unsubscribe;
  }, [options.refetchOnReconnect, executeRequest]);

  // Effect for staleness checking
  useEffect(() => {
    refetchTimerRef.current = setInterval(checkStaleness, 30000);

    return () => {
      if (refetchTimerRef.current) {
        clearInterval(refetchTimerRef.current);
      }
    };
  }, [checkStaleness]);

  // Effect for cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cancel();
      if (refetchTimerRef.current) {
        clearInterval(refetchTimerRef.current);
      }
    };
  }, [cancel]);

  return {
    data: state.data as T,
    error: state.error,
    loading: state.loading,
    progress: state.progress,
    request,
    cancel,
    retry,
    refetch,
    mutate,
    isStale: state.isStale,
    lastFetch: state.lastFetch
  };
}

export function useBatchRequest<T = any>(
  configs: RequestConfig[] | null,
  options: UseRequestManagerOptions = {}
): UseBatchRequestResult<T> {
  const [results, setResults] = useState<BatchRequestResult | null>(null);
  const [data, setData] = useState<T[] | null>(null);
  const [errors, setErrors] = useState<RequestError[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const executeBatchRequest = useCallback(async (requestConfigs: RequestConfig[]): Promise<T[]> => {
    if (!requestConfigs.length) return [];

    setLoading(true);
    setErrors([]);
    setResults(null);

    try {
      const optimizedConfigs = await requestOptimizer.prioritizeRequests(requestConfigs);
      const batchSize = requestOptimizer.getOptimalBatchSize();

      const batches: RequestConfig[][] = [];
      for (let i = 0; i < optimizedConfigs.length; i += batchSize) {
        batches.push(optimizedConfigs.slice(i, i + batchSize));
      }

      const allResults: T[] = [];
      const allErrors: RequestError[] = [];
      let completed = 0;
      let failed = 0;

      for (const batch of batches) {
        try {
          const batchResults = await Promise.allSettled(
            batch.map(config => requestManager.request(config))
          );

          batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              allResults.push(result.value as T);
              completed++;
            } else {
              allErrors.push(result.reason as RequestError);
              failed++;
            }
          });
        } catch (error) {
          allErrors.push(error as RequestError);
          failed += batch.length;
        }
      }

      const batchResult: BatchRequestResult = {
        data: allResults,
        errors: allErrors,
        completed,
        failed,
        total: requestConfigs.length,
        duration: Date.now() - (results?.duration || 0)
      };

      setResults(batchResult);
      setData(allResults);
      setErrors(allErrors);
      setLoading(false);

      options.onSuccess?.(allResults);

      return allResults;
    } catch (error) {
      const requestError = error as RequestError;
      setErrors([requestError]);
      setLoading(false);
      options.onError?.(requestError);
      throw requestError;
    }
  }, [results?.duration, options]);

  const request = useCallback(async (requestConfigs: RequestConfig[]): Promise<T[]> => {
    return executeBatchRequest(requestConfigs);
  }, [executeBatchRequest]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
  }, []);

  const retry = useCallback(async (): Promise<T[]> => {
    if (configs) {
      return executeBatchRequest(configs);
    }
    throw new Error('No request configurations available for retry');
  }, [configs, executeBatchRequest]);

  useEffect(() => {
    if (configs && options.enabled !== false) {
      executeBatchRequest(configs);
    }

    return () => {
      cancel();
    };
  }, []);

  return {
    data,
    errors,
    loading,
    request,
    cancel,
    retry,
    results
  };
}

export function useLazyRequest<T = any>(
  options: UseRequestManagerOptions = {}
): [UseRequestResult<T>['request'], UseRequestResult<T>] {
  const [triggered, setTriggered] = useState(false);
  const [state, setState] = useState<RequestState>({
    data: null,
    error: null,
    loading: false,
    progress: null,
    lastFetch: null,
    isStale: true,
    retries: 0
  });

  const executeLazyRequest = useCallback(async (config: RequestConfig): Promise<T> => {
    setTriggered(true);
    setState(prev => ({ ...prev, loading: true, error: null }));
    options.onLoading?.(true);

    try {
      const result = await requestManager.request({
        ...config,
        onProgress: (progress: ProgressInfo) => {
          setState(prev => ({ ...prev, progress }));
          options.onProgress?.(progress);
        }
      });

      setState(prev => ({
        ...prev,
        data: result,
        error: null,
        loading: false,
        progress: null,
        lastFetch: Date.now(),
        isStale: false
      }));

      options.onLoading?.(false);
      options.onSuccess?.(result);

      return result;
    } catch (error) {
      const requestError = error as RequestError;
      setState(prev => ({
        ...prev,
        error: requestError,
        loading: false,
        progress: null
      }));

      options.onLoading?.(false);
      options.onError?.(requestError);
      throw requestError;
    }
  }, [options]);

  const cancel = useCallback(() => {
    setState(prev => ({ ...prev, loading: false, progress: null }));
    options.onLoading?.(false);
  }, [options]);

  const retry = useCallback(async (): Promise<T> => {
    throw new Error('Retry not available for lazy requests. Call request again.');
  }, []);

  const refetch = useCallback(async (): Promise<T> => {
    throw new Error('Refetch not available for lazy requests. Call request again.');
  }, []);

  const mutate = useCallback((data: T | ((oldData: T) => T)) => {
    setState(prev => ({
      ...prev,
      data: typeof data === 'function' ? (data as (oldData: T) => T)(prev.data as T) : data,
      isStale: false
    }));
  }, []);

  const requestResult: UseRequestResult<T> = {
    data: state.data as T,
    error: state.error,
    loading: state.loading,
    progress: state.progress,
    request: executeLazyRequest,
    cancel,
    retry,
    refetch,
    mutate,
    isStale: state.isStale,
    lastFetch: state.lastFetch
  };

  return [executeLazyRequest, requestResult];
}

export function useRequestPolling<T = any>(
  config: RequestConfig,
  options: UseRequestManagerOptions & {
    interval: number;
    enabled?: boolean;
  } = { interval: 30000 }
): UseRequestResult<T> {
  const [pollingEnabled, setPollingEnabled] = useState(options.enabled !== false);
  const requestResult = useRequestManager<T>(config, {
    ...options,
    enabled: pollingEnabled
  });

  useEffect(() => {
    if (!pollingEnabled) return;

    const interval = setInterval(() => {
      if (requestResult.isStale) {
        requestResult.refetch();
      }
    }, options.interval);

    return () => clearInterval(interval);
  }, [pollingEnabled, options.interval, requestResult.isStale, requestResult.refetch]);

  const startPolling = useCallback(() => {
    setPollingEnabled(true);
  }, []);

  const stopPolling = useCallback(() => {
    setPollingEnabled(false);
  }, []);

  return {
    ...requestResult,
    startPolling,
    stopPolling
  } as UseRequestResult<T> & { startPolling: () => void; stopPolling: () => void };
}