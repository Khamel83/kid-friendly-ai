import {
  RequestConfig,
  RequestError,
  WebSocketConfig,
  RequestInterceptor,
  RequestManagerConfig
} from '../types/request';
import { requestManager } from './requestManager';
import { networkMonitor } from './networkMonitor';
import { cacheManager } from './cacheManager';

interface ApiClientConfig extends RequestManagerConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    retryCondition?: (error: RequestError) => boolean;
  };
  enableCompression?: boolean;
  enableLogging?: boolean;
  enableWebSocket?: boolean;
}

interface AuthConfig {
  type: 'bearer' | 'basic' | 'custom';
  token?: string;
  username?: string;
  password?: string;
  customHeader?: string;
  refreshEndpoint?: string;
  onRefresh?: () => Promise<string>;
}

interface RateLimitConfig {
  maxRequests: number;
  timeWindow: number;
  retryAfter?: number;
  onRateLimit?: (retryAfter: number) => void;
}

export class ApiClient {
  private config: Required<ApiClientConfig>;
  private authConfig?: AuthConfig;
  private rateLimitConfig?: RateLimitConfig;
  private requestCounts: Map<string, number> = new Map();
  private rateLimitResetTime: Map<string, number> = new Map();
  private webSockets: Map<string, WebSocket> = new Map();
  private interceptors: RequestInterceptor[] = [];
  private defaultHeaders: Record<string, string> = {};

  constructor(config: ApiClientConfig = {}) {
    this.config = this.getDefaultConfig(config);
    this.initialize();
  }

  private getDefaultConfig(config: ApiClientConfig): Required<ApiClientConfig> {
    return {
      baseURL: config.baseURL || '',
      headers: config.headers || {},
      timeout: config.timeout || 30000,
      retryConfig: {
        maxRetries: config.retryConfig?.maxRetries || 3,
        retryDelay: config.retryConfig?.retryDelay || 1000,
        retryCondition: config.retryConfig?.retryCondition
      },
      enableCompression: config.enableCompression || false,
      enableLogging: config.enableLogging || false,
      enableWebSocket: config.enableWebSocket || false,
      baseUrl: config.baseURL || '',
      maxConcurrentRequests: 6,
      cacheConfig: {
        ttl: 5 * 60 * 1000,
        maxSize: 100,
        strategy: 'lru',
        persistent: false
      },
      enableMetrics: true
    };
  }

  private initialize() {
    this.setupDefaultHeaders();
    this.setupGlobalInterceptors();
    this.setupRateLimiting();
  }

  private setupDefaultHeaders() {
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...this.config.headers
    };

    if (this.config.enableCompression) {
      this.defaultHeaders['Accept-Encoding'] = 'gzip, deflate';
    }
  }

  private setupGlobalInterceptors() {
    this.addInterceptor({
      request: async (config) => {
        if (this.config.enableLogging) {
          console.log(`[${config.method}] ${config.url}`, config);
        }
        return this.enrichConfigWithAuth(config);
      },
      response: (response) => {
        if (this.config.enableLogging) {
          console.log('Response:', response);
        }
        return response;
      },
      responseError: (error) => {
        if (this.config.enableLogging) {
          console.error('Response Error:', error);
        }
        return Promise.reject(error);
      }
    });
  }

  private setupRateLimiting() {
    if (this.rateLimitConfig) {
      setInterval(() => {
        this.resetRateLimits();
      }, 60000); // Reset every minute
    }
  }

  private resetRateLimits() {
    const now = Date.now();
    this.rateLimitResetTime.forEach((resetTime, endpoint) => {
      if (now >= resetTime) {
        this.requestCounts.delete(endpoint);
        this.rateLimitResetTime.delete(endpoint);
      }
    });
  }

  private async enrichConfigWithAuth(config: RequestConfig): Promise<RequestConfig> {
    if (!this.authConfig) return config;

    const enrichedConfig = { ...config };

    switch (this.authConfig.type) {
      case 'bearer':
        enrichedConfig.headers = {
          ...enrichedConfig.headers,
          'Authorization': `Bearer ${this.authConfig.token}`
        };
        break;
      case 'basic':
        if (this.authConfig.username && this.authConfig.password) {
          const credentials = btoa(`${this.authConfig.username}:${this.authConfig.password}`);
          enrichedConfig.headers = {
            ...enrichedConfig.headers,
            'Authorization': `Basic ${credentials}`
          };
        }
        break;
      case 'custom':
        if (this.authConfig.customHeader && this.authConfig.token) {
          enrichedConfig.headers = {
            ...enrichedConfig.headers,
            [this.authConfig.customHeader]: this.authConfig.token
          };
        }
        break;
    }

    return enrichedConfig;
  }

  private async checkRateLimit(config: RequestConfig): Promise<void> {
    if (!this.rateLimitConfig) return;

    const endpoint = config.url;
    const now = Date.now();
    const count = this.requestCounts.get(endpoint) || 0;

    if (count >= this.rateLimitConfig.maxRequests) {
      const resetTime = this.rateLimitResetTime.get(endpoint) || now + this.rateLimitConfig.timeWindow;
      const retryAfter = Math.max(0, resetTime - now);

      if (this.rateLimitConfig.onRateLimit) {
        this.rateLimitConfig.onRateLimit(retryAfter);
      }

      throw new Error(`Rate limit exceeded. Retry after ${retryAfter}ms`);
    }

    this.requestCounts.set(endpoint, count + 1);
    this.rateLimitResetTime.set(endpoint, now + this.rateLimitConfig.timeWindow);
  }

  private buildUrl(path: string): string {
    if (this.config.baseURL && !path.startsWith('http')) {
      return `${this.config.baseURL}${path}`;
    }
    return path;
  }

  async get<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, body: data });
  }

  async put<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, body: data });
  }

  async patch<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, body: data });
  }

  async delete<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  async request<T = any>(config: RequestConfig): Promise<T> {
    await this.checkRateLimit(config);

    const fullConfig: RequestConfig = {
      ...config,
      url: this.buildUrl(config.url),
      headers: {
        ...this.defaultHeaders,
        ...config.headers
      },
      timeout: config.timeout || this.config.timeout,
      priority: config.priority || 'normal'
    };

    try {
      return await requestManager.request(fullConfig);
    } catch (error) {
      const requestError = error as RequestError;

      if (requestError.status === 401 && this.authConfig?.refreshEndpoint) {
        try {
          await this.refreshAuthToken();
          return await requestManager.request(fullConfig);
        } catch (refreshError) {
          this.handleAuthError(refreshError);
          throw error;
        }
      }

      throw error;
    }
  }

  private async refreshAuthToken(): Promise<void> {
    if (!this.authConfig?.onRefresh) return;

    try {
      const newToken = await this.authConfig.onRefresh();
      this.authConfig.token = newToken;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  private handleAuthError(error: any): void {
    if (this.config.enableLogging) {
      console.error('Authentication error:', error);
    }
  }

  setAuth(config: AuthConfig): void {
    this.authConfig = config;
  }

  removeAuth(): void {
    this.authConfig = undefined;
  }

  setRateLimit(config: RateLimitConfig): void {
    this.rateLimitConfig = config;
  }

  removeRateLimit(): void {
    this.rateLimitConfig = undefined;
    this.requestCounts.clear();
    this.rateLimitResetTime.clear();
  }

  setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  addInterceptor(interceptor: RequestInterceptor): void {
    this.interceptors.push(interceptor);
    requestManager.addInterceptor(interceptor);
  }

  removeInterceptor(interceptor: RequestInterceptor): void {
    const index = this.interceptors.indexOf(interceptor);
    if (index > -1) {
      this.interceptors.splice(index, 1);
      requestManager.removeInterceptor(interceptor);
    }
  }

  createWebSocket(config: WebSocketConfig): WebSocket {
    if (!this.config.enableWebSocket) {
      throw new Error('WebSocket support is not enabled');
    }

    const ws = new WebSocket(config.url, config.protocols);

    ws.onopen = (event) => {
      if (config.onOpen) {
        config.onOpen(event);
      }
    };

    ws.onmessage = (event) => {
      if (config.onMessage) {
        try {
          const data = JSON.parse(event.data);
          config.onMessage(data);
        } catch {
          config.onMessage(event.data);
        }
      }
    };

    ws.onclose = (event) => {
      if (config.onClose) {
        config.onClose(event);
      }
    };

    ws.onerror = (event) => {
      if (config.onError) {
        config.onError(event);
      }
    };

    this.webSockets.set(config.url, ws);
    return ws;
  }

  closeWebSocket(url: string): void {
    const ws = this.webSockets.get(url);
    if (ws) {
      ws.close();
      this.webSockets.delete(url);
    }
  }

  closeAllWebSockets(): void {
    this.webSockets.forEach((ws) => {
      ws.close();
    });
    this.webSockets.clear();
  }

  upload(file: File, url: string, options?: {
    onProgress?: (progress: number) => void;
    onUploadProgress?: (progress: number) => void;
    metadata?: Record<string, string>;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      if (options?.metadata) {
        Object.entries(options.metadata).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      const xhr = new XMLHttpRequest();

      if (options?.onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            options.onProgress!(progress);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Upload failed due to network error'));
      };

      xhr.open('POST', this.buildUrl(url));

      if (this.authConfig) {
        this.enrichConfigWithAuth({ url, method: 'POST' })
          .then(config => {
            Object.entries(config.headers || {}).forEach(([key, value]) => {
              xhr.setRequestHeader(key, value);
            });
          })
          .catch(reject);
      }

      xhr.send(formData);
    });
  }

  download(url: string, filename?: string, options?: {
    onProgress?: (progress: number) => void;
    method?: 'GET' | 'POST';
    body?: any;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';

      if (options?.onProgress) {
        xhr.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            options.onProgress!(progress);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const blob = xhr.response;
          const downloadUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename || 'download';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(downloadUrl);
          resolve();
        } else {
          reject(new Error(`Download failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Download failed due to network error'));
      };

      xhr.open(options?.method || 'GET', this.buildUrl(url));

      if (this.authConfig) {
        this.enrichConfigWithAuth({ url, method: options?.method || 'GET' })
          .then(config => {
            Object.entries(config.headers || {}).forEach(([key, value]) => {
              xhr.setRequestHeader(key, value);
            });
          })
          .catch(reject);
      }

      if (options?.body) {
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(options.body));
      } else {
        xhr.send();
      }
    });
  }

  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: any;
    networkInfo: any;
    cacheMetrics: any;
  } {
    const networkInfo = networkMonitor.getCurrentInfo();
    const cacheMetrics = cacheManager.getMetrics();
    const metrics = requestManager.getMetrics();

    const status = this.calculateHealthStatus(networkInfo, metrics, cacheMetrics);

    return {
      status,
      metrics,
      networkInfo,
      cacheMetrics
    };
  }

  private calculateHealthStatus(networkInfo: any, metrics: any, cacheMetrics: any): 'healthy' | 'degraded' | 'unhealthy' {
    if (!networkInfo.online) return 'unhealthy';
    if (networkInfo.quality === 'poor') return 'degraded';
    if (metrics.successRate < 0.8) return 'degraded';
    if (metrics.averageResponseTime > 10000) return 'degraded';
    return 'healthy';
  }

  destroy(): void {
    this.closeAllWebSockets();
    this.removeRateLimit();
    this.interceptors.forEach(interceptor => {
      requestManager.removeInterceptor(interceptor);
    });
    this.interceptors = [];
  }
}

export const apiClient = new ApiClient({
  baseURL: '/api',
  timeout: 30000,
  enableCompression: true,
  enableWebSocket: true,
  enableLogging: false
});

export const createApiClient = (config: ApiClientConfig): ApiClient => {
  return new ApiClient(config);
};

export default apiClient;