/**
 * React Hooks for Sound Effects
 *
 * This module provides React hooks for managing sound effects with:
 * - Sound effect state management
 * - Trigger-based sound playback
 * - Volume and pitch control
 * - Sound effect libraries and categories
 * - Accessibility considerations for hearing impaired
 * - Parental volume control integration
 * - Sound effect preferences and memory
 * - Performance-optimized playback
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EnhancedSoundManager } from '../utils/soundManager';
import {
  SoundEffectConfig,
  SoundEffectCategory,
  SoundControlState,
  SoundPlaybackSession,
  SoundLibrary,
  ParentalSoundControls,
  Vector3D
} from '../types/sound';

interface SoundEffectHookOptions {
  preload?: boolean;
  category?: SoundEffectCategory;
  volume?: number;
  spatial?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
}

interface UseSoundEffectReturn {
  play: (config?: Partial<SoundEffectConfig>) => Promise<string>;
  stop: (sessionId?: string) => boolean;
  pause: (sessionId?: string) => boolean;
  resume: (sessionId?: string) => boolean;
  setVolume: (volume: number) => void;
  setPitch: (pitch: number) => void;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  sessionId: string | null;
}

interface UseSoundLibraryReturn {
  library: SoundLibrary | null;
  sounds: SoundEffectConfig[];
  loadLibrary: (libraryId: string) => Promise<void>;
  playSound: (soundId: string) => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

interface UseSoundControlsReturn {
  state: SoundControlState;
  setMasterVolume: (volume: number) => void;
  setCategoryVolume: (category: SoundEffectCategory, volume: number) => void;
  toggleMute: () => void;
  setCategoryEnabled: (category: SoundEffectCategory, enabled: boolean) => void;
  isMuted: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
}

interface UseSoundAccessibilityReturn {
  visualFeedback: boolean;
  closedCaptions: boolean;
  vibrationEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  screenReader: boolean;
  setVisualFeedback: (enabled: boolean) => void;
  setClosedCaptions: (enabled: boolean) => void;
  setVibrationEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  setScreenReader: (enabled: boolean) => void;
  triggerVibration: (pattern: number[]) => void;
  showVisualFeedback: (type: string, message: string) => void;
}

interface UseSoundPreferencesReturn {
  preferences: SoundPreferences;
  savePreferences: (preferences: Partial<SoundPreferences>) => void;
  resetPreferences: () => void;
  isLoading: boolean;
}

interface SoundPreferences {
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
  lastUsedSounds: string[];
  favoriteSounds: string[];
}

// Main hook for individual sound effects
export function useSoundEffect(
  soundId: string,
  options: SoundEffectHookOptions = {}
): UseSoundEffectReturn {
  const soundManager = useRef<EnhancedSoundManager | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const currentSessionRef = useRef<string | null>(null);

  // Initialize sound manager
  useEffect(() => {
    try {
      soundManager.current = EnhancedSoundManager.getInstance();

      if (options.preload) {
        loadSound();
      }
    } catch (err) {
      setError('Failed to initialize sound manager');
      console.error('Sound manager initialization failed:', err);
    }
  }, [options.preload]);

  // Auto-play if enabled
  useEffect(() => {
    if (options.autoPlay && soundManager.current && !error) {
      play();
    }
  }, [options.autoPlay, error]);

  const loadSound = useCallback(async () => {
    if (!soundManager.current || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // In a real implementation, you'd load the sound from a URL
      // For now, we'll assume the sound is already loaded
      console.log(`Loading sound: ${soundId}`);
    } catch (err) {
      setError(`Failed to load sound ${soundId}`);
      console.error(`Failed to load sound ${soundId}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [soundId, isLoading]);

  const play = useCallback(async (config: Partial<SoundEffectConfig> = {}): Promise<string> => {
    if (!soundManager.current || isLoading) {
      return '';
    }

    try {
      setIsLoading(true);
      setError(null);

      const playConfig: SoundEffectConfig = {
        id: soundId,
        name: soundId,
        category: options.category || 'ui',
        volume: config.volume || options.volume || 0.5,
        pitch: config.pitch || 1,
        playbackRate: config.playbackRate || 1,
        loop: config.loop || options.loop || false,
        spatial: config.spatial || options.spatial || false,
        ...config
      };

      const newSessionId = await soundManager.current.playSound(soundId, playConfig);

      if (newSessionId) {
        setIsPlaying(true);
        setSessionId(newSessionId);
        currentSessionRef.current = newSessionId;

        // Simulate playback end for demonstration
        setTimeout(() => {
          setIsPlaying(false);
          setSessionId(null);
          currentSessionRef.current = null;
        }, 2000); // 2 seconds for demo
      }

      return newSessionId;
    } catch (err) {
      setError(`Failed to play sound ${soundId}`);
      console.error(`Failed to play sound ${soundId}:`, err);
      setIsPlaying(false);
      return '';
    } finally {
      setIsLoading(false);
    }
  }, [soundId, options.category, options.volume, options.spatial, options.loop, isLoading]);

  const stop = useCallback((targetSessionId?: string): boolean => {
    if (!soundManager.current) return false;

    const sessionToStop = targetSessionId || currentSessionRef.current;
    if (sessionToStop) {
      const success = soundManager.current.stopSound(sessionToStop);
      if (success) {
        setIsPlaying(false);
        setSessionId(null);
        currentSessionRef.current = null;
      }
      return success;
    }
    return false;
  }, []);

  const pause = useCallback((targetSessionId?: string): boolean => {
    if (!soundManager.current) return false;

    const sessionToPause = targetSessionId || currentSessionRef.current;
    if (sessionToPause) {
      const success = soundManager.current.pauseSound(sessionToPause);
      if (success) {
        setIsPlaying(false);
      }
      return success;
    }
    return false;
  }, []);

  const resume = useCallback((targetSessionId?: string): boolean => {
    if (!soundManager.current) return false;

    const sessionToResume = targetSessionId || currentSessionRef.current;
    if (sessionToResume) {
      const success = soundManager.current.resumeSound(sessionToResume);
      if (success) {
        setIsPlaying(true);
      }
      return success;
    }
    return false;
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (soundManager.current) {
      soundManager.current.setCategoryVolume(options.category || 'ui', volume);
    }
  }, [options.category]);

  const setPitch = useCallback((pitch: number) => {
    // Pitch control would be implemented in the sound manager
    console.log(`Setting pitch to ${pitch}`);
  }, []);

  return {
    play,
    stop,
    pause,
    resume,
    setVolume,
    setPitch,
    isPlaying,
    isLoading,
    error,
    sessionId
  };
}

// Hook for managing sound libraries
export function useSoundLibrary(libraryId?: string): UseSoundLibraryReturn {
  const soundManager = useRef<EnhancedSoundManager | null>(null);
  const [library, setLibrary] = useState<SoundLibrary | null>(null);
  const [sounds, setSounds] = useState<SoundEffectConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      soundManager.current = EnhancedSoundManager.getInstance();
    } catch (err) {
      setError('Failed to initialize sound manager');
      console.error('Sound manager initialization failed:', err);
    }
  }, []);

  const loadLibrary = useCallback(async (libId: string) => {
    if (!soundManager.current || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // In a real implementation, you'd load the library from an API
      console.log(`Loading library: ${libId}`);

      // Demo library data
      const demoLibrary: SoundLibrary = {
        id: libId,
        name: 'Demo Sound Library',
        description: 'A collection of demo sounds',
        sounds: [
          { id: 'click', name: 'Click Sound', category: 'ui', volume: 0.5, pitch: 1, playbackRate: 1, loop: false, spatial: false },
          { id: 'success', name: 'Success Sound', category: 'success', volume: 0.6, pitch: 1, playbackRate: 1, loop: false, spatial: false },
          { id: 'error', name: 'Error Sound', category: 'error', volume: 0.4, pitch: 1, playbackRate: 1, loop: false, spatial: false }
        ],
        categories: ['ui', 'success', 'error'],
        version: '1.0.0',
        size: 1024,
        compression: { type: 'lossy', quality: 0.8, bitrate: 128 }
      };

      setLibrary(demoLibrary);
      setSounds(demoLibrary.sounds);
    } catch (err) {
      setError(`Failed to load library ${libId}`);
      console.error(`Failed to load library ${libId}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const playSound = useCallback(async (soundId: string): Promise<string> => {
    if (!soundManager.current) return '';

    try {
      return await soundManager.current.playSound(soundId);
    } catch (err) {
      setError(`Failed to play sound ${soundId}`);
      console.error(`Failed to play sound ${soundId}:`, err);
      return '';
    }
  }, []);

  // Auto-load library if provided
  useEffect(() => {
    if (libraryId) {
      loadLibrary(libraryId);
    }
  }, [libraryId, loadLibrary]);

  return {
    library,
    sounds,
    loadLibrary,
    playSound,
    isLoading,
    error
  };
}

// Hook for global sound controls
export function useSoundControls(): UseSoundControlsReturn {
  const soundManager = useRef<EnhancedSoundManager | null>(null);
  const [state, setState] = useState<SoundControlState | null>(null);

  useEffect(() => {
    try {
      soundManager.current = EnhancedSoundManager.getInstance();
      if (soundManager.current) {
        setState(soundManager.current.getState());
      }
    } catch (err) {
      console.error('Sound manager initialization failed:', err);
    }
  }, []);

  const setMasterVolume = useCallback((volume: number) => {
    if (soundManager.current) {
      soundManager.current.setMasterVolume(volume);
      setState(soundManager.current.getState());
    }
  }, []);

  const setCategoryVolume = useCallback((category: SoundEffectCategory, volume: number) => {
    if (soundManager.current) {
      soundManager.current.setCategoryVolume(category, volume);
      setState(soundManager.current.getState());
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (soundManager.current) {
      soundManager.current.toggleMute();
      setState(soundManager.current.getState());
    }
  }, []);

  const setCategoryEnabled = useCallback((category: SoundEffectCategory, enabled: boolean) => {
    if (soundManager.current && state) {
      const newState = { ...state };
      newState.categories[category] = enabled;
      setState(newState);
    }
  }, [state]);

  if (!state) {
    return {
      state: {
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
      },
      setMasterVolume,
      setCategoryVolume,
      toggleMute,
      setCategoryEnabled,
      isMuted: false,
      masterVolume: 0.8,
      sfxVolume: 0.8,
      musicVolume: 0.7
    };
  }

  return {
    state,
    setMasterVolume,
    setCategoryVolume,
    toggleMute,
    setCategoryEnabled,
    isMuted: state.muted,
    masterVolume: state.masterVolume,
    sfxVolume: state.sfxVolume,
    musicVolume: state.musicVolume
  };
}

// Hook for sound accessibility features
export function useSoundAccessibility(): UseSoundAccessibilityReturn {
  const [visualFeedback, setVisualFeedback] = useState(true);
  const [closedCaptions, setClosedCaptions] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  // Load preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('soundAccessibility');
        if (saved) {
          const prefs = JSON.parse(saved);
          setVisualFeedback(prefs.visualFeedback ?? true);
          setClosedCaptions(prefs.closedCaptions ?? true);
          setVibrationEnabled(prefs.vibrationEnabled ?? true);
          setReducedMotion(prefs.reducedMotion ?? false);
          setHighContrast(prefs.highContrast ?? false);
          setScreenReader(prefs.screenReader ?? false);
        }
      } catch (err) {
        console.error('Failed to load accessibility preferences:', err);
      }
    }
  }, []);

  // Save preferences to localStorage
  const savePreference = useCallback((key: string, value: any) => {
    if (typeof window !== 'undefined') {
      try {
        const current = localStorage.getItem('soundAccessibility');
        const prefs = current ? JSON.parse(current) : {};
        prefs[key] = value;
        localStorage.setItem('soundAccessibility', JSON.stringify(prefs));
      } catch (err) {
        console.error('Failed to save accessibility preference:', err);
      }
    }
  }, []);

  const wrappedSetVisualFeedback = useCallback((enabled: boolean) => {
    setVisualFeedback(enabled);
    savePreference('visualFeedback', enabled);
  }, [savePreference]);

  const wrappedSetClosedCaptions = useCallback((enabled: boolean) => {
    setClosedCaptions(enabled);
    savePreference('closedCaptions', enabled);
  }, [savePreference]);

  const wrappedSetVibrationEnabled = useCallback((enabled: boolean) => {
    setVibrationEnabled(enabled);
    savePreference('vibrationEnabled', enabled);
  }, [savePreference]);

  const wrappedSetReducedMotion = useCallback((enabled: boolean) => {
    setReducedMotion(enabled);
    savePreference('reducedMotion', enabled);
  }, [savePreference]);

  const wrappedSetHighContrast = useCallback((enabled: boolean) => {
    setHighContrast(enabled);
    savePreference('highContrast', enabled);
  }, [savePreference]);

  const wrappedSetScreenReader = useCallback((enabled: boolean) => {
    setScreenReader(enabled);
    savePreference('screenReader', enabled);
  }, [savePreference]);

  const triggerVibration = useCallback((pattern: number[]) => {
    if (vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, [vibrationEnabled]);

  const showVisualFeedback = useCallback((type: string, message: string) => {
    if (!visualFeedback) return;

    // Create visual feedback element
    const feedback = document.createElement('div');
    feedback.className = `sound-feedback ${type}`;
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 15px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      border-radius: 5px;
      font-size: 14px;
      z-index: 1000;
      animation: fadeInOut 2s ease-in-out;
    `;

    document.body.appendChild(feedback);

    // Remove after animation
    setTimeout(() => {
      feedback.remove();
    }, 2000);
  }, [visualFeedback]);

  return {
    visualFeedback,
    closedCaptions,
    vibrationEnabled,
    reducedMotion,
    highContrast,
    screenReader,
    setVisualFeedback: wrappedSetVisualFeedback,
    setClosedCaptions: wrappedSetClosedCaptions,
    setVibrationEnabled: wrappedSetVibrationEnabled,
    setReducedMotion: wrappedSetReducedMotion,
    setHighContrast: wrappedSetHighContrast,
    setScreenReader: wrappedSetScreenReader,
    triggerVibration,
    showVisualFeedback
  };
}

// Hook for sound preferences
export function useSoundPreferences(): UseSoundPreferencesReturn {
  const [preferences, setPreferences] = useState<SoundPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('soundPreferences');
          if (saved) {
            setPreferences(JSON.parse(saved));
          } else {
            // Use default preferences
            setPreferences({
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
              },
              lastUsedSounds: [],
              favoriteSounds: []
            });
          }
        }
      } catch (err) {
        console.error('Failed to load sound preferences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const savePreferences = useCallback((newPreferences: Partial<SoundPreferences>) => {
    if (!preferences) return;

    try {
      const updated = { ...preferences, ...newPreferences };
      setPreferences(updated);

      if (typeof window !== 'undefined') {
        localStorage.setItem('soundPreferences', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('Failed to save sound preferences:', err);
    }
  }, [preferences]);

  const resetPreferences = useCallback(() => {
    try {
      localStorage.removeItem('soundPreferences');
      setPreferences(null);
      setIsLoading(true);
    } catch (err) {
      console.error('Failed to reset sound preferences:', err);
    }
  }, []);

  return {
    preferences: preferences || {
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
      },
      lastUsedSounds: [],
      favoriteSounds: []
    },
    savePreferences,
    resetPreferences,
    isLoading
  };
}

// Hook for 3D audio positioning
export function use3DAudio(initialPosition?: Vector3D) {
  const [position, setPosition] = useState<Vector3D>(initialPosition || { x: 0, y: 0, z: 0 });
  const soundManager = useRef<EnhancedSoundManager | null>(null);

  useEffect(() => {
    try {
      soundManager.current = EnhancedSoundManager.getInstance();
    } catch (err) {
      console.error('Sound manager initialization failed:', err);
    }
  }, []);

  const updatePosition = useCallback((newPosition: Vector3D) => {
    setPosition(newPosition);
    if (soundManager.current) {
      soundManager.current.updateListenerPosition(newPosition);
    }
  }, []);

  const playSpatialSound = useCallback(async (soundId: string, soundPosition: Vector3D) => {
    if (soundManager.current) {
      return await soundManager.current.playSound(soundId, {
        spatial: true,
        position: soundPosition
      });
    }
    return '';
  }, []);

  return {
    position,
    updatePosition,
    playSpatialSound
  };
}

// Hook for sound sequences
export function useSoundSequence(name: string) {
  const soundManager = useRef<EnhancedSoundManager | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    try {
      soundManager.current = EnhancedSoundManager.getInstance();
    } catch (err) {
      console.error('Sound manager initialization failed:', err);
    }
  }, []);

  const createSequence = useCallback((sounds: any[]) => {
    if (soundManager.current) {
      return soundManager.current.createSequence(name, sounds);
    }
    return null;
  }, [name]);

  const playSequence = useCallback((sequenceId: string) => {
    if (soundManager.current) {
      setIsPlaying(true);
      soundManager.current.playSequence(sequenceId);

      // Simulate sequence completion
      setTimeout(() => setIsPlaying(false), 3000);
    }
  }, []);

  return {
    isPlaying,
    createSequence,
    playSequence
  };
}