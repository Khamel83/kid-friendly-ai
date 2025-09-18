/**
 * Offline status indicator component for the kid-friendly-ai project
 * Provides visual feedback for offline/online status with sync controls and user guidance
 */

import React, { useState, useEffect } from 'react';
import type { OfflineIndicatorProps, ConnectionQuality } from '../types/offline';
import { useOfflineManager } from '../hooks/useOfflineManager';
// CSS import moved to _app.tsx

interface SyncStatus {
  isSyncing: boolean;
  progress: number;
  pendingOperations: number;
  lastSyncTime: Date | null;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'top-right',
  showSyncButton = true,
  showStats = false,
  compact = false,
  className = '',
  onSync,
  onSettings
}) => {
  const {
    state,
    syncNow,
    isSyncing,
    syncProgress,
    pendingOperations,
    diagnostics
  } = useOfflineManager();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    progress: 0,
    pendingOperations: 0,
    lastSyncTime: null
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    setSyncStatus({
      isSyncing,
      progress: syncProgress,
      pendingOperations,
      lastSyncTime: diagnostics.lastSync
    });
  }, [isSyncing, syncProgress, pendingOperations, diagnostics.lastSync]);

  const handleSync = async () => {
    try {
      if (onSync) {
        await onSync();
      } else {
        await syncNow();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const getStatusColor = () => {
    if (!state.isOnline) return 'bg-red-500';
    if (syncStatus.isSyncing) return 'bg-blue-500';
    if (syncStatus.pendingOperations > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = () => {
    if (!state.isOnline) return '📵';
    if (syncStatus.isSyncing) return '🔄';
    if (syncStatus.pendingOperations > 0) return '⏳';
    return '✅';
  };

  const getStatusText = () => {
    if (!state.isOnline) return 'Offline';
    if (syncStatus.isSyncing) return 'Syncing...';
    if (syncStatus.pendingOperations > 0) return `${syncStatus.pendingOperations} pending`;
    return 'Online';
  };

  const getConnectionQualityIcon = () => {
    switch (state.connectionQuality) {
      case 'excellent': return '📶';
      case 'good': return '📡';
      case 'fair': return '📡';
      case 'poor': return '📶';
      case 'offline': return '📵';
      default: return '❓';
    }
  };

  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      default:
        return 'top-4 right-4';
    }
  };

  if (compact) {
    return (
      <div className={`fixed ${getPositionClasses()} z-50 ${className}`}>
        <div className={`flex items-center space-x-2 p-2 rounded-lg shadow-lg ${getStatusColor()} text-white`}>
          <span className="text-lg">{getStatusIcon()}</span>
          <span className="text-sm font-medium">{getStatusText()}</span>
          {showSyncButton && state.isOnline && (
            <button
              onClick={handleSync}
              disabled={syncStatus.isSyncing}
              className="p-1 rounded hover:bg-white hover:bg-opacity-20 disabled:opacity-50"
              aria-label="Sync now"
            >
              {syncStatus.isSyncing ? '🔄' : '🔄'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed ${getPositionClasses()} z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        {/* Main Status Bar */}
        <div
          className={`flex items-center justify-between p-3 cursor-pointer ${getStatusColor()} text-white`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-2">
            <span className="text-lg">{getStatusIcon()}</span>
            <div>
              <div className="font-medium">{getStatusText()}</div>
              {state.isOnline && (
                <div className="text-xs opacity-90">
                  {getConnectionQualityIcon()} {state.connectionQuality}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {showSyncButton && state.isOnline && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSync();
                }}
                disabled={syncStatus.isSyncing}
                className="p-1 rounded hover:bg-white hover:bg-opacity-20 disabled:opacity-50"
                aria-label="Sync now"
              >
                {syncStatus.isSyncing ? (
                  <span className="animate-spin">🔄</span>
                ) : (
                  '🔄'
                )}
              </button>
            )}

            {onSettings && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSettings();
                }}
                className="p-1 rounded hover:bg-white hover:bg-opacity-20"
                aria-label="Settings"
              >
                ⚙️
              </button>
            )}

            <span className="text-sm">{isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="p-3 bg-gray-50 border-t border-gray-200">
            {/* Sync Progress */}
            {syncStatus.isSyncing && (
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>Sync Progress</span>
                  <span>{syncStatus.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${syncStatus.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-600">Pending</div>
                <div className="text-lg font-bold text-yellow-600">
                  {syncStatus.pendingOperations}
                </div>
              </div>
              <div className="bg-white p-2 rounded border">
                <div className="font-medium text-gray-600">Last Sync</div>
                <div className="text-sm font-medium text-gray-800">
                  {formatTimeAgo(syncStatus.lastSyncTime)}
                </div>
              </div>
            </div>

            {/* Detailed Stats */}
            {showStats && diagnostics.queueStats && (
              <div className="mb-3">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800 mb-2"
                >
                  <span>{showDetails ? 'Hide' : 'Show'} Details</span>
                  <span>{showDetails ? '▲' : '▼'}</span>
                </button>

                {showDetails && (
                  <div className="bg-white p-3 rounded border text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Total Operations:</span>
                      <span className="font-medium">{diagnostics.queueStats.totalOperations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processing:</span>
                      <span className="font-medium">{diagnostics.queueStats.processingOperations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed:</span>
                      <span className="font-medium text-green-600">
                        {diagnostics.queueStats.completedOperations}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <span className="font-medium text-red-600">
                        {diagnostics.queueStats.failedOperations}
                      </span>
                    </div>
                    {diagnostics.storageInfo && (
                      <>
                        <div className="border-t pt-1 mt-1">
                          <div className="flex justify-between">
                            <span>Storage Used:</span>
                            <span className="font-medium">
                              {Math.round(diagnostics.storageInfo.usage)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                            <div
                              className="bg-green-500 h-1 rounded-full"
                              style={{ width: `${Math.min(diagnostics.storageInfo.usage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-2">
              {state.isOnline && syncStatus.pendingOperations > 0 && (
                <button
                  onClick={handleSync}
                  disabled={syncStatus.isSyncing}
                  className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              )}

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-100"
              >
                {showDetails ? 'Hide' : 'Details'}
              </button>
            </div>

            {/* Offline Tips */}
            {!state.isOnline && (
              <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                <div className="font-medium mb-1">💡 Offline Mode</div>
                <ul className="space-y-1">
                  <li>• Continue using the app normally</li>
                  <li>• Your data will sync when online</li>
                  <li>• Check your internet connection</li>
                </ul>
              </div>
            )}

            {/* Network Quality Info */}
            {state.isOnline && state.connectionQuality !== 'excellent' && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <div className="font-medium mb-1">📡 Network Quality</div>
                <div>
                  {state.connectionQuality === 'good' && 'Good connection quality'}
                  {state.connectionQuality === 'fair' && 'Fair connection, some features may be slower'}
                  {state.connectionQuality === 'poor' && 'Poor connection, limited functionality'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;

// Preset components for common use cases
export const SimpleOfflineIndicator: React.FC<{
  className?: string;
}> = ({ className }) => (
  <OfflineIndicator
    compact={true}
    showStats={false}
    className={className}
  />
);

export const DetailedOfflineIndicator: React.FC<{
  className?: string;
  onSettings?: () => void;
}> = ({ className, onSettings }) => (
  <OfflineIndicator
    compact={false}
    showStats={true}
    showSyncButton={true}
    onSettings={onSettings}
    className={className}
  />
);

export const MinimalOfflineIndicator: React.FC<{
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}> = ({ position = 'bottom-right', className }) => (
  <OfflineIndicator
    compact={true}
    position={position}
    showStats={false}
    className={className}
  />
);