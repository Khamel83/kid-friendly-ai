/**
 * Enhanced Speech Controls Component
 * Provides a child-friendly interface for speech recognition with visual feedback
 */

import React, { useState, useEffect, useCallback } from 'react';
import useSpeechRecognition, {
  UseSpeechRecognitionOptions,
  AccessibilityOptions,
  KeyboardShortcuts
} from '../hooks/useSpeechRecognition';
import AudioVisualizer from './AudioVisualizer';
import { AccessibilityUtils, ARIA_ROLES } from '../utils/accessibility';

interface SpeechControlsProps {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  onVoiceActivity?: (active: boolean) => void;
  initialLanguage?: string;
  availableLanguages?: Array<{ code: string; name: string; flag?: string }>;
  className?: string;
  showSettings?: boolean;
  childFriendly?: boolean;
  animateButtons?: boolean;
  compact?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

interface SpeechSettings {
  language: string;
  privacyMode: 'local' | 'cloud';
  continuous: boolean;
  noiseReduction: number;
  voiceThreshold: number;
  volume: number;
  announcementsEnabled: boolean;
  largeButtons: boolean;
  highContrast: boolean;
  keyboardShortcuts: KeyboardShortcuts;
}

const DEFAULT_LANGUAGES = [
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Português', flag: '🇧🇷' },
  { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
  { code: 'ru-RU', name: 'Русский', flag: '🇷🇺' }
];

const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  toggleRecording: 'Space',
  stopRecording: 'Escape',
  privacyToggle: 'Control+P'
};

const SpeechControls: React.FC<SpeechControlsProps> = ({
  onResult,
  onError,
  onVoiceActivity,
  initialLanguage = 'en-US',
  availableLanguages = DEFAULT_LANGUAGES,
  className = '',
  showSettings = true,
  childFriendly = true,
  animateButtons = true,
  compact = false,
  theme = 'auto'
}) => {
  const [settings, setSettings] = useState<SpeechSettings>({
    language: initialLanguage,
    privacyMode: 'cloud',
    continuous: true, // Make it continuous for better kid experience
    noiseReduction: 0.5,
    voiceThreshold: 0.3,
    volume: 1.0,
    announcementsEnabled: true,
    largeButtons: childFriendly,
    highContrast: false,
    keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS
  });

  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [permissions, setPermissions] = useState({
    microphone: 'prompt' as PermissionState,
    speechRecognition: 'prompt' as PermissionState
  });

  // Speech recognition hook
  const speechRecognition = useSpeechRecognition(
    {
      continuous: settings.continuous,
      interimResults: true,
      maxRecordingDuration: 120, // Much longer recording time
      silenceTimeout: 5, // Longer silence timeout
      autoStart: false,
      onResult: (result) => onResult?.(result.transcript),
      onError: (error) => onError?.(error.message),
      onVoiceActivity: onVoiceActivity
    },
    {
      announceResults: settings.announcementsEnabled,
      screenReaderSupport: true,
      keyboardShortcuts: settings.keyboardShortcuts,
      highContrastMode: settings.highContrast,
      largeButtons: settings.largeButtons
    }
  );

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  // Apply theme
  useEffect(() => {
    if (theme === 'auto') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Check microphone and speech recognition permissions
  const checkPermissions = useCallback(async () => {
    try {
      const micPermission = await speechRecognition.getMicrophonePermission();
      setPermissions(prev => ({ ...prev, microphone: micPermission }));
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }, [speechRecognition]);

  // Request microphone permission
  const requestMicrophonePermission = useCallback(async () => {
    try {
      const granted = await speechRecognition.requestMicrophonePermission();
      if (granted) {
        setPermissions(prev => ({ ...prev, microphone: 'granted' }));
      }
      return granted;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  }, [speechRecognition]);

  // Handle language change
  const handleLanguageChange = useCallback((language: string) => {
    setSettings(prev => ({ ...prev, language }));
    speechRecognition.setLanguage(language);
  }, [speechRecognition]);

  // Toggle privacy mode
  const togglePrivacyMode = useCallback(() => {
    const newMode = settings.privacyMode === 'cloud' ? 'local' : 'cloud';
    setSettings(prev => ({ ...prev, privacyMode: newMode }));
    speechRecognition.togglePrivacyMode();
  }, [settings.privacyMode, speechRecognition]);

  // Update settings
  const updateSetting = useCallback((key: keyof SpeechSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Render recording button
  const renderRecordingButton = () => {
    const {
      isRecording,
      isProcessing,
      audioLevel,
      isVoiceActive,
      error,
      getAccessibilityProps
    } = speechRecognition;

    const buttonSize = settings.largeButtons ? 'large' : 'medium';
    const buttonClass = `speech-button ${buttonSize} ${isRecording ? 'recording' : 'idle'} ${animateButtons ? 'animated' : ''} ${settings.highContrast ? 'high-contrast' : ''}`;

    return (
      <div className="speech-button-container">
        <button
          {...getAccessibilityProps()}
          className={buttonClass}
          onClick={speechRecognition.toggleRecording}
          disabled={isProcessing || permissions.microphone === 'denied'}
          title={isRecording ? 'Stop recording' : 'Start recording'}
        >
          <span className="button-icon">
            {isRecording ? '⏹️' : '🎤'}
          </span>
          <span className="button-text">
            {isRecording ? 'Stop' : 'Talk'}
          </span>

          {/* Visual feedback elements */}
          {isRecording && (
            <>
              <div className="pulse-ring"></div>
              <div className="audio-level-indicator">
                <div
                  className="audio-level-bar"
                  style={{ transform: `scaleX(${audioLevel})` }}
                ></div>
              </div>
              {isVoiceActive && (
                <div className="voice-activity-indicator"></div>
              )}
            </>
          )}
        </button>

        {/* Status indicators */}
        <div className="status-indicators">
          {error && (
            <div className="error-indicator" role="alert">
              ⚠️ {error}
            </div>
          )}

          {permissions.microphone === 'denied' && (
            <div className="permission-denied">
              🚫 Microphone access denied
              <button
                className="small-button"
                onClick={requestMicrophonePermission}
              >
                Enable Microphone
              </button>
            </div>
          )}

          {settings.privacyMode === 'local' && (
            <div className="privacy-indicator">
              🔒 Local processing
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render language selector
  const renderLanguageSelector = () => {
    if (compact) return null;

    return (
      <div className="language-selector">
        <label htmlFor="language-select">Language:</label>
        <select
          id="language-select"
          value={settings.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="language-select"
          aria-label="Select language"
        >
          {availableLanguages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  // Render settings panel
  const renderSettingsPanel = () => {
    if (!showSettingsPanel) return null;

    return (
      <div className="settings-panel">
        <h3>Speech Settings</h3>

        <div className="setting-group">
          <label>Privacy Mode</label>
          <div className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.privacyMode === 'local'}
              onChange={togglePrivacyMode}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">
              {settings.privacyMode === 'local' ? 'Local' : 'Cloud'}
            </span>
          </div>
        </div>

        <div className="setting-group">
          <label>Noise Reduction</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.noiseReduction}
            onChange={(e) => updateSetting('noiseReduction', parseFloat(e.target.value))}
            className="slider"
          />
        </div>

        <div className="setting-group">
          <label>Voice Sensitivity</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.voiceThreshold}
            onChange={(e) => updateSetting('voiceThreshold', parseFloat(e.target.value))}
            className="slider"
          />
        </div>

        <div className="setting-group">
          <label>Continuous Recording</label>
          <div className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.continuous}
              onChange={(e) => updateSetting('continuous', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>

        <div className="setting-group">
          <label>Large Buttons</label>
          <div className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.largeButtons}
              onChange={(e) => updateSetting('largeButtons', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>

        <div className="setting-group">
          <label>High Contrast</label>
          <div className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => updateSetting('highContrast', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>

        <div className="setting-group">
          <label>Announcements</label>
          <div className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.announcementsEnabled}
              onChange={(e) => updateSetting('announcementsEnabled', e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </div>
        </div>
      </div>
    );
  };

  // Render help panel
  const renderHelpPanel = () => {
    if (!showHelp) return null;

    return (
      <div className="help-panel">
        <h3>How to Use Speech Recognition</h3>
        <ul>
          <li>Click the microphone button to start recording</li>
          <li>Speak clearly into your microphone</li>
          <li>Click again to stop recording</li>
          <li>Your speech will be converted to text</li>
        </ul>

        <h4>Keyboard Shortcuts</h4>
        <ul>
          <li><kbd>Space</kbd> - Start/Stop recording</li>
          <li><kbd>Escape</kbd> - Stop recording</li>
          <li><kbd>Ctrl+P</kbd> - Toggle privacy mode</li>
        </ul>

        <h4>Tips for Better Recognition</h4>
        <ul>
          <li>Speak in a quiet environment</li>
          <li>Hold your device close to your mouth</li>
          <li>Speak clearly and at a moderate pace</li>
          <li>Reduce background noise when possible</li>
        </ul>
      </div>
    );
  };

  // Render controls
  const renderControls = () => {
    return (
      <div className="speech-controls">
        <div className="main-controls">
          {renderRecordingButton()}
          {renderLanguageSelector()}
        </div>

        {!compact && (
          <div className="secondary-controls">
            <button
              className="control-button"
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              aria-label="Settings"
              title="Settings"
            >
              ⚙️
            </button>

            <button
              className="control-button"
              onClick={() => setShowHelp(!showHelp)}
              aria-label="Help"
              title="Help"
            >
              ❓
            </button>

            <button
              className="control-button"
              onClick={togglePrivacyMode}
              aria-label="Toggle privacy mode"
              title={settings.privacyMode === 'local' ? 'Local processing' : 'Cloud processing'}
            >
              {settings.privacyMode === 'local' ? '🔒' : '☁️'}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render audio visualizer
  const renderAudioVisualizer = () => {
    if (compact || !speechRecognition.isRecording) return null;

    return (
      <div className="audio-visualizer-container">
        <AudioVisualizer
          audioData={speechRecognition.visualizationData}
          isRecording={speechRecognition.isRecording}
          isVoiceActive={speechRecognition.isVoiceActive}
          audioLevel={speechRecognition.audioLevel}
          theme={theme}
          compact={compact}
        />
      </div>
    );
  };

  // Render performance metrics
  const renderPerformanceMetrics = () => {
    if (compact || !childFriendly) return null;

    const metrics = speechRecognition.performanceStats;

    return (
      <div className="performance-metrics">
        <div className="metric">
          <span className="metric-label">Quality:</span>
          <span className="metric-value">
            {Math.round(metrics.voiceActivityRatio * 100)}%
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Volume:</span>
          <span className="metric-value">
            {Math.round(speechRecognition.audioLevel * 100)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className={`speech-controls-container ${className} ${compact ? 'compact' : ''} ${childFriendly ? 'child-friendly' : ''}`}>
      {/* Main controls */}
      {renderControls()}

      {/* Audio visualizer */}
      {renderAudioVisualizer()}

      {/* Performance metrics */}
      {renderPerformanceMetrics()}

      {/* Settings panel */}
      {showSettings && renderSettingsPanel()}

      {/* Help panel */}
      {renderHelpPanel()}

      {/* Screen reader announcements */}
      <div
        id="speech-status"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {speechRecognition.isRecording && 'Recording in progress'}
        {speechRecognition.isProcessing && 'Processing speech'}
        {speechRecognition.transcript && `Transcribed: ${speechRecognition.transcript}`}
      </div>
    </div>
  );
};

export default SpeechControls;