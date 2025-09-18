/**
 * Bundle optimization utilities for the Kid-Friendly AI Assistant
 */

export interface BundleAnalysis {
  name: string;
  size: number;
  gzipSize: number;
  parseTime: number;
  gzipTime: number;
  modules: BundleModule[];
}

export interface BundleModule {
  name: string;
  size: number;
  percent: number;
  rendered: boolean;
  isAsync?: boolean;
}

export class BundleOptimizer {
  private static instance: BundleOptimizer;
  private bundleCache: Map<string, BundleAnalysis> = new Map();
  private optimizationCallbacks: Set<(analysis: BundleAnalysis) => void> = new Set();

  static getInstance(): BundleOptimizer {
    if (!BundleOptimizer.instance) {
      BundleOptimizer.instance = new BundleOptimizer();
    }
    return BundleOptimizer.instance;
  }

  /**
   * Analyze bundle size and performance
   */
  async analyzeBundle(bundlePath: string): Promise<BundleAnalysis> {
    const startTime = performance.now();

    try {
      // In a real implementation, this would use webpack-bundle-analyzer
      // For now, we'll simulate the analysis
      const analysis: BundleAnalysis = {
        name: bundlePath,
        size: Math.random() * 1000000, // Simulated size
        gzipSize: Math.random() * 300000, // Simulated gzip size
        parseTime: Math.random() * 100, // Simulated parse time
        gzipTime: Math.random() * 50, // Simulated gzip time
        modules: this.generateMockModules(),
      };

      this.bundleCache.set(bundlePath, analysis);
      this.notifyOptimizationCallbacks(analysis);

      return analysis;
    } catch (error) {
      console.error('Bundle analysis failed:', error);
      throw error;
    } finally {
      const duration = performance.now() - startTime;
      console.log(`Bundle analysis for ${bundlePath} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Generate mock modules for demonstration
   */
  private generateMockModules(): BundleModule[] {
    const moduleNames = [
      'react',
      'react-dom',
      'next',
      'openai',
      '@babel/runtime',
      'lodash',
      'framer-motion',
      'styled-components',
    ];

    return moduleNames.map(name => ({
      name,
      size: Math.random() * 100000,
      percent: Math.random() * 30,
      rendered: Math.random() > 0.3,
      isAsync: Math.random() > 0.7,
    }));
  }

  /**
   * Get optimization suggestions
   */
  getOptimizationSuggestions(analysis: BundleAnalysis): string[] {
    const suggestions: string[] = [];

    // Size-based suggestions
    if (analysis.size > 1000000) { // 1MB
      suggestions.push('Consider code splitting to reduce bundle size');
    }

    if (analysis.gzipSize > 300000) { // 300KB gzipped
      suggestions.push('Enable compression and optimize assets');
    }

    // Module-based suggestions
    const largeModules = analysis.modules.filter(m => m.size > 100000);
    if (largeModules.length > 0) {
      suggestions.push(`Large modules detected: ${largeModules.map(m => m.name).join(', ')}`);
    }

    const unusedModules = analysis.modules.filter(m => !m.rendered);
    if (unusedModules.length > 0) {
      suggestions.push('Remove unused dependencies');
    }

    // Performance-based suggestions
    if (analysis.parseTime > 50) {
      suggestions.push('Consider lazy loading for non-critical components');
    }

    if (analysis.gzipTime > 20) {
      suggestions.push('Optimize server compression settings');
    }

    return suggestions;
  }

  /**
   * Add optimization callback
   */
  addOptimizationCallback(callback: (analysis: BundleAnalysis) => void): void {
    this.optimizationCallbacks.add(callback);
  }

  /**
   * Remove optimization callback
   */
  removeOptimizationCallback(callback: (analysis: BundleAnalysis) => void): void {
    this.optimizationCallbacks.delete(callback);
  }

  /**
   * Notify optimization callbacks
   */
  private notifyOptimizationCallbacks(analysis: BundleAnalysis): void {
    this.optimizationCallbacks.forEach(callback => {
      try {
        callback(analysis);
      } catch (error) {
        console.error('Optimization callback error:', error);
      }
    });
  }

  /**
   * Get cached analysis
   */
  getCachedAnalysis(bundlePath: string): BundleAnalysis | undefined {
    return this.bundleCache.get(bundlePath);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.bundleCache.clear();
  }
}

/**
 * Dynamic import utilities
 */
export class DynamicImportManager {
  private static instance: DynamicImportManager;
  private loadedModules: Map<string, Promise<any>> = new Map();
  private preloadedModules: Set<string> = new Set();

  static getInstance(): DynamicImportManager {
    if (!DynamicImportManager.instance) {
      DynamicImportManager.instance = new DynamicImportManager();
    }
    return DynamicImportManager.instance;
  }

  /**
   * Dynamic import with caching
   */
  async dynamicImport<T>(modulePath: string): Promise<T> {
    if (!this.loadedModules.has(modulePath)) {
      const importPromise = this.loadModule<T>(modulePath);
      this.loadedModules.set(modulePath, importPromise);
    }

    return this.loadedModules.get(modulePath) as Promise<T>;
  }

  /**
   * Load module with error handling
   */
  private async loadModule<T>(modulePath: string): Promise<T> {
    const startTime = performance.now();

    try {
      const module = await import(/* webpackChunkName: "[request]" */ modulePath);
      const loadTime = performance.now() - startTime;

      console.log(`Dynamic import of ${modulePath} took ${loadTime.toFixed(2)}ms`);

      return module as T;
    } catch (error) {
      console.error(`Failed to dynamically import ${modulePath}:`, error);
      throw error;
    }
  }

  /**
   * Preload module
   */
  preloadModule(modulePath: string): void {
    if (!this.preloadedModules.has(modulePath)) {
      this.preloadedModules.add(modulePath);

      // Start loading in background
      this.dynamicImport(modulePath).catch(() => {
        // Preload failed, but that's okay
        this.preloadedModules.delete(modulePath);
      });
    }
  }

  /**
   * Check if module is preloaded
   */
  isPreloaded(modulePath: string): boolean {
    return this.preloadedModules.has(modulePath);
  }

  /**
   * Get loaded modules
   */
  getLoadedModules(): string[] {
    return Array.from(this.loadedModules.keys());
  }

  /**
   * Clear loaded modules
   */
  clearLoadedModules(): void {
    this.loadedModules.clear();
    this.preloadedModules.clear();
  }
}

/**
 * Resource preloading utilities
 */
export class ResourcePreloader {
  private static instance: ResourcePreloader;
  private preloadedResources: Set<string> = new Set();
  private preloadQueue: Array<{ url: string; priority: number }> = [];

  static getInstance(): ResourcePreloader {
    if (!ResourcePreloader.instance) {
      ResourcePreloader.instance = new ResourcePreloader();
    }
    return ResourcePreloader.instance;
  }

  /**
   * Preload critical resources
   */
  preloadCriticalResources(resources: string[]): void {
    resources.forEach(resource => {
      this.preload(resource, 'high');
    });
  }

  /**
   * Preload resource with priority
   */
  preload(url: string, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    if (this.preloadedResources.has(url)) {
      return;
    }

    const priorityValue = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;
    this.preloadQueue.push({ url, priority: priorityValue });

    // Sort queue by priority
    this.preloadQueue.sort((a, b) => b.priority - a.priority);

    this.processPreloadQueue();
  }

  /**
   * Process preload queue
   */
  private processPreloadQueue(): void {
    if (this.preloadQueue.length === 0) return;

    const { url } = this.preloadQueue.shift()!;

    if (this.preloadedResources.has(url)) {
      this.processPreloadQueue();
      return;
    }

    this.preloadedResources.add(url);

    if (typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = this.getResourceType(url);
      link.href = url;

      if (link.as === 'fetch') {
        link.crossOrigin = 'anonymous';
      }

      link.onload = () => {
        this.processPreloadQueue();
      };

      link.onerror = () => {
        console.warn(`Failed to preload resource: ${url}`);
        this.preloadedResources.delete(url);
        this.processPreloadQueue();
      };

      document.head.appendChild(link);
    }
  }

  /**
   * Determine resource type
   */
  private getResourceType(url: string): 'script' | 'style' | 'image' | 'font' | 'fetch' {
    const extension = url.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'js':
      case 'mjs':
        return 'script';
      case 'css':
        return 'style';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return 'image';
      case 'woff':
      case 'woff2':
      case 'ttf':
      case 'otf':
      case 'eot':
        return 'font';
      default:
        return 'fetch';
    }
  }

  /**
   * Preload fonts specifically
   */
  preloadFonts(fontUrls: string[]): void {
    fontUrls.forEach(url => {
      if (typeof window !== 'undefined' && !document.fonts?.has(url)) {
        const font = new FontFace(url.split('/').pop()!, `url(${url})`);
        font.load().then(loadedFont => {
          document.fonts.add(loadedFont);
        }).catch(error => {
          console.warn(`Failed to preload font ${url}:`, error);
        });
      }
    });
  }

  /**
   * Check if resource is preloaded
   */
  isPreloaded(url: string): boolean {
    return this.preloadedResources.has(url);
  }

  /**
   * Get preloaded resources
   */
  getPreloadedResources(): string[] {
    return Array.from(this.preloadedResources);
  }
}

/**
 * Critical CSS inlining utilities
 */
export class CriticalCSS {
  private static instance: CriticalCSS;
  private criticalStyles: Map<string, string> = new Map();

  static getInstance(): CriticalCSS {
    if (!CriticalCSS.instance) {
      CriticalCSS.instance = new CriticalCSS();
    }
    return CriticalCSS.instance;
  }

  /**
   * Extract critical CSS for a page
   */
  async extractCriticalCSS(pageUrl: string): Promise<string> {
    // In a real implementation, this would use a critical CSS extraction tool
    // For now, we'll return a minimal critical CSS
    return `
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
      .loading { opacity: 0.5; pointer-events: none; }
      .hidden { display: none; }
    `;
  }

  /**
   * Inline critical CSS
   */
  inlineCriticalCSS(css: string): void {
    if (typeof window === 'undefined') return;

    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-critical', 'true');
    document.head.insertBefore(style, document.head.firstChild);
  }

  /**
   * Load non-critical CSS asynchronously
   */
  loadNonCriticalCSS(cssUrl: string): void {
    if (typeof window === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    link.setAttribute('data-non-critical', 'true');
    link.media = 'print';
    link.onload = function() {
      this.media = 'all';
    };
    document.head.appendChild(link);
  }
}

// Export singleton instances
export const bundleOptimizer = BundleOptimizer.getInstance();
export const dynamicImportManager = DynamicImportManager.getInstance();
export const resourcePreloader = ResourcePreloader.getInstance();
export const criticalCSS = CriticalCSS.getInstance();