/**
 * React Hooks for Preferences Management
 * Provides comprehensive preference state management, validation, and UI helpers
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  PreferenceContextType,
  PreferenceSearchResult,
  PreferenceHistory,
  PreferenceBackup,
  PreferenceNotification,
  PreferenceValidationResult,
  PreferenceExportOptions,
  PreferenceImportOptions,
  PreferenceSyncState,
  PreferenceUIState
} from '../types/preferences';
import { PreferencesManager } from '../utils/preferencesManager';
import { PreferenceSyncManager } from '../utils/preferenceSync';
import { PreferenceDefaults } from '../utils/preferenceDefaults';
import { ErrorHandler } from '../utils/errorHandler';

interface UsePreferencesConfig {
  autoLoad: boolean;
  autoSave: boolean;
  enableSync: boolean;
  enableValidation: boolean;
  enableHistory: boolean;
  maxHistoryItems: number;
  debounceMs: number;
}

export const usePreferences = (config: Partial<UsePreferencesConfig> = {}) => {
  const {
    autoLoad = true,
    autoSave = true,
    enableSync = true,
    enableValidation = true,
    enableHistory = true,
    maxHistoryItems = 100,
    debounceMs = 300
  } = config;

  // State
  const [preferences, setPreferences] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<PreferenceSearchResult | null>(null);
  const [history, setHistory] = useState<PreferenceHistory[]>([]);
  const [backups, setBackups] = useState<PreferenceBackup[]>([]);
  const [notifications, setNotifications] = useState<PreferenceNotification[]>([]);
  const [syncState, setSyncState] = useState<PreferenceSyncState>({
    isOnline: true,
    isSyncing: false,
    lastSync: null,
    syncError: null,
    devices: [],
    conflicts: [],
    syncInProgress: false,
    syncPercentage: 100
  });

  // UI State
  const [uiState, setUiState] = useState<PreferenceUIState>({
    isLoading: false,
    isSaving: false,
    isSyncing: false,
    searchQuery: '',
    selectedCategory: null,
    expandedCategories: new Set(),
    favoritePreferences: new Set(),
    modifiedPreferences: new Set(),
    error: null,
    success: null,
    notifications: []
  });

  // Refs
  const preferencesManagerRef = useRef<PreferencesManager | null>(null);
  const syncManagerRef = useRef<PreferenceSyncManager | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Initialize managers
  useEffect(() => {
    if (!preferencesManagerRef.current) {
      preferencesManagerRef.current = PreferencesManager.getInstance({
        autoSave,
        enableAnalytics: true
      });
    }

    if (enableSync && !syncManagerRef.current) {
      syncManagerRef.current = PreferenceSyncManager.getInstance(preferencesManagerRef.current);
    }

    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [autoSave, enableSync]);

  // Load preferences on mount
  useEffect(() => {
    if (autoLoad && preferencesManagerRef.current) {
      loadPreferences();
    }
  }, [autoLoad]);

  // Setup event listeners
  useEffect(() => {
    if (!preferencesManagerRef.current) return;

    // Listen for online/offline events
    const handleOnline = () => {
      setSyncState(prev => ({ ...prev, isOnline: true }));
      if (enableSync) {
        syncPreferences();
      }
    };

    const handleOffline = () => {
      setSyncState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enableSync]);

  // Load preferences
  const loadPreferences = useCallback(async () => {
    if (!preferencesManagerRef.current || !isMountedRef.current) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load preferences
      const allPreferences = PreferenceDefaults.getAllPreferences();
      const loadedPrefs: Record<string, any> = {};

      for (const pref of allPreferences) {
        const value = await preferencesManagerRef.current.getPreference(pref.key, pref.defaultValue);
        loadedPrefs[pref.key] = value;
      }

      setPreferences(loadedPrefs);

      // Load additional data
      if (enableHistory) {
        const historyData = preferencesManagerRef.current.getHistory();
        setHistory(historyData.slice(0, maxHistoryItems));
      }

      const backupsData = preferencesManagerRef.current.getBackups();
      setBackups(backupsData);

      const notificationsData = preferencesManagerRef.current.getNotifications();
      setNotifications(notificationsData);

      // Update sync state
      if (syncManagerRef.current) {
        setSyncState(syncManagerRef.current.getSyncState());
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load preferences';
      setError(errorMessage);
      ErrorHandler.getInstance().handleError(err as Error, 'PREF_LOAD_ERROR');
    } finally {
      setIsLoading(false);
    }
  }, [enableHistory, maxHistoryItems]);

  // Get preference value
  const getPreference = useCallback(<T = any>(key: string, defaultValue?: T): T => {
    return preferences[key] ?? defaultValue;
  }, [preferences]);

  // Set preference value
  const setPreference = useCallback(async (key: string, value: any): Promise<void> => {
    if (!preferencesManagerRef.current || !isMountedRef.current) return;

    try {
      setIsSaving(true);
      setError(null);
      setUiState(prev => ({ ...prev, error: null, success: null }));

      // Validate if enabled
      if (enableValidation) {
        const validation = PreferenceDefaults.validatePreference(key, value, preferences);
        if (!validation.isValid) {
          throw new Error(`Invalid preference value: ${validation.violations[0].message}`);
        }
      }

      // Update local state
      setPreferences(prev => ({ ...prev, [key]: value }));

      // Track modifications
      setUiState(prev => ({
        ...prev,
        modifiedPreferences: new Set([...prev.modifiedPreferences, key])
      }));

      // Debounce save
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        try {
          await preferencesManagerRef.current.setPreference(key, value);
          setUiState(prev => ({ ...prev, success: 'Preference saved successfully' }));

          // Update history
          if (enableHistory) {
            const historyData = preferencesManagerRef.current.getHistory(key);
            setHistory(historyData.slice(0, maxHistoryItems));
          }

          // Clear modification tracking
          setUiState(prev => ({
            ...prev,
            modifiedPreferences: new Set([...prev.modifiedPreferences].filter(k => k !== key))
          }));

          // Sync if enabled
          if (enableSync && syncManagerRef.current) {
            await syncManagerRef.current.syncPreferences();
            setSyncState(syncManagerRef.current.getSyncState());
          }

        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to save preference';
          setError(errorMessage);
          setUiState(prev => ({ ...prev, error: errorMessage }));
        } finally {
          setIsSaving(false);
        }
      }, debounceMs);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set preference';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
      setIsSaving(false);
    }
  }, [preferences, enableValidation, enableHistory, enableSync, maxHistoryItems, debounceMs]);

  // Reset preference to default
  const resetPreference = useCallback(async (key: string): Promise<void> => {
    if (!preferencesManagerRef.current) return;

    try {
      setIsSaving(true);
      setError(null);

      await preferencesManagerRef.current.resetPreference(key);
      await loadPreferences();

      setUiState(prev => ({ ...prev, success: 'Preference reset to default' }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset preference';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
    } finally {
      setIsSaving(false);
    }
  }, [loadPreferences]);

  // Reset all preferences
  const resetAllPreferences = useCallback(async (): Promise<void> => {
    if (!preferencesManagerRef.current) return;

    try {
      setIsSaving(true);
      setError(null);

      await preferencesManagerRef.current.resetAllPreferences();
      await loadPreferences();

      setUiState(prev => ({
        ...prev,
        success: 'All preferences reset to defaults',
        modifiedPreferences: new Set()
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset preferences';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
    } finally {
      setIsSaving(false);
    }
  }, [loadPreferences]);

  // Export preferences
  const exportPreferences = useCallback(async (options?: PreferenceExportOptions): Promise<string> => {
    if (!preferencesManagerRef.current) {
      throw new Error('Preferences manager not initialized');
    }

    try {
      setIsSaving(true);
      setError(null);

      const data = await preferencesManagerRef.current.exportPreferences(options);

      setUiState(prev => ({ ...prev, success: 'Preferences exported successfully' }));
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export preferences';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Import preferences
  const importPreferences = useCallback(async (data: string, options?: PreferenceImportOptions): Promise<void> => {
    if (!preferencesManagerRef.current) {
      throw new Error('Preferences manager not initialized');
    }

    try {
      setIsSaving(true);
      setError(null);

      await preferencesManagerRef.current.importPreferences(data, options);
      await loadPreferences();

      setUiState(prev => ({
        ...prev,
        success: 'Preferences imported successfully',
        modifiedPreferences: new Set()
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import preferences';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [loadPreferences]);

  // Search preferences
  const searchPreferences = useCallback((query: string): PreferenceSearchResult => {
    if (!preferencesManagerRef.current) {
      return {
        preferences: [],
        totalCount: 0,
        facets: { categories: [], dataTypes: [], ageRanges: [] },
        suggestions: []
      };
    }

    const results = preferencesManagerRef.current.searchPreferences(query);
    setSearchResults(results);
    return results;
  }, []);

  // Get preferences by category
  const getPreferencesByCategory = useCallback((category: string) => {
    return PreferenceDefaults.getPreferencesByCategory(category);
  }, []);

  // Validate preference
  const validatePreference = useCallback((key: string, value: any): PreferenceValidationResult => {
    return PreferenceDefaults.validatePreference(key, value, preferences);
  }, [preferences]);

  // Favorite management
  const addFavorite = useCallback((key: string) => {
    setUiState(prev => ({
      ...prev,
      favoritePreferences: new Set([...prev.favoritePreferences, key])
    }));

    // Save to localStorage
    const favorites = Array.from(new Set([...uiState.favoritePreferences, key]));
    localStorage.setItem('preference-favorites', JSON.stringify(favorites));
  }, [uiState.favoritePreferences]);

  const removeFavorite = useCallback((key: string) => {
    setUiState(prev => {
      const newFavorites = new Set(prev.favoritePreferences);
      newFavorites.delete(key);
      return { ...prev, favoritePreferences: newFavorites };
    });

    // Save to localStorage
    const favorites = Array.from(uiState.favoritePreferences).filter(k => k !== key);
    localStorage.setItem('preference-favorites', JSON.stringify(favorites));
  }, [uiState.favoritePreferences]);

  const getFavorites = useCallback((): string[] => {
    return Array.from(uiState.favoritePreferences);
  }, [uiState.favoritePreferences]);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('preference-favorites');
      if (stored) {
        const favorites = JSON.parse(stored);
        setUiState(prev => ({ ...prev, favoritePreferences: new Set(favorites) }));
      }
    } catch (err) {
      console.warn('Failed to load favorites from localStorage');
    }
  }, []);

  // History management
  const undoChange = useCallback(async (historyId: string): Promise<void> => {
    if (!preferencesManagerRef.current) return;

    try {
      const historyItem = history.find(h => h.id === historyId);
      if (!historyItem) return;

      await setPreference(historyItem.preferenceKey, historyItem.oldValue);
      setUiState(prev => ({ ...prev, success: 'Change undone successfully' }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to undo change';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
    }
  }, [history, setPreference]);

  const redoChange = useCallback(async (historyId: string): Promise<void> => {
    if (!preferencesManagerRef.current) return;

    try {
      const historyItem = history.find(h => h.id === historyId);
      if (!historyItem) return;

      await setPreference(historyItem.preferenceKey, historyItem.newValue);
      setUiState(prev => ({ ...prev, success: 'Change redone successfully' }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to redo change';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
    }
  }, [history, setPreference]);

  // Sync management
  const syncPreferences = useCallback(async (): Promise<void> => {
    if (!syncManagerRef.current) return;

    try {
      setUiState(prev => ({ ...prev, isSyncing: true, error: null }));
      setSyncState(prev => ({ ...prev, isSyncing: true, syncError: null }));

      const success = await syncManagerRef.current.syncPreferences();
      setSyncState(syncManagerRef.current.getSyncState());

      if (success) {
        setUiState(prev => ({ ...prev, success: 'Preferences synced successfully' }));
      } else {
        setUiState(prev => ({ ...prev, error: 'Sync failed' }));
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync preferences';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
      setSyncState(prev => ({ ...prev, syncError: errorMessage }));
    } finally {
      setUiState(prev => ({ ...prev, isSyncing: false }));
      setSyncState(prev => ({ ...prev, isSyncing: false }));
    }
  }, []);

  // Backup management
  const createBackup = useCallback(async (description?: string): Promise<string> => {
    if (!preferencesManagerRef.current) {
      throw new Error('Preferences manager not initialized');
    }

    try {
      setIsSaving(true);
      setError(null);

      const backupId = await preferencesManagerRef.current.createBackup(description);
      const backupsData = preferencesManagerRef.current.getBackups();
      setBackups(backupsData);

      setUiState(prev => ({ ...prev, success: 'Backup created successfully' }));
      return backupId;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create backup';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const restoreBackup = useCallback(async (backupId: string): Promise<void> => {
    if (!preferencesManagerRef.current) return;

    try {
      setIsSaving(true);
      setError(null);

      await preferencesManagerRef.current.restoreBackup(backupId);
      await loadPreferences();

      const backupsData = preferencesManagerRef.current.getBackups();
      setBackups(backupsData);

      setUiState(prev => ({
        ...prev,
        success: 'Backup restored successfully',
        modifiedPreferences: new Set()
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restore backup';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
    } finally {
      setIsSaving(false);
    }
  }, [loadPreferences]);

  const deleteBackup = useCallback(async (backupId: string): Promise<void> => {
    if (!preferencesManagerRef.current) return;

    try {
      await preferencesManagerRef.current.deleteBackup(backupId);
      const backupsData = preferencesManagerRef.current.getBackups();
      setBackups(backupsData);

      setUiState(prev => ({ ...prev, success: 'Backup deleted successfully' }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete backup';
      setError(errorMessage);
      setUiState(prev => ({ ...prev, error: errorMessage }));
    }
  }, []);

  // Notification management
  const markNotificationAsRead = useCallback((id: string) => {
    if (!preferencesManagerRef.current) return;

    preferencesManagerRef.current.markNotificationAsRead(id);
    const notificationsData = preferencesManagerRef.current.getNotifications();
    setNotifications(notificationsData);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    if (!preferencesManagerRef.current) return;

    preferencesManagerRef.current.dismissNotification(id);
    const notificationsData = preferencesManagerRef.current.getNotifications();
    setNotifications(notificationsData);
  }, []);

  const clearAllNotifications = useCallback(() => {
    if (!preferencesManagerRef.current) return;

    preferencesManagerRef.current.clearAllNotifications();
    setNotifications([]);
  }, []);

  // Category management
  const toggleCategory = useCallback((categoryId: string) => {
    setUiState(prev => {
      const newExpanded = new Set(prev.expandedCategories);
      if (newExpanded.has(categoryId)) {
        newExpanded.delete(categoryId);
      } else {
        newExpanded.add(categoryId);
      }
      return { ...prev, expandedCategories: newExpanded };
    });
  }, []);

  const selectCategory = useCallback((categoryId: string | null) => {
    setUiState(prev => ({ ...prev, selectedCategory: categoryId }));
  }, []);

  // Search management
  const setSearchQuery = useCallback((query: string) => {
    setUiState(prev => ({ ...prev, searchQuery: query }));

    if (query.trim()) {
      searchPreferences(query);
    } else {
      setSearchResults(null);
    }
  }, [searchPreferences]);

  // Refresh preferences
  const refreshPreferences = useCallback(async () => {
    await loadPreferences();
  }, [loadPreferences]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setUiState(prev => ({ ...prev, error: null, success: null }));
  }, []);

  // Context value
  const contextValue: PreferenceContextType = useMemo(() => ({
    preferences,
    isLoading,
    isSaving,
    error,
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
    getHistory: (key?: string) => key ? history.filter(h => h.preferenceKey === key) : history,
    undoChange,
    redoChange,
    syncPreferences,
    createBackup,
    restoreBackup,
    getBackups: () => backups,
    deleteBackup,
    notifications,
    markNotificationAsRead,
    dismissNotification,
    clearAllNotifications,
    syncState,
    uiState,
    refreshPreferences
  }), [
    preferences,
    isLoading,
    isSaving,
    error,
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
    history,
    undoChange,
    redoChange,
    syncPreferences,
    createBackup,
    restoreBackup,
    backups,
    deleteBackup,
    notifications,
    markNotificationAsRead,
    dismissNotification,
    clearAllNotifications,
    syncState,
    uiState,
    refreshPreferences
  ]);

  return {
    // State
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

    // Core methods
    getPreference,
    setPreference,
    resetPreference,
    resetAllPreferences,

    // Import/Export
    exportPreferences,
    importPreferences,

    // Search
    searchPreferences,
    setSearchQuery,

    // Validation
    validatePreference,

    // Favorites
    addFavorite,
    removeFavorite,
    getFavorites,

    // History
    undoChange,
    redoChange,

    // Sync
    syncPreferences,

    // Backup
    createBackup,
    restoreBackup,
    deleteBackup,

    // Notifications
    markNotificationAsRead,
    dismissNotification,
    clearAllNotifications,

    // Categories
    toggleCategory,
    selectCategory,
    getPreferencesByCategory,

    // Utility
    refreshPreferences,
    clearMessages,

    // Context
    contextValue
  };
};

export type UsePreferencesReturn = ReturnType<typeof usePreferences>;