import React, { useState, useEffect } from 'react';
import {
  RequestQueueItem,
  ProgressInfo,
  NetworkInfo,
  PerformanceMetrics,
  CacheMetrics
} from '../types/request';
import { requestManager } from '../utils/requestManager';
import { networkMonitor } from '../utils/networkMonitor';
import { cacheManager } from '../utils/cacheManager';
import { requestOptimizer } from '../utils/requestOptimizer';

interface RequestIndicatorProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  showNetworkStatus?: boolean;
  showCacheStatus?: boolean;
  showQueueStatus?: boolean;
  showPerformanceMetrics?: boolean;
  compact?: boolean;
  theme?: 'light' | 'dark';
}

interface RequestStatusItem {
  id: string;
  url: string;
  method: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: ProgressInfo | null;
  priority: string;
  timestamp: number;
  error?: string;
}

const RequestIndicator: React.FC<RequestIndicatorProps> = ({
  position = 'top-right',
  showNetworkStatus = true,
  showCacheStatus = true,
  showQueueStatus = true,
  showPerformanceMetrics = false,
  compact = false,
  theme = 'light'
}) => {
  const [activeRequests, setActiveRequests] = useState<RequestStatusItem[]>([]);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [queueStatus, setQueueStatus] = useState({
    active: 0,
    pending: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribeRequestManager = requestManager.subscribe((item: RequestQueueItem) => {
      updateActiveRequests(item);
    });

    const unsubscribeNetworkMonitor = networkMonitor.subscribe((info: NetworkInfo) => {
      setNetworkInfo(info);
    });

    const unsubscribeCacheManager = cacheManager.subscribe(() => {
      setCacheMetrics(cacheManager.getMetrics());
    });

    const updateMetrics = () => {
      setPerformanceMetrics(requestManager.getMetrics());
      setQueueStatus(requestManager.getQueueStatus());
    };

    const metricsInterval = setInterval(updateMetrics, 1000);

    updateMetrics();
    setNetworkInfo(networkMonitor.getCurrentInfo());
    setCacheMetrics(cacheManager.getMetrics());

    return () => {
      unsubscribeRequestManager();
      unsubscribeNetworkMonitor();
      unsubscribeCacheManager();
      clearInterval(metricsInterval);
    };
  }, []);

  const updateActiveRequests = (item: RequestQueueItem) => {
    setActiveRequests(prev => {
      const existingIndex = prev.findIndex(r => r.id === item.config.id);
      const newItem: RequestStatusItem = {
        id: item.config.id,
        url: item.config.url,
        method: item.config.method,
        status: item.status,
        progress: null,
        priority: item.config.priority || 'normal',
        timestamp: item.timestamp,
        error: item.error?.message
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newItem;
        return updated;
      }

      return [...prev, newItem];
    });
  };

  const getPositionClasses = () => {
    const baseClasses = 'fixed z-50 p-4 rounded-lg shadow-lg transition-all duration-300';
    const positionClasses = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4'
    };

    const themeClasses = theme === 'dark'
      ? 'bg-gray-800 text-white border-gray-700'
      : 'bg-white text-gray-800 border-gray-200';

    return `${baseClasses} ${positionClasses[position]} ${themeClasses} border`;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500',
      running: 'bg-blue-500',
      completed: 'bg-green-500',
      failed: 'bg-red-500',
      cancelled: 'bg-gray-500'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getNetworkQualityColor = (quality: string) => {
    const colors = {
      excellent: 'bg-green-500',
      good: 'bg-green-400',
      fair: 'bg-yellow-500',
      poor: 'bg-orange-500',
      disconnected: 'bg-red-500'
    };
    return colors[quality as keyof typeof colors] || 'bg-gray-500';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 1000) return 'now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  const totalActiveRequests = queueStatus.active + queueStatus.pending;
  const hasFailedRequests = queueStatus.failed > 0;

  if (compact && totalActiveRequests === 0) {
    return null;
  }

  return (
    <div className={getPositionClasses()}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {totalActiveRequests > 0 && (
            <div className="flex items-center space-x-1">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-sm font-medium">
                {totalActiveRequests} {totalActiveRequests === 1 ? 'request' : 'requests'}
              </span>
            </div>
          )}

          {hasFailedRequests && (
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-red-500">
                {queueStatus.failed} failed
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {showNetworkStatus && networkInfo && (
            <div className="flex items-center space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${getNetworkQualityColor(networkInfo.quality)}`}
                title={`Network: ${networkInfo.quality}`}
              ></div>
              <span className="text-xs text-gray-500">
                {networkInfo.online ? 'Online' : 'Offline'}
              </span>
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {/* Queue Status */}
          {showQueueStatus && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span>Active:</span>
                <span className="font-medium">{queueStatus.active}</span>
              </div>
              <div className="flex justify-between">
                <span>Pending:</span>
                <span className="font-medium">{queueStatus.pending}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed:</span>
                <span className="font-medium text-green-500">{queueStatus.completed}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed:</span>
                <span className="font-medium text-red-500">{queueStatus.failed}</span>
              </div>
            </div>
          )}

          {/* Network Status */}
          {showNetworkStatus && networkInfo && (
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Connection:</span>
                <span className="font-medium capitalize">{networkInfo.connectionType}</span>
              </div>
              <div className="flex justify-between">
                <span>Quality:</span>
                <span className="font-medium capitalize">{networkInfo.quality}</span>
              </div>
              <div className="flex justify-between">
                <span>Speed:</span>
                <span className="font-medium">{networkInfo.downlink} Mbps</span>
              </div>
              <div className="flex justify-between">
                <span>Latency:</span>
                <span className="font-medium">{networkInfo.rtt}ms</span>
              </div>
            </div>
          )}

          {/* Cache Status */}
          {showCacheStatus && cacheMetrics && (
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Cache Hit Rate:</span>
                <span className="font-medium">{(cacheMetrics.hitRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Cache Size:</span>
                <span className="font-medium">{cacheMetrics.itemCount} items</span>
              </div>
              <div className="flex justify-between">
                <span>Memory:</span>
                <span className="font-medium">{formatBytes(cacheMetrics.size)}</span>
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          {showPerformanceMetrics && performanceMetrics && (
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Success Rate:</span>
                <span className="font-medium">{(performanceMetrics.successRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Response:</span>
                <span className="font-medium">{performanceMetrics.averageResponseTime.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Total Requests:</span>
                <span className="font-medium">{performanceMetrics.requestCount}</span>
              </div>
            </div>
          )}

          {/* Active Requests */}
          {activeRequests.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Active Requests</h4>
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-blue-500 hover:text-blue-700"
                >
                  {showDetails ? 'Hide' : 'Show'} Details
                </button>
              </div>

              <div className="space-y-1 max-h-40 overflow-y-auto">
                {activeRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="flex items-center justify-between text-xs p-2 rounded bg-gray-50">
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 rounded-full ${getStatusColor(request.status)}`}
                        title={request.status}
                      ></div>
                      <span className="font-medium">{request.method}</span>
                      <span className="truncate max-w-32">{request.url}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-500">{formatTime(request.timestamp)}</span>
                      {request.error && (
                        <span className="text-red-500" title={request.error}>!</span>
                      )}
                    </div>
                  </div>
                ))}
                {activeRequests.length > 5 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{activeRequests.length - 5} more requests
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => requestManager.cancelAll()}
              className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              title="Cancel all requests"
            >
              Cancel All
            </button>
            <button
              onClick={() => cacheManager.clear()}
              className="text-xs px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
              title="Clear cache"
            >
              Clear Cache
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestIndicator;

// Hook for easy integration
export const useRequestIndicator = (props: RequestIndicatorProps = {}) => {
  return {
    RequestIndicator: () => <RequestIndicator {...props} />
  };
};