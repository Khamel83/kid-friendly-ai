export interface RequestConfig {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  priority?: RequestPriority;
  cachePolicy?: CachePolicy;
  transformRequest?: (data: any) => any;
  transformResponse?: (data: any) => any;
  onProgress?: (progress: ProgressInfo) => void;
  onSuccess?: (response: any) => void;
  onError?: (error: RequestError) => void;
  onFinally?: () => void;
  metadata?: Record<string, any>;
}

export interface RequestQueueItem {
  config: RequestConfig;
  timestamp: number;
  attempt: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  abortController?: AbortController;
  result?: any;
  error?: RequestError;
}

export interface RequestError {
  message: string;
  code: string;
  status?: number;
  url?: string;
  timestamp: number;
  retryable: boolean;
  cause?: Error;
  details?: Record<string, any>;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  strategy: CacheStrategy;
  persistent: boolean;
  keyGenerator?: (config: RequestConfig) => string;
}

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
  metadata?: Record<string, any>;
}

export interface NetworkInfo {
  online: boolean;
  effectiveType: NetInfoEffectiveType;
  downlink: number;
  rtt: number;
  saveData: boolean;
  connectionType: ConnectionType;
  reliability: number;
  quality: NetworkQuality;
}

export interface PerformanceMetrics {
  requestCount: number;
  successRate: number;
  averageResponseTime: number;
  cacheHitRate: number;
  totalBytes: number;
  errorCount: number;
  retryCount: number;
  bandwidth: number;
}

export interface ProgressInfo {
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  timeRemaining: number;
}

export interface RequestStats {
  startTime: number;
  endTime?: number;
  duration?: number;
  bytesSent: number;
  bytesReceived: number;
  retries: number;
  cacheHit: boolean;
  fromCache: boolean;
  priority: RequestPriority;
}

export type RequestPriority = 'low' | 'normal' | 'high' | 'critical';
export type CachePolicy = 'default' | 'no-store' | 'no-cache' | 'reload' | 'force-cache' | 'only-if-cached';
export type CacheStrategy = 'lru' | 'lfu' | 'fifo' | 'priority';
export type NetInfoEffectiveType = '2g' | '3g' | '4g' | 'slow-2g';
export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'wimax' | 'unknown' | 'none';
export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition: (error: RequestError) => boolean;
}

export interface RequestInterceptor {
  request?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  requestError?: (error: any) => any;
  response?: (response: any) => any | Promise<any>;
  responseError?: (error: any) => any;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number;
  key?: string;
  combineFunction?: (requests: RequestConfig[]) => RequestConfig;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  onMessage?: (data: any) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  size: number;
  itemCount: number;
  hitRate: number;
  evictionCount: number;
  cleanupCount: number;
}

export interface NetworkMetrics {
  connectionChanges: number;
  offlineTime: number;
  onlineTime: number;
  averageLatency: number;
  packetLoss: number;
  bandwidthUsage: number;
}

export interface RequestManagerConfig {
  baseUrl?: string;
  timeout?: number;
  maxConcurrentRequests?: number;
  retryConfig?: Partial<RetryConfig>;
  cacheConfig?: Partial<CacheConfig>;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  enableCompression?: boolean;
  interceptors?: RequestInterceptor[];
}

export interface UseRequestManagerOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: RequestError) => void;
  onLoading?: (loading: boolean) => void;
  onProgress?: (progress: ProgressInfo) => void;
  retryCondition?: (error: RequestError) => boolean;
  enabled?: boolean;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  cachePolicy?: CachePolicy;
  staleTime?: number;
}

export interface RequestState {
  data: any;
  error: RequestError | null;
  loading: boolean;
  progress: ProgressInfo | null;
  lastFetch: number | null;
  isStale: boolean;
  retries: number;
}

export interface BatchRequestResult {
  data: any[];
  errors: RequestError[];
  completed: number;
  failed: number;
  total: number;
  duration: number;
}