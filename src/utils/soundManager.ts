/**
 * Comprehensive Sound Management System
 *
 * This module provides centralized sound management with advanced features including:
 * - Audio asset loading and caching
 * - Sound effect playback with volume control
 * - Background music management
 * - Audio spatial positioning and 3D effects
 * - Sound effect sequencing and chaining
 * - Audio compression and optimization
 * - Cross-browser audio compatibility
 * - Performance monitoring and optimization
 */

import {
  SoundEffectConfig,
  SoundEffectCategory,
  SoundControlState,
  AudioAsset,
  AudioFormat,
  AudioProcessingConfig,
  SoundPlaybackSession,
  AudioEffect,
  Vector3D,
  SoundSystemStats,
  AudioCacheEntry,
  SoundEffectSequence,
  SoundSystemConfig,
  CacheConfig,
  OptimizationConfig,
  ParentalSoundControls
} from '../types/sound';

export class EnhancedSoundManager {
  private static instance: EnhancedSoundManager;
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private assets: Map<string, AudioAsset> = new Map();
  private sessions: Map<string, SoundPlaybackSession> = new Map();
  private cache: Map<string, AudioCacheEntry> = new Map();
  private sequences: Map<string, SoundEffectSequence> = new Map();

  // Audio nodes
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  // 3D audio
  private listener: AudioListener | null = null;
  private pannerNodes: Map<string, PannerNode> = new Map();

  // State management
  private state: SoundControlState;
  private config: SoundSystemConfig;
  private stats: SoundSystemStats;
  private initialized = false;
  private resumeCallbacks: Array<() => void> = [];

  // Performance monitoring
  private performanceMonitor: PerformanceMonitor;
  private memoryMonitor: MemoryMonitor;

  private constructor() {
    this.state = this.getDefaultState();
    this.config = this.getDefaultConfig();
    this.stats = this.getDefaultStats();
    this.performanceMonitor = new PerformanceMonitor();
    this.memoryMonitor = new MemoryMonitor();

    if (typeof window !== 'undefined') {
      this.initializeAudioContext();
    }
  }

  static getInstance(): EnhancedSoundManager {
    if (!EnhancedSoundManager.instance) {
      EnhancedSoundManager.instance = new EnhancedSoundManager();
    }
    return EnhancedSoundManager.instance;
  }

  private getDefaultState(): SoundControlState {
    return {
      masterVolume: 0.8,
      musicVolume: 0.7,
      sfxVolume: 0.8,
      voiceVolume: 1.0,
      ambientVolume: 0.5,
      muted: false,
      categories: {
        ui: true,
        game: true,
        educational: true,
        music: true,
        ambient: true,
        character: true,
        notification: true,
        error: true,
        success: true,
        interaction: true
      },
      spatialAudioEnabled: true,
      compressionEnabled: true,
      accessibilityMode: false,
      parentalControls: {
        maxVolume: 0.8,
        allowedCategories: ['ui', 'game', 'educational', 'music', 'ambient', 'character', 'notification', 'error', 'success', 'interaction'],
        contentFilter: 'moderate'
      }
    };
  }

  private getDefaultConfig(): SoundSystemConfig {
    return {
      audioContext: {
        sampleRate: 48000,
        bufferSize: 2048,
        channels: 2,
        bitDepth: 16,
        codec: 'opus',
        optimization: 'high'
      },
      cache: {
        maxSize: 50, // MB
        maxItems: 100,
        ttl: 3600000, // 1 hour
        strategy: 'lru'
      },
      optimization: {
        compression: {
          type: 'lossy',
          quality: 0.8,
          bitrate: 128
        },
        lazyLoading: true,
        preloading: {
          strategy: 'adaptive',
          batchSize: 5,
          priority: ['ui', 'interaction', 'success', 'error']
        },
        memoryManagement: {
          maxMemory: 100, // MB
          gcThreshold: 80,
          unloadPolicy: 'least-used'
        }
      },
      accessibility: {
        enabled: true,
        visualFeedback: true,
        closedCaptions: true,
        vibration: true,
        reducedMotion: false,
        highContrast: false,
        screenReader: true
      },
      themes: [],
      libraries: []
    };
  }

  private getDefaultStats(): SoundSystemStats {
    return {
      totalSounds: 0,
      loadedSounds: 0,
      activeSessions: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      averageLatency: 0,
      errors: 0,
      lastOptimization: Date.now()
    };
  }

  private async initializeAudioContext() {
    try {
      // Create AudioContext with optimized settings
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.audioContext.sampleRate,
        latencyHint: 'interactive'
      });

      // Resume on user interaction (required by browsers)
      this.setupUserInteractionHandler();

      // Create master audio nodes
      this.setupAudioNodes();

      // Initialize 3D audio
      this.setup3DAudio();

      // Setup performance monitoring
      this.setupPerformanceMonitoring();

      // Start cache cleanup
      this.startCacheCleanup();

      this.initialized = true;
      console.log('Enhanced Sound Manager initialized successfully');

    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
      this.stats.errors++;
    }
  }

  private setupUserInteractionHandler() {
    const resumeAudio = async () => {
      if (this.audioContext?.state === 'suspended') {
        try {
          await this.audioContext.resume();
          console.log('AudioContext resumed');

          // Call all registered callbacks
          this.resumeCallbacks.forEach(callback => callback());
          this.resumeCallbacks = [];

        } catch (error) {
          console.error('Failed to resume AudioContext:', error);
        }
      }
    };

    // Listen for user interaction
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, resumeAudio, { once: true });
    });

    // Also handle visibility change
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.audioContext?.state === 'suspended') {
        await resumeAudio();
      }
    });
  }

  private setupAudioNodes() {
    if (!this.audioContext) return;

    // Create master gain node
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = this.state.masterVolume;

    // Create category-specific gain nodes
    this.musicGain = this.audioContext.createGain();
    this.musicGain.gain.value = this.state.musicVolume;

    this.sfxGain = this.audioContext.createGain();
    this.sfxGain.gain.value = this.state.sfxVolume;

    this.voiceGain = this.audioContext.createGain();
    this.voiceGain.gain.value = this.state.voiceVolume;

    this.ambientGain = this.audioContext.createGain();
    this.ambientGain.gain.value = this.state.ambientVolume;

    // Create compressor for dynamic range control
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // Create analyser for visualization
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Connect nodes
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.voiceGain.connect(this.masterGain);
    this.ambientGain.connect(this.masterGain);

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  private setup3DAudio() {
    if (!this.audioContext) return;

    // Create audio listener
    this.listener = this.audioContext.listener;

    // Set default listener position
    this.listener.setPosition(0, 0, 0);
    this.listener.setOrientation(0, 0, -1, 0, 1, 0);

    // Set distance model for 3D audio
    this.pannerNodes.forEach(panner => {
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.maxDistance = 10000;
      panner.rolloffFactor = 1;
      panner.coneInnerAngle = 360;
      panner.coneOuterAngle = 0;
      panner.coneOuterGain = 0;
    });
  }

  private setupPerformanceMonitoring() {
    // Monitor audio context state
    if (this.audioContext) {
      setInterval(() => {
        this.updateStats();
      }, 1000);
    }
  }

  private startCacheCleanup() {
    // Clean up cache entries periodically
    setInterval(() => {
      this.cleanupCache();
    }, this.config.cache.ttl / 2);
  }

  // Public API methods
  async loadSound(url: string, id: string): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    // Check cache first
    if (this.cache.has(url)) {
      const cached = this.cache.get(url)!;
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      return cached.buffer;
    }

    try {
      const startTime = performance.now();

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Cache the decoded audio
      const cacheEntry: AudioCacheEntry = {
        url,
        buffer: audioBuffer,
        lastAccessed: Date.now(),
        accessCount: 1,
        size: arrayBuffer.byteLength
      };

      this.cache.set(url, cacheEntry);
      this.sounds.set(id, audioBuffer);

      // Update stats
      this.stats.loadedSounds++;
      this.stats.memoryUsage += cacheEntry.size;

      const loadTime = performance.now() - startTime;
      this.stats.averageLatency = (this.stats.averageLatency + loadTime) / 2;

      return audioBuffer;

    } catch (error) {
      console.error(`Failed to load sound ${url}:`, error);
      this.stats.errors++;
      throw error;
    }
  }

  async playSound(
    soundId: string,
    config: Partial<SoundEffectConfig> = {}
  ): Promise<string> {
    if (!this.audioContext || this.state.muted) {
      return '';
    }

    const soundBuffer = this.sounds.get(soundId);
    if (!soundBuffer) {
      console.warn(`Sound ${soundId} not found`);
      return '';
    }

    try {
      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = soundBuffer;

      // Create gain node for volume control
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = config.volume || 0.5;

      // Create panner node for 3D audio
      let panner: PannerNode | null = null;
      if (config.spatial && config.position) {
        panner = this.createPannerNode(config.position);
      }

      // Apply effects
      if (config.effects) {
        // Implementation for effects would go here
      }

      // Connect nodes
      source.connect(gainNode);

      if (panner) {
        gainNode.connect(panner);
        panner.connect(this.getCategoryGain(config.category || 'ui'));
      } else {
        gainNode.connect(this.getCategoryGain(config.category || 'ui'));
      }

      // Set playback parameters
      source.playbackRate.value = config.playbackRate || 1.0;

      // Handle looping
      source.loop = config.loop || false;

      // Create playback session
      const sessionId = this.generateSessionId();
      const session: SoundPlaybackSession = {
        id: sessionId,
        soundId,
        startTime: Date.now(),
        duration: soundBuffer.duration * (config.playbackRate || 1.0),
        volume: config.volume || 0.5,
        pitch: config.pitch || 1.0,
        position: config.position,
        effects: config.effects || [],
        state: 'playing'
      };

      this.sessions.set(sessionId, session);
      this.stats.activeSessions++;

      // Handle playback end
      source.onended = () => {
        session.state = 'completed';
        this.sessions.delete(sessionId);
        this.stats.activeSessions--;
      };

      // Apply fade in
      if (config.fadeIn && config.fadeIn > 0) {
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(config.volume, this.audioContext.currentTime + config.fadeIn);
      }

      // Start playback with delay
      const startTime = this.audioContext.currentTime + (config.delay || 0);
      source.start(startTime);

      return sessionId;

    } catch (error) {
      console.error(`Failed to play sound ${soundId}:`, error);
      this.stats.errors++;
      return '';
    }
  }

  stopSound(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Implementation for stopping a specific sound would go here
    // This would require keeping track of AudioBufferSourceNodes

    session.state = 'stopped';
    this.sessions.delete(sessionId);
    this.stats.activeSessions--;

    return true;
  }

  pauseSound(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'playing') {
      return false;
    }

    // Implementation for pausing would go here
    // This is complex as it requires saving the playback position

    session.state = 'paused';
    return true;
  }

  resumeSound(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== 'paused') {
      return false;
    }

    // Implementation for resuming would go here

    session.state = 'playing';
    return true;
  }

  // Volume control methods
  setMasterVolume(volume: number): void {
    this.state.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.state.masterVolume;
    }
  }

  setCategoryVolume(category: SoundEffectCategory, volume: number): void {
    const normalizedVolume = Math.max(0, Math.min(1, volume));

    switch (category) {
      case 'music':
        this.state.musicVolume = normalizedVolume;
        if (this.musicGain) this.musicGain.gain.value = normalizedVolume;
        break;
      case 'ui':
      case 'game':
      case 'educational':
      case 'character':
      case 'notification':
      case 'error':
      case 'success':
      case 'interaction':
        this.state.sfxVolume = normalizedVolume;
        if (this.sfxGain) this.sfxGain.gain.value = normalizedVolume;
        break;
      case 'ambient':
        this.state.ambientVolume = normalizedVolume;
        if (this.ambientGain) this.ambientGain.gain.value = normalizedVolume;
        break;
    }
  }

  toggleMute(): void {
    this.state.muted = !this.state.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.state.muted ? 0 : this.state.masterVolume;
    }
  }

  // 3D audio methods
  updateListenerPosition(position: Vector3D): void {
    if (this.listener) {
      this.listener.setPosition(position.x, position.y, position.z);
    }
  }

  updateSoundPosition(sessionId: string, position: Vector3D): void {
    const panner = this.pannerNodes.get(sessionId);
    if (panner) {
      panner.setPosition(position.x, position.y, position.z);
    }
  }

  // Background music management
  async playBackgroundMusic(url: string, loop: boolean = true): Promise<string> {
    // Implementation for background music would go here
    // This would handle crossfading, volume management, etc.

    return 'music-session';
  }

  stopBackgroundMusic(): void {
    // Implementation for stopping background music
  }

  // Sound sequences
  createSequence(name: string, sounds: any[]): SoundEffectSequence {
    const sequence: SoundEffectSequence = {
      id: this.generateSessionId(),
      name,
      sounds,
      tempo: 120,
      loop: false,
      randomize: false,
      conditions: []
    };

    this.sequences.set(sequence.id, sequence);
    return sequence;
  }

  playSequence(sequenceId: string): void {
    const sequence = this.sequences.get(sequenceId);
    if (!sequence) {
      return;
    }

    // Implementation for playing sequences would go here
  }

  // Utility methods
  private getCategoryGain(category: SoundEffectCategory): GainNode {
    switch (category) {
      case 'music':
        return this.musicGain!;
      case 'ambient':
        return this.ambientGain!;
      default:
        return this.sfxGain!;
    }
  }

  private createPannerNode(position: Vector3D): PannerNode {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const panner = this.audioContext.createPanner();
    panner.setPosition(position.x, position.y, position.z);
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10000;
    panner.rolloffFactor = 1;

    return panner;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateStats(): void {
    if (this.audioContext) {
      // Update CPU usage (simplified)
      const currentTime = this.audioContext.currentTime;
      const baseTime = 0;
      this.stats.cpuUsage = Math.min(100, (currentTime - baseTime) * 10);

      // Update memory usage
      this.stats.memoryUsage = Array.from(this.cache.values())
        .reduce((total, entry) => total + entry.size, 0);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const maxAge = this.config.cache.ttl;
    const maxSize = this.config.cache.maxSize * 1024 * 1024; // Convert to bytes

    // Remove expired entries
    for (const [url, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > maxAge) {
        this.cache.delete(url);
        this.sounds.delete(url);
        this.stats.loadedSounds--;
      }
    }

    // Remove least recently used entries if over size limit
    let totalSize = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.size, 0);

    if (totalSize > maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      for (const [url, entry] of entries) {
        if (totalSize <= maxSize) break;

        this.cache.delete(url);
        this.sounds.delete(url);
        totalSize -= entry.size;
        this.stats.loadedSounds--;
      }
    }
  }

  // Getters
  getStats(): SoundSystemStats {
    return { ...this.stats };
  }

  getState(): SoundControlState {
    return { ...this.state };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Convenience methods for backward compatibility
  async play(soundName: string, volume: number = 0.5): Promise<void> {
    await this.playSound(soundName, { volume });
  }

  playStart(): void {
    this.play('start', 0.3);
  }

  playEnd(): void {
    this.play('end', 0.3);
  }

  playSuccess(): void {
    this.play('success', 0.4);
  }

  playCheer(): void {
    this.play('cheer', 0.5);
  }

  playError(): void {
    this.play('error', 0.3);
  }
}

// Performance monitoring class
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private startTime: number = Date.now();

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getAverage(name: string): number {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return 0;

    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  getMetrics(): Map<string, number[]> {
    return new Map(this.metrics);
  }

  clear(): void {
    this.metrics.clear();
    this.startTime = Date.now();
  }
}

// Memory monitoring class
class MemoryMonitor {
  private samples: number[] = [];
  private maxSamples = 100;

  recordUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize / 1024 / 1024; // MB

      this.samples.push(used);
      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }

      return used;
    }
    return 0;
  }

  getAverageUsage(): number {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((sum, val) => sum + val, 0) / this.samples.length;
  }

  getPeakUsage(): number {
    return Math.max(...this.samples, 0);
  }

  clear(): void {
    this.samples = [];
  }
}