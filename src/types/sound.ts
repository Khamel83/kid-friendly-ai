/**
 * Sound System Type Definitions
 *
 * This file defines all the types and interfaces for the comprehensive sound effects system
 * in the kid-friendly-ai application.
 */

export interface SoundEffectConfig {
  id: string;
  name: string;
  category: SoundEffectCategory;
  volume: number;
  pitch: number;
  playbackRate: number;
  loop: boolean;
  spatial: boolean;
  position?: Vector3D;
  fadeIn?: number;
  fadeOut?: number;
  delay?: number;
  effects?: AudioEffect[];
  accessibility?: SoundAccessibilityConfig;
}

export type SoundEffectCategory =
  | 'ui'
  | 'game'
  | 'educational'
  | 'music'
  | 'ambient'
  | 'character'
  | 'notification'
  | 'error'
  | 'success'
  | 'interaction';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface AudioEffect {
  type: 'reverb' | 'delay' | 'filter' | 'distortion' | 'chorus' | 'flanger' | 'phaser';
  params: Record<string, number>;
}

export interface SoundAccessibilityConfig {
  visualFeedback: boolean;
  closedCaption: string;
  vibrationPattern?: number[];
  intensity: 'low' | 'medium' | 'high';
  alternativeFeedback?: boolean;
}

export interface AudioAsset {
  id: string;
  name: string;
  url: string;
  format: AudioFormat;
  size: number;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  bitrate?: number;
  compression?: AudioCompression;
  metadata?: AudioMetadata;
  loaded: boolean;
  error?: string;
}

export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'aac' | 'flac' | 'webm';

export interface AudioCompression {
  type: 'lossy' | 'lossless';
  quality: number; // 0-1
  bitrate: number; // kbps
}

export interface AudioMetadata {
  artist?: string;
  title?: string;
  album?: string;
  genre?: string;
  year?: number;
  description?: string;
  tags?: string[];
}

export interface SoundControlState {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  ambientVolume: number;
  muted: boolean;
  categories: Record<SoundEffectCategory, boolean>;
  spatialAudioEnabled: boolean;
  compressionEnabled: boolean;
  accessibilityMode: boolean;
  parentalControls: ParentalSoundControls;
}

export interface ParentalSoundControls {
  maxVolume: number;
  allowedCategories: SoundEffectCategory[];
  contentFilter: 'strict' | 'moderate' | 'none';
  timeLimits?: {
    startTime: string;
    endTime: string;
  };
  dailyLimit?: number; // minutes
}

export interface SoundLibrary {
  id: string;
  name: string;
  description: string;
  sounds: SoundEffectConfig[];
  categories: SoundEffectCategory[];
  version: string;
  size: number;
  compression: AudioCompression;
}

export interface AudioProcessingConfig {
  sampleRate: number;
  bufferSize: number;
  channels: number;
  bitDepth: number;
  codec: string;
  optimization: AudioOptimizationLevel;
}

export type AudioOptimizationLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface SoundPlaybackSession {
  id: string;
  soundId: string;
  startTime: number;
  duration: number;
  volume: number;
  pitch: number;
  position?: Vector3D;
  effects: AudioEffect[];
  state: 'playing' | 'paused' | 'stopped' | 'completed';
}

export interface SoundMixerConfig {
  tracks: MixerTrack[];
  masterEffects: AudioEffect[];
  routing: AudioRouting[];
  automation: AutomationPoint[];
}

export interface MixerTrack {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'effect';
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  effects: AudioEffect[];
  sends: TrackSend[];
}

export interface TrackSend {
  targetTrackId: string;
  amount: number;
  preFader: boolean;
}

export interface AudioRouting {
  source: string;
  destination: string;
  type: 'send' | 'insert' | 'sidechain';
  amount: number;
}

export interface AutomationPoint {
  parameter: string;
  time: number;
  value: number;
  curve: 'linear' | 'exponential' | 'logarithmic';
  trackId?: string;
}

export interface ProceduralSoundConfig {
  type: 'noise' | 'tone' | 'chord' | 'sequence' | 'ambient';
  params: Record<string, number>;
  duration: number;
  envelope: ADSREnvelope;
  modulation?: ModulationConfig;
}

export interface ADSREnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  peak: number;
}

export interface ModulationConfig {
  type: 'lfo' | 'envelope' | 'random';
  target: string;
  amount: number;
  rate: number;
}

export interface SoundTheme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  sounds: SoundEffectConfig[];
  music: BackgroundMusicConfig[];
  ambient: AmbientSoundConfig[];
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export interface BackgroundMusicConfig {
  id: string;
  name: string;
  url: string;
  loop: boolean;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  crossfadeTime: number;
}

export interface AmbientSoundConfig {
  id: string;
  name: string;
  url: string;
  volume: number;
  loop: boolean;
  spatial: boolean;
  radius: number;
  falloff: number;
}

export interface SoundSystemStats {
  totalSounds: number;
  loadedSounds: number;
  activeSessions: number;
  memoryUsage: number;
  cpuUsage: number;
  averageLatency: number;
  errors: number;
  lastOptimization: number;
}

export interface AudioCacheEntry {
  url: string;
  buffer: AudioBuffer;
  lastAccessed: number;
  accessCount: number;
  size: number;
}

export interface SoundEffectSequence {
  id: string;
  name: string;
  sounds: SequenceSound[];
  tempo: number;
  loop: boolean;
  randomize: boolean;
  conditions: PlaybackCondition[];
}

export interface SequenceSound {
  soundId: string;
  delay: number;
  duration?: number;
  volume: number;
  pitch: number;
  effects: AudioEffect[];
}

export interface PlaybackCondition {
  type: 'time' | 'event' | 'state' | 'probability';
  condition: string;
  value: any;
}

export interface SoundSystemConfig {
  audioContext: AudioProcessingConfig;
  cache: CacheConfig;
  optimization: OptimizationConfig;
  accessibility: AccessibilityConfig;
  themes: SoundTheme[];
  libraries: SoundLibrary[];
}

export interface CacheConfig {
  maxSize: number; // MB
  maxItems: number;
  ttl: number; // milliseconds
  strategy: 'lru' | 'fifo' | 'lfu';
}

export interface OptimizationConfig {
  compression: AudioCompression;
  lazyLoading: boolean;
  preloading: PreloadStrategy;
  memoryManagement: MemoryManagement;
}

export interface PreloadStrategy {
  strategy: 'eager' | 'lazy' | 'adaptive';
  batchSize: number;
  priority: string[];
}

export interface MemoryManagement {
  maxMemory: number; // MB
  gcThreshold: number; // percentage
  unloadPolicy: 'oldest' | 'least-used' | 'all';
}

export interface AccessibilityConfig {
  enabled: boolean;
  visualFeedback: boolean;
  closedCaptions: boolean;
  vibration: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  screenReader: boolean;
}