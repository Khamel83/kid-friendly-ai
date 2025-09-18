/**
 * Preference Types for Kid-Friendly AI
 * Defines all preference structures, categories, and validation types
 */

import { ParentalControlLevel } from './parental';

export interface UserPreference {
  id: string;
  key: string;
  value: any;
  category: PreferenceCategory;
  dataType: PreferenceDataType;
  description: string;
  isAgeRestricted: boolean;
  minAge?: number;
  maxAge?: number;
  defaultValue: any;
  isRequired: boolean;
  isReadOnly: boolean;
  lastModified: Date;
  version: number;
}

export interface PreferenceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  parentId?: string;
  isCollapsed: boolean;
  isParentalOnly: boolean;
  preferences: UserPreference[];
}

export type PreferenceDataType =
  | 'boolean'
  | 'string'
  | 'number'
  | 'select'
  | 'color'
  | 'range'
  | 'multiselect'
  | 'custom';

export interface PreferenceValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value: any;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface PreferenceConstraint {
  key: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'matches';
  value: any;
  message: string;
}

export interface PreferenceHistory {
  id: string;
  preferenceKey: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  userId: string;
  source: 'user' | 'system' | 'sync' | 'import' | 'migration';
  deviceInfo?: string;
  ipAddress?: string;
  sessionToken?: string;
}

export interface PreferenceImportExport {
  version: string;
  timestamp: Date;
  preferences: Record<string, any>;
  metadata: {
    userId?: string;
    deviceInfo: string;
    exportType: 'full' | 'partial' | 'template';
    categories: string[];
    appVersion: string;
  };
  checksum: string;
}

export interface PreferenceSyncData {
  id: string;
  userId: string;
  deviceId: string;
  preferences: Record<string, any>;
  timestamp: Date;
  operation: 'create' | 'update' | 'delete' | 'sync';
  conflictResolution: 'local' | 'remote' | 'merge' | 'manual';
  lastSync: Date;
  syncStatus: 'pending' | 'syncing' | 'completed' | 'failed';
  errorMessage?: string;
}

export interface PreferenceAnalytics {
  userId: string;
  sessionId: string;
  timestamp: Date;
  events: PreferenceAnalyticsEvent[];
  summary: PreferenceAnalyticsSummary;
}

export interface PreferenceAnalyticsEvent {
  type: 'view' | 'change' | 'search' | 'export' | 'import' | 'reset' | 'sync';
  preferenceKey?: string;
  category?: string;
  oldValue?: any;
  newValue?: any;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PreferenceAnalyticsSummary {
  totalChanges: number;
  uniquePreferencesChanged: number;
  mostChangedCategory: string;
  averageChangeDuration: number;
  syncSuccessRate: number;
  exportCount: number;
  importCount: number;
  resetCount: number;
}

export interface PreferenceSearchFilter {
  query?: string;
  categories?: string[];
  dataTypes?: PreferenceDataType[];
  ageRange?: { min: number; max: number };
  parentalOnly?: boolean;
  modifiedSince?: Date;
  isFavorite?: boolean;
  isModified?: boolean;
}

export interface PreferenceSearchResult {
  preferences: UserPreference[];
  totalCount: number;
  facets: {
    categories: Array<{ category: string; count: number }>;
    dataTypes: Array<{ type: PreferenceDataType; count: number }>;
    ageRanges: Array<{ range: string; count: number }>;
  };
  suggestions: string[];
}

export interface PreferenceNotification {
  id: string;
  type: 'change' | 'conflict' | 'sync' | 'update' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  actions: Array<{
    label: string;
    action: () => void;
    style: 'primary' | 'secondary' | 'danger';
  }>;
  metadata?: Record<string, any>;
}

export interface PreferenceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  ageRange: { min: number; max: number };
  preferences: Record<string, any>;
  isDefault: boolean;
  isRecommended: boolean;
  tags: string[];
  preview: {
    title: string;
    description: string;
    screenshot?: string;
  };
  usageCount: number;
  rating: number;
  reviews: Array<{
    userId: string;
    rating: number;
    comment: string;
    timestamp: Date;
  }>;
}

export interface PreferenceBackup {
  id: string;
  userId: string;
  timestamp: Date;
  preferences: Record<string, any>;
  metadata: {
    deviceInfo: string;
    appVersion: string;
    size: number;
    isEncrypted: boolean;
    checksum: string;
  };
  restorePoint: boolean;
  autoCreated: boolean;
  description?: string;
}

export interface PreferenceMigration {
  id: string;
  fromVersion: string;
  toVersion: string;
  timestamp: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  migrations: Array<{
    preferenceKey: string;
    oldPath?: string;
    newPath?: string;
    transform: (value: any) => any;
    description: string;
  }>;
  rollbackScript?: string;
  backupCreated: boolean;
  affectedUsers: number;
  successCount: number;
  failureCount: number;
  errors: string[];
}

export interface PreferenceDevice {
  id: string;
  name: string;
  type: 'mobile' | 'tablet' | 'desktop' | 'web';
  platform: string;
  browser?: string;
  lastActive: Date;
  lastSync: Date;
  isOnline: boolean;
  isPrimary: boolean;
  preferences: Record<string, any>;
  capabilities: string[];
}

export interface PreferenceSession {
  id: string;
  userId: string;
  deviceId: string;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  preferences: Record<string, any>;
  changes: PreferenceHistory[];
  analytics: PreferenceAnalytics;
}

export interface PreferencePreset {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  preferences: Record<string, any>;
  ageRange: { min: number; max: number };
  parentalLevel?: ParentalControlLevel;
  isRecommended: boolean;
  usageCount: number;
  rating: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  author?: string;
}

export interface PreferenceConstraintViolation {
  preferenceKey: string;
  constraint: PreferenceConstraint;
  actualValue: any;
  expectedValue: any;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestions: string[];
}

export interface PreferenceValidationResult {
  isValid: boolean;
  violations: PreferenceConstraintViolation[];
  warnings: string[];
  suggestions: string[];
  score: number; // 0-100, higher is better
}

export interface PreferenceExportOptions {
  format: 'json' | 'csv' | 'xml';
  categories: string[];
  includeMetadata: boolean;
  includeHistory: boolean;
  encryptionKey?: string;
  compression: boolean;
  template?: string;
}

export interface PreferenceImportOptions {
  source: 'file' | 'url' | 'cloud' | 'template';
  format: 'json' | 'csv' | 'xml';
  mergeStrategy: 'overwrite' | 'merge' | 'keep_existing' | 'ask';
  conflictResolution: 'local' | 'remote' | 'manual';
  validateOnly: boolean;
  categories?: string[];
  encryptionKey?: string;
}

export interface PreferenceUIState {
  isLoading: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  searchQuery: string;
  selectedCategory: string | null;
  expandedCategories: Set<string>;
  favoritePreferences: Set<string>;
  modifiedPreferences: Set<string>;
  error: string | null;
  success: string | null;
  notifications: PreferenceNotification[];
}

export interface PreferenceControlProps {
  preference: UserPreference;
  value: any;
  onChange: (value: any) => void;
  onReset: () => void;
  onFavorite: () => void;
  isModified: boolean;
  isFavorite: boolean;
  isReadOnly: boolean;
  showDescription: boolean;
  showValidation: boolean;
  validation?: PreferenceValidationResult;
}

export interface PreferencePanelProps {
  userId?: string;
  showHeader?: boolean;
  showSearch?: boolean;
  showCategories?: boolean;
  showFavorites?: boolean;
  showRecent?: boolean;
  compact?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  onPreferenceChange?: (key: string, value: any) => void;
  onCategoryChange?: (categoryId: string) => void;
  onSearch?: (query: string) => void;
  className?: string;
}

export interface PreferenceSyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  syncError: string | null;
  devices: PreferenceDevice[];
  conflicts: Array<{
    key: string;
    localValue: any;
    remoteValue: any;
    timestamp: Date;
    deviceId: string;
  }>;
  syncInProgress: boolean;
  syncPercentage: number;
}

export interface PreferenceContextType {
  preferences: Record<string, any>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  getPreference: (key: string, defaultValue?: any) => any;
  setPreference: (key: string, value: any) => Promise<void>;
  resetPreference: (key: string) => Promise<void>;
  resetAllPreferences: () => Promise<void>;
  exportPreferences: (options?: PreferenceExportOptions) => Promise<string>;
  importPreferences: (data: string, options?: PreferenceImportOptions) => Promise<void>;
  searchPreferences: (query: string) => PreferenceSearchResult;
  getPreferencesByCategory: (category: string) => UserPreference[];
  validatePreference: (key: string, value: any) => PreferenceValidationResult;
  addFavorite: (key: string) => void;
  removeFavorite: (key: string) => void;
  getFavorites: () => string[];
  getHistory: (key?: string) => PreferenceHistory[];
  undoChange: (historyId: string) => Promise<void>;
  redoChange: (historyId: string) => Promise<void>;
  syncPreferences: () => Promise<void>;
  createBackup: (description?: string) => Promise<string>;
  restoreBackup: (backupId: string) => Promise<void>;
  getBackups: () => PreferenceBackup[];
  deleteBackup: (backupId: string) => Promise<void>;
  notifications: PreferenceNotification[];
  markNotificationAsRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  clearAllNotifications: () => void;
  syncState: PreferenceSyncState;
  uiState: PreferenceUIState;
  refreshPreferences: () => Promise<void>;
}