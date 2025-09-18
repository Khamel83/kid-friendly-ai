/**
 * Offline data storage utilities for the kid-friendly-ai project
 * Provides robust IndexedDB and LocalStorage management with encryption support
 */

import type {
  StorageConfig,
  OfflineOperation,
  EncryptionConfig,
  StorageInfo,
  OfflineError,
  OfflineErrorType
} from '../types/offline';

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private config: StorageConfig;
  private encryption: EncryptionConfig;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: StorageConfig, encryption: EncryptionConfig) {
    this.config = config;
    this.encryption = encryption;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeInternal();
    return this.initializationPromise;
  }

  private async _initializeInternal(): Promise<void> {
    try {
      // Initialize IndexedDB
      this.db = await this._openDatabase();

      // Initialize LocalStorage cleanup
      await this._cleanupLocalStorage();

      this.isInitialized = true;
      console.log('Offline storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
      throw this._createError(OfflineErrorType.STORAGE_ERROR, 'Storage initialization failed', error);
    }
  }

  private async _openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.indexedDB.dbName, this.config.indexedDB.version);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        const db = request.result;

        // Set up version change handler
        db.onversionchange = () => {
          db.close();
          console.log('Database version changed, closing connection');
        };

        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        Object.entries(this.config.indexedDB.stores).forEach(([storeName, storeConfig]) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: storeConfig.keyPath,
              autoIncrement: storeConfig.autoIncrement
            });

            // Create indexes
            Object.entries(storeConfig.indexes).forEach(([indexName, indexConfig]) => {
              store.createIndex(indexName, indexConfig.keyPath, {
                unique: indexConfig.unique,
                multiEntry: indexConfig.multiEntry
              });
            });
          }
        });
      };
    });
  }

  private async _cleanupLocalStorage(): Promise<void> {
    try {
      const keys = Object.keys(localStorage);
      const prefix = this.config.localStorage.prefix;
      const keysToRemove = keys.filter(key => key.startsWith(prefix));

      if (keysToRemove.length > this.config.localStorage.maxItems) {
        // Remove oldest items
        const items = keysToRemove.map(key => ({
          key,
          timestamp: parseInt(localStorage.getItem(key)?.split('|')[0] || '0')
        })).sort((a, b) => a.timestamp - b.timestamp);

        const toRemove = items.slice(0, keysToRemove.length - this.config.localStorage.maxItems);
        toRemove.forEach(item => localStorage.removeItem(item.key));
      }
    } catch (error) {
      console.warn('LocalStorage cleanup failed:', error);
    }
  }

  // IndexedDB operations
  async store(storeName: string, data: any, key?: any): Promise<void> {
    this._ensureInitialized();

    try {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      // Encrypt data if encryption is enabled
      const processedData = this.encryption.enabled ? await this._encrypt(data) : data;

      if (key !== undefined) {
        await store.put(processedData, key);
      } else {
        await store.add(processedData);
      }

      await this._waitForTransaction(transaction);
    } catch (error) {
      throw this._createError(OfflineErrorType.STORAGE_ERROR, `Failed to store data in ${storeName}`, error);
    }
  }

  async retrieve<T>(storeName: string, key: any): Promise<T | null> {
    this._ensureInitialized();

    try {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      const result = await this._getRequest<T>(store.get(key));

      // Decrypt data if encryption is enabled
      if (result && this.encryption.enabled) {
        return await this._decrypt<T>(result);
      }

      return result;
    } catch (error) {
      throw this._createError(OfflineErrorType.STORAGE_ERROR, `Failed to retrieve data from ${storeName}`, error);
    }
  }

  async retrieveAll<T>(storeName: string, query?: IDBKeyRange | IDBValidKey): Promise<T[]> {
    this._ensureInitialized();

    try {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      const request = query ? store.getAll(query) : store.getAll();
      const results = await this._getRequest<T[]>(request);

      // Decrypt data if encryption is enabled
      if (this.encryption.enabled) {
        return Promise.all(results.map(item => this._decrypt<T>(item)));
      }

      return results;
    } catch (error) {
      throw this._createError(OfflineErrorType.STORAGE_ERROR, `Failed to retrieve all data from ${storeName}`, error);
    }
  }

  async remove(storeName: string, key: any): Promise<void> {
    this._ensureInitialized();

    try {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      await this._getRequest(store.delete(key));
      await this._waitForTransaction(transaction);
    } catch (error) {
      throw this._createError(OfflineErrorType.STORAGE_ERROR, `Failed to remove data from ${storeName}`, error);
    }
  }

  async clear(storeName: string): Promise<void> {
    this._ensureInitialized();

    try {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      await this._getRequest(store.clear());
      await this._waitForTransaction(transaction);
    } catch (error) {
      throw this._createError(OfflineErrorType.STORAGE_ERROR, `Failed to clear ${storeName}`, error);
    }
  }

  // LocalStorage operations
  async setLocal(key: string, value: any): Promise<void> {
    try {
      const fullKey = `${this.config.localStorage.prefix}${key}`;
      const timestamp = Date.now();
      const serialized = JSON.stringify({ timestamp, value });

      // Encrypt if enabled
      const processedValue = this.encryption.enabled ? await this._encrypt(serialized) : serialized;

      localStorage.setItem(fullKey, processedValue);

      // Trigger cleanup if needed
      await this._cleanupLocalStorage();
    } catch (error) {
      throw this._createError(OfflineErrorType.STORAGE_ERROR, `Failed to set local storage item ${key}`, error);
    }
  }

  async getLocal<T>(key: string): Promise<T | null> {
    try {
      const fullKey = `${this.config.localStorage.prefix}${key}`;
      const item = localStorage.getItem(fullKey);

      if (!item) return null;

      // Decrypt if enabled
      const processedItem = this.encryption.enabled ? await this._decrypt<string>(item) : item;
      const parsed = JSON.parse(processedItem);

      return parsed.value as T;
    } catch (error) {
      console.warn(`Failed to get local storage item ${key}:`, error);
      return null;
    }
  }

  async removeLocal(key: string): Promise<void> {
    try {
      const fullKey = `${this.config.localStorage.prefix}${key}`;
      localStorage.removeItem(fullKey);
    } catch (error) {
      console.warn(`Failed to remove local storage item ${key}:`, error);
    }
  }

  // Utility methods
  async getStorageInfo(): Promise<StorageInfo> {
    try {
      // Get storage quota and usage
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          total: estimate.quota || 0,
          available: (estimate.quota || 0) - (estimate.usage || 0),
          quota: estimate.quota || 0,
          usage: estimate.usage ? (estimate.usage / (estimate.quota || 1)) * 100 : 0
        };
      }

      // Fallback for browsers without storage estimate
      return {
        used: 0,
        total: 0,
        available: 0,
        quota: 0,
        usage: 0
      };
    } catch (error) {
      console.warn('Failed to get storage info:', error);
      return {
        used: 0,
        total: 0,
        available: 0,
        quota: 0,
        usage: 0
      };
    }
  }

  async clearAll(): Promise<void> {
    try {
      // Clear all IndexedDB stores
      if (this.db) {
        const storeNames = Array.from(this.db.objectStoreNames);
        for (const storeName of storeNames) {
          await this.clear(storeName);
        }
      }

      // Clear LocalStorage items with our prefix
      const keys = Object.keys(localStorage);
      const prefix = this.config.localStorage.prefix;
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });

      console.log('All offline storage cleared');
    } catch (error) {
      throw this._createError(OfflineErrorType.STORAGE_ERROR, 'Failed to clear all storage', error);
    }
  }

  async backup(): Promise<string> {
    try {
      const backup: any = {
        timestamp: Date.now(),
        version: this.config.indexedDB.version,
        indexedDB: {},
        localStorage: {}
      };

      // Backup IndexedDB data
      if (this.db) {
        const storeNames = Array.from(this.db.objectStoreNames);
        for (const storeName of storeNames) {
          backup.indexedDB[storeName] = await this.retrieveAll(storeName);
        }
      }

      // Backup LocalStorage data
      const keys = Object.keys(localStorage);
      const prefix = this.config.localStorage.prefix;
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            backup.localStorage[key] = value;
          }
        }
      }

      return JSON.stringify(backup);
    } catch (error) {
      throw this._createError(OfflineErrorType.STORAGE_ERROR, 'Failed to create backup', error);
    }
  }

  async restore(backupData: string): Promise<void> {
    try {
      const backup = JSON.parse(backupData);

      // Clear existing data
      await this.clearAll();

      // Restore IndexedDB data
      if (backup.indexedDB) {
        for (const [storeName, data] of Object.entries(backup.indexedDB)) {
          if (Array.isArray(data)) {
            for (const item of data) {
              await this.store(storeName, item);
            }
          }
        }
      }

      // Restore LocalStorage data
      if (backup.localStorage) {
        for (const [key, value] of Object.entries(backup.localStorage)) {
          localStorage.setItem(key, value as string);
        }
      }

      console.log('Storage restored successfully');
    } catch (error) {
      throw this._createError(OfflineErrorType.STORAGE_ERROR, 'Failed to restore backup', error);
    }
  }

  // Private helper methods
  private _ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Offline storage not initialized. Call initialize() first.');
    }
  }

  private async _getRequest<T>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(request.error?.message || 'Unknown error'));
    });
  }

  private async _waitForTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(transaction.error?.message || 'Transaction error'));
    });
  }

  private async _encrypt(data: any): Promise<string> {
    if (!this.encryption.enabled) return JSON.stringify(data);

    try {
      // Simple encryption for demonstration
      // In production, use proper encryption libraries like Web Crypto API
      const serialized = JSON.stringify(data);
      const encoded = btoa(serialized);
      return `encrypted:${encoded}`;
    } catch (error) {
      console.warn('Encryption failed, storing unencrypted data:', error);
      return JSON.stringify(data);
    }
  }

  private async _decrypt<T>(data: string): Promise<T> {
    if (!this.encryption.enabled || !data.startsWith('encrypted:')) {
      return JSON.parse(data);
    }

    try {
      const encoded = data.substring(10); // Remove 'encrypted:' prefix
      const decoded = atob(encoded);
      return JSON.parse(decoded);
    } catch (error) {
      console.warn('Decryption failed, returning raw data:', error);
      return JSON.parse(data.substring(10));
    }
  }

  private _createError(type: OfflineErrorType, message: string, cause?: any): OfflineError {
    const error = new Error(message) as OfflineError;
    error.type = type;
    error.recoverable = type !== OfflineErrorType.QUOTA_EXCEEDED;
    error.details = { cause };
    return error;
  }
}

// Export singleton instance
let offlineStorageInstance: OfflineStorage | null = null;

export function getOfflineStorage(config?: StorageConfig, encryption?: EncryptionConfig): OfflineStorage {
  if (!offlineStorageInstance) {
    const defaultConfig: StorageConfig = {
      indexedDB: {
        dbName: 'kidFriendlyAI_Offline',
        version: 1,
        stores: {
          operations: {
            keyPath: 'id',
            autoIncrement: false,
            indexes: {
              timestamp: { keyPath: 'timestamp', unique: false, multiEntry: false },
              type: { keyPath: 'type', unique: false, multiEntry: false },
              status: { keyPath: 'status', unique: false, multiEntry: false }
            }
          },
          conversations: {
            keyPath: 'id',
            autoIncrement: true,
            indexes: {
              timestamp: { keyPath: 'timestamp', unique: false, multiEntry: false }
            }
          },
          gameProgress: {
            keyPath: 'id',
            autoIncrement: true,
            indexes: {
              gameId: { keyPath: 'gameId', unique: false, multiEntry: false },
              timestamp: { keyPath: 'timestamp', unique: false, multiEntry: false }
            }
          },
          stickers: {
            keyPath: 'id',
            autoIncrement: true,
            indexes: {
              earned: { keyPath: 'earned', unique: false, multiEntry: false }
            }
          },
          cache: {
            keyPath: 'key',
            autoIncrement: false,
            indexes: {
              timestamp: { keyPath: 'timestamp', unique: false, multiEntry: false },
              expiry: { keyPath: 'expiry', unique: false, multiEntry: false }
            }
          }
        }
      },
      localStorage: {
        prefix: 'kidFriendlyAI_',
        maxItems: 1000
      },
      cache: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 50 * 1024 * 1024, // 50MB
        strategy: 'cache_first' as any
      }
    };

    const defaultEncryption: EncryptionConfig = {
      enabled: false,
      algorithm: 'AES-GCM',
      keyRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
      sensitiveDataOnly: true
    };

    offlineStorageInstance = new OfflineStorage(
      config || defaultConfig,
      encryption || defaultEncryption
    );
  }

  return offlineStorageInstance;
}

// Export for testing
export { OfflineStorage };