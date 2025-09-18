/**
 * Enhanced React Hook for Speech Recognition
 * Provides advanced speech-to-text functionality with state management,
 * audio monitoring, and accessibility features
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SpeechController, SpeechRecognitionConfig, SpeechRecognitionResult, SpeechRecognitionEvent, AudioVisualizationData } from '../controllers/speechController';

export interface SpeechRecognitionState {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  confidence: number;
  audioLevel: number;
  isVoiceActive: boolean;
  error: string | null;
  language: string;
  privacyMode: 'local' | 'cloud';
}

export interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  maxRecordingDuration?: number;
  silenceTimeout?: number;
  autoStart?: boolean;
  onResult?: (result: SpeechRecognitionResult) => void;
  onError?: (error: Error) => void;
  onVoiceActivity?: (active: boolean) => void;
}

export interface KeyboardShortcuts {
  toggleRecording?: string; // e.g., 'Space', 'Control+Space'
  stopRecording?: string;
  privacyToggle?: string;
}

export interface AccessibilityOptions {
  announceResults?: boolean;
  screenReaderSupport?: boolean;
  keyboardShortcuts?: KeyboardShortcuts;
  highContrastMode?: boolean;
  largeButtons?: boolean;
}

export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {},
  accessibility: AccessibilityOptions = {}
) => {
  const [state, setState] = useState<SpeechRecognitionState>({
    isRecording: false,
    isProcessing: false,
    transcript: '',
    confidence: 0,
    audioLevel: 0,
    isVoiceActive: false,
    error: null,
    language: 'en-US',
    privacyMode: 'cloud'
  });

  const [visualizationData, setVisualizationData] = useState<AudioVisualizationData>({
    frequencyData: new Float32Array(64),
    audioLevel: 0,
    isVoiceActive: false,
    peakLevel: 0
  });

  const [performanceStats, setPerformanceStats] = useState({
    processingTime: 0,
    recordingDuration: 0,
    chunksProcessed: 0,
    voiceActivityRatio: 0
  });

  const controllerRef = useRef<SpeechController | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Initialize speech controller
  useEffect(() => {
    const config: SpeechRecognitionConfig = {
      noiseReduction: 0.5,
      voiceThreshold: 0.3,
      gain: 1.0,
      language: state.language,
      autoLanguageDetection: true,
      continuous: options.continuous || false,
      interimResults: options.interimResults || true,
      maxRecordingDuration: options.maxRecordingDuration || 30,
      silenceTimeout: options.silenceTimeout || 2,
      privacyMode: state.privacyMode
    };

    const controller = new SpeechController(config);
    controllerRef.current = controller;

    // Set up event listeners
    controller.addEventListener('start', (event) => {
      if (!isMountedRef.current) return;
      setState(prev => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
        error: null
      }));
    });

    controller.addEventListener('stop', (event) => {
      if (!isMountedRef.current) return;
      setState(prev => ({
        ...prev,
        isRecording: false,
        isProcessing: true
      }));
    });

    controller.addEventListener('result', (event) => {
      if (!isMountedRef.current) return;
      const result = event.data as SpeechRecognitionResult;

      setState(prev => ({
        ...prev,
        transcript: result.transcript,
        confidence: result.confidence,
        isProcessing: false,
        language: result.language || prev.language
      }));

      options.onResult?.(result);

      // Announce result for screen readers
      if (accessibility.announceResults) {
        announceToScreenReader(result.transcript);
      }
    });

    controller.addEventListener('error', (event) => {
      if (!isMountedRef.current) return;
      const error = event.data.error;
      setState(prev => ({
        ...prev,
        isRecording: false,
        isProcessing: false,
        error: error.message || 'Speech recognition error'
      }));

      options.onError?.(new Error(error.message));
    });

    controller.addEventListener('audioLevel', (event) => {
      if (!isMountedRef.current) return;
      const { level, peak } = event.data;
      setState(prev => ({
        ...prev,
        audioLevel: level
      }));
    });

    controller.addEventListener('voiceActivity', (event) => {
      if (!isMountedRef.current) return;
      const { active } = event.data;
      setState(prev => ({
        ...prev,
        isVoiceActive: active
      }));

      options.onVoiceActivity?.(active);
    });

    // Auto-start if requested
    if (options.autoStart) {
      startRecording().catch(console.error);
    }

    return () => {
      isMountedRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      controller.cleanup();
    };
  }, []);

  // Set up keyboard shortcuts
  useEffect(() => {
    if (!accessibility.keyboardShortcuts) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const shortcuts = accessibility.keyboardShortcuts!;

      // Toggle recording
      if (shortcuts.toggleRecording && matchesShortcut(event, shortcuts.toggleRecording)) {
        event.preventDefault();
        toggleRecording();
      }

      // Stop recording
      if (shortcuts.stopRecording && matchesShortcut(event, shortcuts.stopRecording)) {
        event.preventDefault();
        stopRecording();
      }

      // Toggle privacy mode
      if (shortcuts.privacyToggle && matchesShortcut(event, shortcuts.privacyToggle)) {
        event.preventDefault();
        togglePrivacyMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accessibility.keyboardShortcuts]);

  // Animation loop for visualization updates
  useEffect(() => {
    const updateVisualization = () => {
      if (controllerRef.current && state.isRecording) {
        const data = controllerRef.current.getVisualizationData();
        setVisualizationData(data);

        const stats = controllerRef.current.getPerformanceStats();
        setPerformanceStats(stats);
      }

      if (isMountedRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateVisualization);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateVisualization);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.isRecording]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!controllerRef.current) return;

    try {
      setState(prev => ({ ...prev, error: null }));
      await controllerRef.current.startRecording();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to start recording'
      }));
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!controllerRef.current) return;

    try {
      await controllerRef.current.stopRecording();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to stop recording'
      }));
    }
  }, []);

  // Toggle recording
  const toggleRecording = useCallback(async () => {
    if (state.isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  // Update language
  const setLanguage = useCallback((language: string) => {
    if (!controllerRef.current) return;

    setState(prev => ({ ...prev, language }));
    controllerRef.current.updateConfig({ language });
  }, []);

  // Toggle privacy mode
  const togglePrivacyMode = useCallback(() => {
    if (!controllerRef.current) return;

    const newMode = state.privacyMode === 'cloud' ? 'local' : 'cloud';
    setState(prev => ({ ...prev, privacyMode: newMode }));
    controllerRef.current.updateConfig({ privacyMode: newMode });

    // Announce privacy mode change
    announceToScreenReader(`Privacy mode set to ${newMode}`);
  }, [state.privacyMode]);

  // Update configuration
  const updateConfig = useCallback((config: Partial<SpeechRecognitionConfig>) => {
    if (!controllerRef.current) return;
    controllerRef.current.updateConfig(config);
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState({
      isRecording: false,
      isProcessing: false,
      transcript: '',
      confidence: 0,
      audioLevel: 0,
      isVoiceActive: false,
      error: null,
      language: 'en-US',
      privacyMode: 'cloud'
    });
  }, []);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setState(prev => ({ ...prev, transcript: '', confidence: 0 }));
  }, []);

  // Get microphone permission status
  const getMicrophonePermission = useCallback(async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permission.state;
    } catch {
      return 'prompt';
    }
  }, []);

  // Request microphone permission
  const requestMicrophonePermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }, []);

  // Check browser support
  const isBrowserSupported = useCallback(() => {
    return typeof window !== 'undefined' &&
           'webkitSpeechRecognition' in window ||
           'SpeechRecognition' in window ||
           (navigator.mediaDevices && 'getUserMedia' in navigator.mediaDevices);
  }, []);

  // Get accessibility props for components
  const getAccessibilityProps = useCallback(() => {
    return {
      'aria-label': state.isRecording ? 'Stop recording' : 'Start recording',
      'aria-live': 'polite',
      'aria-busy': state.isRecording || state.isProcessing,
      'aria-pressed': state.isRecording,
      role: 'button',
      tabIndex: accessibility.screenReaderSupport ? 0 : undefined,
      'aria-describedby': accessibility.screenReaderSupport ? 'speech-status' : undefined
    };
  }, [state.isRecording, state.isProcessing, accessibility.screenReaderSupport]);

  // Get battery-aware settings
  const getBatteryAwareSettings = useCallback(async () => {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        const isBatteryLow = battery.level < 0.2;

        return {
          reducedAnimations: isBatteryLow,
          lowerSampleRate: isBatteryLow ? 8000 : 16000,
          reducedProcessing: isBatteryLow
        };
      } catch {
        return {
          reducedAnimations: false,
          lowerSampleRate: 16000,
          reducedProcessing: false
        };
      }
    }

    return {
      reducedAnimations: false,
      lowerSampleRate: 16000,
      reducedProcessing: false
    };
  }, []);

  // Get performance metrics
  const getPerformanceMetrics = useCallback(() => {
    return {
      ...performanceStats,
      audioLevel: state.audioLevel,
      isVoiceActive: state.isVoiceActive,
      recordingDuration: state.isRecording ? performanceStats.recordingDuration : 0
    };
  }, [performanceStats, state.audioLevel, state.isVoiceActive, state.isRecording]);

  return {
    // State
    ...state,
    visualizationData,
    performanceStats: getPerformanceMetrics(),

    // Actions
    startRecording,
    stopRecording,
    toggleRecording,
    setLanguage,
    togglePrivacyMode,
    updateConfig,
    reset,
    clearTranscript,

    // Utilities
    getMicrophonePermission,
    requestMicrophonePermission,
    isBrowserSupported,
    getAccessibilityProps,
    getBatteryAwareSettings,
    isBatteryAware: typeof navigator !== 'undefined' && 'getBattery' in navigator
  };
};

// Helper functions
function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const keys = shortcut.toLowerCase().split('+');
  const eventKeys = [];

  if (event.ctrlKey) eventKeys.push('ctrl');
  if (event.altKey) eventKeys.push('alt');
  if (event.shiftKey) eventKeys.push('shift');
  if (event.metaKey) eventKeys.push('meta');
  eventKeys.push(event.key.toLowerCase());

  return keys.every(key => eventKeys.includes(key));
}

function announceToScreenReader(message: string): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('aria-hidden', 'false');
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';

  document.body.appendChild(announcement);
  announcement.textContent = message;

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

export default useSpeechRecognition;