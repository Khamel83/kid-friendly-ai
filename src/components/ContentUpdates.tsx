/**
 * Content Updates Interface Component
 * Provides a comprehensive UI for managing content updates, notifications, and preferences
 */

import React, { useState, useEffect } from 'react';
import {
  useContentUpdates,
  useSystemHealth,
  useContentAnalytics,
} from '../hooks/useContentManager';

import {
  ContentUpdate,
  UpdateStatus,
  UpdatePriority,
  ContentAnalytics,
  AnalyticsPeriod,
} from '../types/content';

interface ContentUpdatesProps {
  className?: string;
  autoCheck?: boolean;
  showNotifications?: boolean;
  showStats?: boolean;
  compact?: boolean;
}

const ContentUpdates: React.FC<ContentUpdatesProps> = ({
  className = '',
  autoCheck = true,
  showNotifications = true,
  showStats = true,
  compact = false,
}) => {
  const {
    updates,
    progress,
    notifications,
    stats,
    loading,
    error,
    actions: {
      checkForUpdates,
      downloadUpdate,
      installUpdate,
      rollbackUpdate,
      dismissNotification,
      refreshStats,
    },
  } = useContentUpdates({ autoCheck });

  const { health, checkHealth } = useSystemHealth();
  const { analytics } = useContentAnalytics(undefined, { realTime: true });

  const [selectedUpdate, setSelectedUpdate] = useState<ContentUpdate | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [updatePreferences, setUpdatePreferences] = useState({
    autoCheck: true,
    autoDownload: false,
    autoInstall: false,
    notifyOnComplete: true,
    bandwidthLimit: 1024 * 1024, // 1MB/s
    checkInterval: 60, // minutes
  });

  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('daily');

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const handleDownloadUpdate = async (updateId: string) => {
    try {
      await downloadUpdate(updateId);
    } catch (error) {
      console.error('Failed to download update:', error);
    }
  };

  const handleInstallUpdate = async (updateId: string) => {
    try {
      await installUpdate(updateId);
    } catch (error) {
      console.error('Failed to install update:', error);
    }
  };

  const handleRollbackUpdate = async (contentId: string) => {
    try {
      await rollbackUpdate(contentId);
    } catch (error) {
      console.error('Failed to rollback update:', error);
    }
  };

  const handleDismissNotification = (notificationId: string) => {
    dismissNotification(notificationId);
  };

  const getPriorityColor = (priority: UpdatePriority) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: UpdateStatus) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'downloading':
        return '⬇️';
      case 'installing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'rolled-back':
        return '↩️';
      default:
        return '❓';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (compact) {
    return (
      <div className={`content-updates-compact ${className}`}>
        <div className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm">
          <div className="flex items-center space-x-2">
            <button
              onClick={checkForUpdates}
              disabled={loading}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
              title="Check for updates"
            >
              🔄
            </button>
            <span className="text-sm text-gray-600">
              {updates.filter(u => u.status === 'pending').length} updates available
            </span>
          </div>
          {notifications.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 text-gray-600 hover:bg-gray-50 rounded"
              >
                🔔
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {notifications.length}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`content-updates ${className}`}>
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Content Updates</h2>
              <p className="text-gray-600">Manage content updates and preferences</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={checkForUpdates}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Check for Updates'}
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                ⚙️
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                📊
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {showNotifications && notifications.length > 0 && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Notifications</h3>
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    notification.type === 'error' ? 'border-red-400 bg-red-50' :
                    notification.type === 'warning' ? 'border-yellow-400 bg-yellow-50' :
                    notification.type === 'success' ? 'border-green-400 bg-green-50' :
                    'border-blue-400 bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{notification.title}</h4>
                      <p className="text-sm text-gray-600">{notification.message}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        {notification.timestamp.toLocaleTimeString()}
                      </span>
                      <button
                        onClick={() => handleDismissNotification(notification.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {notification.actions && (
                    <div className="mt-2 flex space-x-2">
                      {notification.actions.map((action, index) => (
                        <button
                          key={index}
                          onClick={action.action}
                          className={`px-3 py-1 text-sm rounded ${
                            action.primary
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Updates */}
        {progress.length > 0 && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Updates</h3>
            <div className="space-y-3">
              {progress.map((updateProgress) => (
                <div key={updateProgress.updateId} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {getStatusIcon(updateProgress.stage)} {updateProgress.stage}
                    </span>
                    <span className="text-sm text-gray-600">
                      {updateProgress.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${updateProgress.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{formatFileSize(updateProgress.speed * updateProgress.progress / 100)} / {formatFileSize(updateProgress.speed * 100 / 100)}</span>
                    <span>{formatTime(updateProgress.estimatedTimeRemaining)} remaining</span>
                  </div>
                  {updateProgress.error && (
                    <div className="mt-2 text-sm text-red-600">
                      Error: {updateProgress.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Updates */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Available Updates</h3>
            <span className="text-sm text-gray-600">
              {updates.filter(u => u.status === 'pending').length} pending
            </span>
          </div>

          {updates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">✅</div>
              <p>No updates available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {updates.map((update) => (
                <div
                  key={update.id}
                  className={`p-4 rounded-lg border ${
                    selectedUpdate?.id === update.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedUpdate(update)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(update.priority)}`}>
                          {update.priority}
                        </span>
                        <span className="text-sm text-gray-500">
                          {getStatusIcon(update.status)} {update.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          v{update.version}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900">{update.description}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Size: {formatFileSize(update.size)} • {update.changes.length} changes
                      </p>
                      {update.appliedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Applied: {update.appliedAt.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {update.status === 'pending' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadUpdate(update.id);
                            }}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Download
                          </button>
                          {update.isRequired && (
                            <span className="text-xs text-red-600 font-medium">Required</span>
                          )}
                        </>
                      )}
                      {update.status === 'completed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRollbackUpdate(update.contentId);
                          }}
                          className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          Rollback
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Statistics */}
        {showStats && stats && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.totalUpdates}</div>
                <div className="text-sm text-gray-600">Total Updates</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.successfulUpdates}</div>
                <div className="text-sm text-gray-600">Successful</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.failedUpdates}</div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.pendingUpdates}</div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-lg font-semibold text-gray-700">
                  {formatTime(stats.averageUpdateTime / 1000)}
                </div>
                <div className="text-sm text-gray-600">Average Update Time</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-lg font-semibold text-gray-700">
                  {formatFileSize(stats.totalBandwidthUsed)}
                </div>
                <div className="text-sm text-gray-600">Total Bandwidth Used</div>
              </div>
            </div>
          </div>
        )}

        {/* System Health */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Storage</span>
                <span className={`text-sm ${
                  health?.components.storage === 'healthy' ? 'text-green-600' :
                  health?.components.storage === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {health?.components.storage || 'Unknown'}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Cache</span>
                <span className={`text-sm ${
                  health?.components.cache === 'healthy' ? 'text-green-600' :
                  health?.components.cache === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {health?.components.cache || 'Unknown'}
                </span>
              </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Distribution</span>
                <span className={`text-sm ${
                  health?.components.distribution?.overall === 'healthy' ? 'text-green-600' :
                  health?.components.distribution?.overall === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {health?.components.distribution?.overall || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Automatically check for updates</label>
                <input
                  type="checkbox"
                  checked={updatePreferences.autoCheck}
                  onChange={(e) => setUpdatePreferences(prev => ({ ...prev, autoCheck: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Automatically download updates</label>
                <input
                  type="checkbox"
                  checked={updatePreferences.autoDownload}
                  onChange={(e) => setUpdatePreferences(prev => ({ ...prev, autoDownload: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Automatically install updates</label>
                <input
                  type="checkbox"
                  checked={updatePreferences.autoInstall}
                  onChange={(e) => setUpdatePreferences(prev => ({ ...prev, autoInstall: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Notify on completion</label>
                <input
                  type="checkbox"
                  checked={updatePreferences.notifyOnComplete}
                  onChange={(e) => setUpdatePreferences(prev => ({ ...prev, notifyOnComplete: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check Interval (minutes)
                  </label>
                  <input
                    type="number"
                    value={updatePreferences.checkInterval}
                    onChange={(e) => setUpdatePreferences(prev => ({ ...prev, checkInterval: parseInt(e.target.value) }))}
                    className="w-full rounded border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    min="1"
                    max="1440"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bandwidth Limit (MB/s)
                  </label>
                  <input
                    type="number"
                    value={updatePreferences.bandwidthLimit / (1024 * 1024)}
                    onChange={(e) => setUpdatePreferences(prev => ({ ...prev, bandwidthLimit: parseInt(e.target.value) * 1024 * 1024 }))}
                    className="w-full rounded border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    min="0.1"
                    max="100"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Update Details Modal */}
        {selectedUpdate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Update Details</h3>
                  <button
                    onClick={() => setSelectedUpdate(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">Version {selectedUpdate.version}</h4>
                    <p className="text-gray-600">{selectedUpdate.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Type:</span>
                      <span className="ml-2 text-sm text-gray-600">{selectedUpdate.type}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Priority:</span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getPriorityColor(selectedUpdate.priority)}`}>
                        {selectedUpdate.priority}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Size:</span>
                      <span className="ml-2 text-sm text-gray-600">{formatFileSize(selectedUpdate.size)}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Status:</span>
                      <span className="ml-2 text-sm text-gray-600">{selectedUpdate.status}</span>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">Changes:</h5>
                    <div className="space-y-2">
                      {selectedUpdate.changes.map((change, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <span className="text-sm text-gray-500">{change.type}:</span>
                          <span className="text-sm text-gray-700">{change.description}</span>
                          <span className="text-xs text-gray-500">({change.impact} impact)</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex space-x-2">
                      {selectedUpdate.status === 'pending' && (
                        <>
                          <button
                            onClick={() => {
                              handleDownloadUpdate(selectedUpdate.id);
                              setSelectedUpdate(null);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Download Update
                          </button>
                          {selectedUpdate.isRequired && (
                            <span className="text-sm text-red-600">This update is required</span>
                          )}
                        </>
                      )}
                      {selectedUpdate.status === 'completed' && (
                        <button
                          onClick={() => {
                            handleRollbackUpdate(selectedUpdate.contentId);
                            setSelectedUpdate(null);
                          }}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                          Rollback
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedUpdate(null)}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentUpdates;