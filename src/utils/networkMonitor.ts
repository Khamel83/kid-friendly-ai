import {
  NetworkInfo,
  NetworkMetrics,
  NetworkQuality,
  ConnectionType,
  NetInfoEffectiveType
} from '../types/request';

export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private listeners: Set<(info: NetworkInfo) => void> = new Set();
  private currentInfo: NetworkInfo;
  private metrics: NetworkMetrics;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private connection: any = null;
  private lastOnlineTime = Date.now();
  private lastOfflineTime = 0;

  private constructor() {
    this.currentInfo = this.getInitialNetworkInfo();
    this.metrics = this.getInitialMetrics();
    this.initialize();
  }

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  private getInitialNetworkInfo(): NetworkInfo {
    return {
      online: navigator.onLine,
      effectiveType: '4g' as NetInfoEffectiveType,
      downlink: 10,
      rtt: 100,
      saveData: false,
      connectionType: 'unknown' as ConnectionType,
      reliability: 1,
      quality: 'excellent' as NetworkQuality
    };
  }

  private getInitialMetrics(): NetworkMetrics {
    return {
      connectionChanges: 0,
      offlineTime: 0,
      onlineTime: 0,
      averageLatency: 0,
      packetLoss: 0,
      bandwidthUsage: 0
    };
  }

  private initialize() {
    if (typeof window !== 'undefined') {
      this.setupEventListeners();
      this.setupNetworkInformationAPI();
      this.startMonitoring();
    }
  }

  private setupEventListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    window.addEventListener('focus', () => this.handleFocus());
  }

  private handleOnline() {
    if (!this.currentInfo.online) {
      this.metrics.offlineTime += Date.now() - this.lastOfflineTime;
      this.lastOnlineTime = Date.now();
      this.updateNetworkInfo({ ...this.currentInfo, online: true });
    }
  }

  private handleOffline() {
    if (this.currentInfo.online) {
      this.lastOfflineTime = Date.now();
      this.updateNetworkInfo({ ...this.currentInfo, online: false });
    }
  }

  private handleFocus() {
    this.refreshNetworkInfo();
  }

  private setupNetworkInformationAPI() {
    if ('connection' in navigator) {
      this.connection = (navigator as any).connection;
      this.setupConnectionListeners();
    }
  }

  private setupConnectionListeners() {
    if (!this.connection) return;

    this.connection.addEventListener('change', () => {
      this.refreshNetworkInfo();
    });
  }

  private startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.updateMetrics();
      this.performLatencyTest();
    }, 5000);
  }

  private stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private async performLatencyTest() {
    try {
      const startTime = Date.now();
      await this.pingEndpoint('https://www.google.com');
      const latency = Date.now() - startTime;

      this.metrics.averageLatency = this.metrics.averageLatency * 0.7 + latency * 0.3;
      this.updateNetworkInfo({ ...this.currentInfo, rtt: latency });
    } catch (error) {
      this.metrics.packetLoss = this.metrics.packetLoss * 0.9 + 0.1;
    }
  }

  private async pingEndpoint(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = `${url}/ping?${Date.now()}`;

      setTimeout(() => reject(), 3000);
    });
  }

  private refreshNetworkInfo() {
    const newInfo = this.getCurrentNetworkInfo();
    this.updateNetworkInfo(newInfo);
  }

  private getCurrentNetworkInfo(): NetworkInfo {
    const info = { ...this.currentInfo };
    info.online = navigator.onLine;

    if (this.connection) {
      info.effectiveType = this.connection.effectiveType || '4g';
      info.downlink = this.connection.downlink || 10;
      info.rtt = this.connection.rtt || 100;
      info.saveData = this.connection.saveData || false;
    }

    info.connectionType = this.detectConnectionType();
    info.reliability = this.calculateReliability(info);
    info.quality = this.calculateQuality(info);

    return info;
  }

  private detectConnectionType(): ConnectionType {
    if (!this.connection) return 'unknown';

    if (this.connection.type) {
      return this.connection.type;
    }

    return 'unknown';
  }

  private calculateReliability(info: NetworkInfo): number {
    let reliability = 1;

    if (!info.online) reliability *= 0;
    if (info.rtt > 1000) reliability *= 0.7;
    if (info.downlink < 1) reliability *= 0.8;
    if (info.effectiveType === '2g' || info.effectiveType === 'slow-2g') reliability *= 0.6;

    return Math.max(0, Math.min(1, reliability));
  }

  private calculateQuality(info: NetworkInfo): NetworkQuality {
    if (!info.online) return 'disconnected';
    if (info.reliability >= 0.9 && info.downlink >= 10 && info.rtt <= 100) return 'excellent';
    if (info.reliability >= 0.7 && info.downlink >= 5 && info.rtt <= 300) return 'good';
    if (info.reliability >= 0.5 && info.downlink >= 2 && info.rtt <= 500) return 'fair';
    return 'poor';
  }

  private updateNetworkInfo(newInfo: NetworkInfo) {
    const oldInfo = this.currentInfo;
    this.currentInfo = newInfo;

    if (oldInfo.online !== newInfo.online) {
      this.metrics.connectionChanges++;
    }

    if (newInfo.online) {
      this.metrics.onlineTime += Date.now() - this.lastOnlineTime;
    }

    this.notifyListeners();
  }

  private updateMetrics() {
    if (this.currentInfo.online) {
      this.metrics.bandwidthUsage = this.calculateBandwidthUsage();
    }
  }

  private calculateBandwidthUsage(): number {
    if ('performance' in window && 'memory' in (window as any).performance) {
      const memory = (window as any).performance.memory;
      return memory ? memory.usedJSHeapSize / 1024 / 1024 : 0;
    }
    return 0;
  }

  private notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentInfo);
      } catch (error) {
        console.error('Error in network monitor listener:', error);
      }
    });
  }

  subscribe(listener: (info: NetworkInfo) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentInfo);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getCurrentInfo(): NetworkInfo {
    return { ...this.currentInfo };
  }

  getMetrics(): NetworkMetrics {
    return { ...this.metrics };
  }

  isOnline(): boolean {
    return this.currentInfo.online;
  }

  isStableConnection(minReliability = 0.7): boolean {
    return this.currentInfo.online && this.currentInfo.reliability >= minReliability;
  }

  getOptimalRequestConfig(): {
    timeout: number;
    retryCount: number;
    batchSize: number;
    useCompression: boolean;
  } {
    const quality = this.currentInfo.quality;

    switch (quality) {
      case 'excellent':
        return { timeout: 30000, retryCount: 2, batchSize: 10, useCompression: false };
      case 'good':
        return { timeout: 45000, retryCount: 3, batchSize: 8, useCompression: true };
      case 'fair':
        return { timeout: 60000, retryCount: 4, batchSize: 5, useCompression: true };
      case 'poor':
        return { timeout: 90000, retryCount: 5, batchSize: 3, useCompression: true };
      default:
        return { timeout: 30000, retryCount: 2, batchSize: 5, useCompression: true };
    }
  }

  async waitForConnection(timeout = 30000): Promise<boolean> {
    if (this.isOnline()) return true;

    return new Promise((resolve) => {
      const unsubscribe = this.subscribe((info) => {
        if (info.online) {
          unsubscribe();
          resolve(true);
        }
      });

      setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeout);
    });
  }

  destroy() {
    this.stopMonitoring();
    this.listeners.clear();
  }
}

export const networkMonitor = NetworkMonitor.getInstance();

export const useNetworkMonitor = () => {
  const [networkInfo, setNetworkInfo] = useState(networkMonitor.getCurrentInfo());

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(setNetworkInfo);
    return unsubscribe;
  }, []);

  return {
    networkInfo,
    isOnline: networkInfo.isOnline(),
    isStable: networkInfo.isStableConnection(),
    getOptimalConfig: networkMonitor.getOptimalRequestConfig(),
    waitForConnection: networkMonitor.waitForConnection.bind(networkMonitor),
    metrics: networkMonitor.getMetrics()
  };
};

import { useState, useEffect } from 'react';