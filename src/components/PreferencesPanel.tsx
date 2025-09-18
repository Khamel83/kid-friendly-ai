/**
 * Main Preferences Panel for Kid-Friendly AI
 * Provides comprehensive preference management interface with search, categories, and advanced features
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  PreferencePanelProps,
  PreferenceCategory,
  PreferencePreset,
  PreferenceBackup,
  PreferenceNotification,
  PreferenceSearchResult
} from '../types/preferences';
import { usePreferences } from '../hooks/usePreferences';
import { PreferenceControls } from './PreferenceControls';
import { PreferenceDefaults } from '../utils/preferenceDefaults';
import { ErrorHandler } from '../utils/errorHandler';

export const PreferencesPanel: React.FC<PreferencePanelProps> = ({
  userId,
  showHeader = true,
  showSearch = true,
  showCategories = true,
  showFavorites = true,
  showRecent = true,
  compact = false,
  theme = 'auto',
  onPreferenceChange,
  onCategoryChange,
  onSearch,
  className = ''
}) => {
  const {
    preferences,
    isLoading,
    isSaving,
    error,
    searchResults,
    history,
    backups,
    notifications,
    syncState,
    uiState,
    getPreference,
    setPreference,
    resetPreference,
    resetAllPreferences,
    exportPreferences,
    importPreferences,
    searchPreferences,
    getPreferencesByCategory,
    validatePreference,
    addFavorite,
    removeFavorite,
    getFavorites,
    undoChange,
    redoChange,
    syncPreferences,
    createBackup,
    restoreBackup,
    deleteBackup,
    markNotificationAsRead,
    dismissNotification,
    clearAllNotifications,
    toggleCategory,
    selectCategory,
    setSearchQuery,
    refreshPreferences,
    clearMessages
  } = usePreferences();

  const [activeTab, setActiveTab] = useState<'browse' | 'search' | 'favorites' | 'history' | 'sync' | 'backup'>('browse');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [importData, setImportData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = PreferenceDefaults.getCategories();
  const presets = PreferenceDefaults.getPresets();
  const favorites = getFavorites();

  // Filter preferences based on current tab and search
  const getFilteredPreferences = () => {
    if (activeTab === 'search' && searchResults) {
      return searchResults.preferences;
    }

    if (activeTab === 'favorites') {
      return PreferenceDefaults.getAllPreferences().filter(pref => favorites.includes(pref.key));
    }

    if (activeTab === 'browse' && uiState.selectedCategory) {
      return getPreferencesByCategory(uiState.selectedCategory);
    }

    return PreferenceDefaults.getAllPreferences();
  };

  const filteredPreferences = getFilteredPreferences();

  // Handle preference change
  const handlePreferenceChange = async (key: string, value: any) => {
    try {
      await setPreference(key, value);
      onPreferenceChange?.(key, value);
    } catch (err) {
      ErrorHandler.getInstance().handleError(err as Error, 'PREF_CHANGE_ERROR');
    }
  };

  // Handle category selection
  const handleCategorySelect = (categoryId: string) => {
    selectCategory(categoryId);
    onCategoryChange?.(categoryId);
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      searchPreferences(query);
      setActiveTab('search');
    }
    onSearch?.(query);
  };

  // Handle preset application
  const handleApplyPreset = async (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    try {
      for (const [key, value] of Object.entries(preset.preferences)) {
        await setPreference(key, value);
      }
      setSelectedPreset(presetId);
    } catch (err) {
      ErrorHandler.getInstance().handleError(err as Error, 'PRESET_APPLY_ERROR');
    }
  };

  // Handle file import
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        await importPreferences(content);
        setShowImportDialog(false);
        setImportData('');
      } catch (err) {
        ErrorHandler.getInstance().handleError(err as Error, 'PREF_IMPORT_ERROR');
      }
    };
    reader.readAsText(file);
  };

  // Handle export
  const handleExport = async (format: 'json' | 'csv' = 'json') => {
    try {
      const data = await exportPreferences();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preferences-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExportDialog(false);
    } catch (err) {
      ErrorHandler.getInstance().handleError(err as Error, 'PREF_EXPORT_ERROR');
    }
  };

  // Handle reset all
  const handleResetAll = async () => {
    try {
      await resetAllPreferences();
      setShowResetDialog(false);
    } catch (err) {
      ErrorHandler.getInstance().handleError(err as Error, 'PREF_RESET_ERROR');
    }
  };

  // Render tab navigation
  const renderTabNavigation = () => {
    if (compact) return null;

    const tabs = [
      { id: 'browse', label: 'Browse', icon: '📂' },
      { id: 'search', label: 'Search', icon: '🔍' },
      { id: 'favorites', label: 'Favorites', icon: '⭐' },
      { id: 'history', label: 'History', icon: '📜' },
      { id: 'sync', label: 'Sync', icon: '🔄' },
      { id: 'backup', label: 'Backup', icon: '💾' }
    ];

    return (
      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            aria-label={tab.label}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
    );
  };

  // Render search bar
  const renderSearchBar = () => {
    if (!showSearch) return null;

    return (
      <div className="search-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder="Search preferences..."
            value={uiState.searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>
    );
  };

  // Render categories
  const renderCategories = () => {
    if (!showCategories || activeTab !== 'browse') return null;

    return (
      <div className="categories-container">
        <h3 className="categories-title">Categories</h3>
        <div className="categories-grid">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              className={`category-button ${uiState.selectedCategory === category.id ? 'active' : ''}`}
              style={{ backgroundColor: category.color + '20' }}
            >
              <span className="category-icon">{category.icon}</span>
              <span className="category-name">{category.name}</span>
              <span className="category-description">{category.description}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Render presets
  const renderPresets = () => {
    if (activeTab !== 'browse') return null;

    return (
      <div className="presets-container">
        <h3 className="presets-title">Recommended Presets</h3>
        <div className="presets-grid">
          {presets.filter(p => p.isRecommended).map(preset => (
            <div
              key={preset.id}
              className={`preset-card ${selectedPreset === preset.id ? 'selected' : ''}`}
              onClick={() => handleApplyPreset(preset.id)}
            >
              <div className="preset-header">
                <span className="preset-icon" style={{ color: preset.color }}>
                  {preset.icon}
                </span>
                <div className="preset-info">
                  <h4 className="preset-name">{preset.name}</h4>
                  <p className="preset-description">{preset.description}</p>
                </div>
              </div>
              <div className="preset-details">
                <span className="preset-age">Ages {preset.ageRange.min}-{preset.ageRange.max}</span>
                <div className="preset-rating">
                  {'★'.repeat(Math.floor(preset.rating))}
                  {'☆'.repeat(5 - Math.floor(preset.rating))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render preferences list
  const renderPreferencesList = () => {
    if (isLoading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading preferences...</p>
        </div>
      );
    }

    if (filteredPreferences.length === 0) {
      return (
        <div className="empty-container">
          <p>No preferences found</p>
        </div>
      );
    }

    return (
      <div className="preferences-list">
        {filteredPreferences.map(preference => (
          <PreferenceControls
            key={preference.key}
            preference={preference}
            value={getPreference(preference.key, preference.defaultValue)}
            onChange={(value) => handlePreferenceChange(preference.key, value)}
            onReset={() => resetPreference(preference.key)}
            onFavorite={() => {
              if (favorites.includes(preference.key)) {
                removeFavorite(preference.key);
              } else {
                addFavorite(preference.key);
              }
            }}
            isModified={uiState.modifiedPreferences.has(preference.key)}
            isFavorite={favorites.includes(preference.key)}
            isReadOnly={preference.isReadOnly}
            showDescription={!compact}
            showValidation={true}
            validation={validatePreference(preference.key, getPreference(preference.key, preference.defaultValue))}
          />
        ))}
      </div>
    );
  };

  // Render history tab
  const renderHistoryTab = () => {
    if (activeTab !== 'history') return null;

    return (
      <div className="history-container">
        <h3 className="history-title">Recent Changes</h3>
        <div className="history-list">
          {history.slice(0, 20).map(item => (
            <div key={item.id} className="history-item">
              <div className="history-header">
                <span className="history-key">{item.preferenceKey}</span>
                <span className="history-time">
                  {item.timestamp.toLocaleString()}
                </span>
              </div>
              <div className="history-changes">
                <div className="history-change">
                  <span className="change-label">From:</span>
                  <span className="change-value">{String(item.oldValue)}</span>
                </div>
                <div className="history-change">
                  <span className="change-label">To:</span>
                  <span className="change-value">{String(item.newValue)}</span>
                </div>
              </div>
              <div className="history-actions">
                <button
                  onClick={() => undoChange(item.id)}
                  className="history-action"
                  title="Undo this change"
                >
                  ↶ Undo
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render sync tab
  const renderSyncTab = () => {
    if (activeTab !== 'sync') return null;

    return (
      <div className="sync-container">
        <h3 className="sync-title">Synchronization</h3>

        <div className="sync-status">
          <div className={`sync-indicator ${syncState.isOnline ? 'online' : 'offline'}`}>
            {syncState.isOnline ? '🟢 Online' : '🔴 Offline'}
          </div>
          <div className="sync-last-sync">
            Last sync: {syncState.lastSync ? syncState.lastSync.toLocaleString() : 'Never'}
          </div>
        </div>

        <div className="sync-actions">
          <button
            onClick={syncPreferences}
            disabled={syncState.isSyncing || !syncState.isOnline}
            className="sync-button primary"
          >
            {syncState.isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {syncState.conflicts.length > 0 && (
          <div className="sync-conflicts">
            <h4>Conflicts</h4>
            {syncState.conflicts.map((conflict, index) => (
              <div key={index} className="conflict-item">
                <div className="conflict-key">{conflict.key}</div>
                <div className="conflict-values">
                  <div className="conflict-value">
                    <span className="value-label">Local:</span>
                    <span className="value-content">{String(conflict.localValue)}</span>
                  </div>
                  <div className="conflict-value">
                    <span className="value-label">Remote:</span>
                    <span className="value-content">{String(conflict.remoteValue)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="sync-devices">
          <h4>Connected Devices</h4>
          {syncState.devices.map(device => (
            <div key={device.id} className="device-item">
              <span className={`device-status ${device.isOnline ? 'online' : 'offline'}`}>
                {device.isOnline ? '🟢' : '🔴'}
              </span>
              <span className="device-name">{device.name}</span>
              <span className="device-type">{device.type}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render backup tab
  const renderBackupTab = () => {
    if (activeTab !== 'backup') return null;

    return (
      <div className="backup-container">
        <h3 className="backup-title">Backup & Restore</h3>

        <div className="backup-actions">
          <button
            onClick={() => setShowExportDialog(true)}
            className="backup-button"
          >
            Export Preferences
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="backup-button"
          >
            Import Preferences
          </button>
          <button
            onClick={() => createBackup('Manual backup')}
            className="backup-button"
          >
            Create Backup
          </button>
          <button
            onClick={() => setShowResetDialog(true)}
            className="backup-button danger"
          >
            Reset All
          </button>
        </div>

        <div className="backup-list">
          <h4>Available Backups</h4>
          {backups.map(backup => (
            <div key={backup.id} className="backup-item">
              <div className="backup-info">
                <div className="backup-time">
                  {backup.timestamp.toLocaleString()}
                </div>
                {backup.description && (
                  <div className="backup-description">{backup.description}</div>
                )}
                <div className="backup-size">
                  {(backup.metadata.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <div className="backup-item-actions">
                <button
                  onClick={() => restoreBackup(backup.id)}
                  className="backup-item-button"
                >
                  Restore
                </button>
                <button
                  onClick={() => deleteBackup(backup.id)}
                  className="backup-item-button danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render import dialog
  const renderImportDialog = () => {
    if (!showImportDialog) return null;

    return (
      <div className="dialog-overlay">
        <div className="dialog">
          <h3>Import Preferences</h3>
          <div className="dialog-content">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="file-input"
            />
            <p className="dialog-help">
              Select a JSON file containing exported preferences
            </p>
          </div>
          <div className="dialog-actions">
            <button
              onClick={() => {
                setShowImportDialog(false);
                setImportData('');
              }}
              className="dialog-button secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render export dialog
  const renderExportDialog = () => {
    if (!showExportDialog) return null;

    return (
      <div className="dialog-overlay">
        <div className="dialog">
          <h3>Export Preferences</h3>
          <div className="dialog-content">
            <p>Choose export format:</p>
            <div className="export-options">
              <button
                onClick={() => handleExport('json')}
                className="export-option"
              >
                JSON Format
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="export-option"
              >
                CSV Format
              </button>
            </div>
          </div>
          <div className="dialog-actions">
            <button
              onClick={() => setShowExportDialog(false)}
              className="dialog-button secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render reset dialog
  const renderResetDialog = () => {
    if (!showResetDialog) return null;

    return (
      <div className="dialog-overlay">
        <div className="dialog">
          <h3>Reset All Preferences</h3>
          <div className="dialog-content">
            <p>Are you sure you want to reset all preferences to their default values?</p>
            <p className="warning">This action cannot be undone.</p>
          </div>
          <div className="dialog-actions">
            <button
              onClick={() => setShowResetDialog(false)}
              className="dialog-button secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleResetAll}
              className="dialog-button danger"
            >
              Reset All
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render notifications
  const renderNotifications = () => {
    if (notifications.length === 0) return null;

    return (
      <div className="notifications-container">
        {notifications.slice(0, 5).map(notification => (
          <div
            key={notification.id}
            className={`notification ${notification.priority} ${notification.isRead ? 'read' : 'unread'}`}
          >
            <div className="notification-header">
              <h4 className="notification-title">{notification.title}</h4>
              <span className="notification-time">
                {notification.timestamp.toLocaleString()}
              </span>
            </div>
            <p className="notification-message">{notification.message}</p>
            <div className="notification-actions">
              {!notification.isRead && (
                <button
                  onClick={() => markNotificationAsRead(notification.id)}
                  className="notification-button"
                >
                  Mark as Read
                </button>
              )}
              <button
                onClick={() => dismissNotification(notification.id)}
                className="notification-button"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`preferences-panel ${className} ${theme} ${compact ? 'compact' : ''}`}>
      {showHeader && (
        <div className="preferences-header">
          <h2 className="preferences-title">Preferences</h2>
          <div className="header-actions">
            <button
              onClick={refreshPreferences}
              disabled={isLoading}
              className="header-button"
              title="Refresh preferences"
            >
              🔄
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <span className="error-icon">❌</span>
          {error}
          <button onClick={clearMessages} className="error-dismiss">×</button>
        </div>
      )}

      {uiState.success && (
        <div className="success-message">
          <span className="success-icon">✅</span>
          {uiState.success}
          <button onClick={clearMessages} className="success-dismiss">×</button>
        </div>
      )}

      {renderNotifications()}

      {renderTabNavigation()}
      {renderSearchBar()}

      <div className="preferences-content">
        {renderCategories()}
        {renderPresets()}
        {renderPreferencesList()}
        {renderHistoryTab()}
        {renderSyncTab()}
        {renderBackupTab()}
      </div>

      {isSaving && (
        <div className="saving-indicator">
          <div className="saving-spinner"></div>
          <span>Saving preferences...</span>
        </div>
      )}

      {renderImportDialog()}
      {renderExportDialog()}
      {renderResetDialog()}

      <style jsx>{`
        .preferences-panel {
          max-width: 1200px;
          margin: 0 auto;
          padding: 1rem;
          background: #f8fafc;
          border-radius: 0.5rem;
        }

        .preferences-panel.compact {
          padding: 0.5rem;
        }

        .preferences-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .preferences-title {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #1f2937;
        }

        .header-actions {
          display: flex;
          gap: 0.5rem;
        }

        .header-button {
          background: none;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
          padding: 0.5rem;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .header-button:hover {
          background: #f3f4f6;
        }

        .error-message,
        .success-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: 0.375rem;
          margin-bottom: 1rem;
        }

        .error-message {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .success-message {
          background: #f0fdf4;
          color: #16a34a;
          border: 1px solid #bbf7d0;
        }

        .error-dismiss,
        .success-dismiss {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.25rem;
        }

        .tab-navigation {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          color: #6b7280;
          transition: all 0.2s ease;
        }

        .tab-button:hover {
          color: #374151;
          background: #f3f4f6;
        }

        .tab-button.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }

        .search-container {
          margin-bottom: 1.5rem;
        }

        .search-input-wrapper {
          position: relative;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s ease;
        }

        .search-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .categories-container {
          margin-bottom: 2rem;
        }

        .categories-title {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
        }

        .category-button {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .category-button:hover {
          border-color: #d1d5db;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .category-button.active {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .category-icon {
          font-size: 1.5rem;
        }

        .category-name {
          font-weight: 600;
          color: #1f2937;
        }

        .category-description {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .presets-container {
          margin-bottom: 2rem;
        }

        .presets-title {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .presets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
        }

        .preset-card {
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .preset-card:hover {
          border-color: #d1d5db;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .preset-card.selected {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .preset-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .preset-icon {
          font-size: 1.5rem;
        }

        .preset-info h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .preset-info p {
          margin: 0;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .preset-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
          color: #6b7280;
        }

        .preset-rating {
          color: #fbbf24;
        }

        .preferences-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: #6b7280;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top: 3px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .empty-container {
          text-align: center;
          padding: 3rem;
          color: #6b7280;
        }

        .saving-indicator {
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #1f2937;
          color: white;
          border-radius: 0.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .saving-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #374151;
          border-top: 2px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        /* Additional styles for other tabs would be added here */
        .history-container,
        .sync-container,
        .backup-container {
          padding: 1rem;
          background: white;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
        }

        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .dialog {
          background: white;
          border-radius: 0.5rem;
          padding: 1.5rem;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .dialog h3 {
          margin: 0 0 1rem 0;
          color: #1f2937;
        }

        .dialog-content {
          margin-bottom: 1.5rem;
        }

        .dialog-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .dialog-button {
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
          background: white;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .dialog-button:hover {
          background: #f3f4f6;
        }

        .dialog-button.secondary {
          background: #f3f4f6;
        }

        .dialog-button.danger {
          background: #fef2f2;
          color: #dc2626;
          border-color: #fecaca;
        }

        .dialog-button.danger:hover {
          background: #fee2e2;
        }

        .warning {
          color: #dc2626;
          font-weight: 500;
        }

        .notifications-container {
          margin-bottom: 1rem;
        }

        .notification {
          padding: 1rem;
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
          border: 1px solid;
        }

        .notification.high {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .notification.medium {
          background: #fffbeb;
          border-color: #fed7aa;
          color: #d97706;
        }

        .notification.low {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #16a34a;
        }

        .notification.unread {
          border-left: 4px solid #3b82f6;
        }

        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .notification-title {
          margin: 0;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .notification-time {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .notification-message {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
        }

        .notification-actions {
          display: flex;
          gap: 0.5rem;
        }

        .notification-button {
          padding: 0.25rem 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.25rem;
          background: white;
          cursor: pointer;
          font-size: 0.75rem;
          transition: all 0.2s ease;
        }

        .notification-button:hover {
          background: #f3f4f6;
        }

        /* String input styling */
        .string-input,
        .number-input,
        .select-input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          outline: none;
          transition: all 0.2s ease;
        }

        .string-input:focus,
        .number-input:focus,
        .select-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .string-input:disabled,
        .number-input:disabled,
        .select-input:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default PreferencesPanel;