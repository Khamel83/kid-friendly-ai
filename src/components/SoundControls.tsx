/**
 * Sound Control Interface Component
 *
 * This component provides a comprehensive sound control interface with:
 * - Volume sliders and mute controls
 * - Sound effect category toggles
 * - Music playback controls
 * - Sound effect preview functionality
 * - Parental control integration
 * - Accessibility features for sound controls
 * - Visual feedback for sound levels
 * - Sound effect library browser
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSoundControls, useSoundLibrary, useSoundAccessibility } from '../hooks/useSoundEffects';
import { EnhancedSoundManager } from '../utils/soundManager';
import {
  SoundEffectCategory,
  SoundControlState,
  SoundLibrary,
  SoundEffectConfig
} from '../types/sound';

interface SoundControlsProps {
  className?: string;
  compact?: boolean;
  showLibrary?: boolean;
  showAccessibility?: boolean;
  showParentalControls?: boolean;
  onVolumeChange?: (volume: number) => void;
  onMuteToggle?: (muted: boolean) => void;
}

interface VolumeSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  icon?: string;
  color?: string;
}

interface CategoryToggleProps {
  category: SoundEffectCategory;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  icon?: string;
  color?: string;
}

interface SoundPreviewProps {
  sound: SoundEffectConfig;
  onPlay: () => void;
  isPlaying: boolean;
}

const VolumeSlider: React.FC<VolumeSliderProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.1,
  icon,
  color = '#4ecdc4'
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className={`volume-slider ${isDragging ? 'dragging' : ''}`}>
      <div className="slider-label">
        {icon && <span className="slider-icon">{icon}</span>}
        <span className="slider-text">{label}</span>
        <span className="slider-value">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        className="volume-range"
        style={{
          '--slider-color': color,
          '--slider-value': `${value * 100}%`
        } as React.CSSProperties}
        aria-label={`${label} volume: ${Math.round(value * 100)}%`}
      />
      <div className="slider-track">
        <div
          className="slider-fill"
          style={{
            width: `${value * 100}%`,
            backgroundColor: color
          }}
        />
      </div>
    </div>
  );
};

const CategoryToggle: React.FC<CategoryToggleProps> = ({
  category,
  enabled,
  onToggle,
  icon,
  color = '#4ecdc4'
}) => {
  const categoryLabels: Record<SoundEffectCategory, string> = {
    ui: 'UI Sounds',
    game: 'Game Sounds',
    educational: 'Educational',
    music: 'Background Music',
    ambient: 'Ambient',
    character: 'Character',
    notification: 'Notifications',
    error: 'Error Sounds',
    success: 'Success Sounds',
    interaction: 'Interactions'
  };

  const categoryIcons: Record<SoundEffectCategory, string> = {
    ui: '🎛️',
    game: '🎮',
    educational: '📚',
    music: '🎵',
    ambient: '🌊',
    character: '🎭',
    notification: '🔔',
    error: '❌',
    success: '✅',
    interaction: '👆'
  };

  return (
    <div className="category-toggle">
      <button
        className={`toggle-button ${enabled ? 'enabled' : 'disabled'}`}
        onClick={() => onToggle(!enabled)}
        aria-label={`${categoryLabels[category]} ${enabled ? 'enabled' : 'disabled'}`}
        style={{
          '--toggle-color': enabled ? color : '#ccc',
          '--toggle-border-color': enabled ? color : '#ddd'
        } as React.CSSProperties}
      >
        <span className="toggle-icon">{icon || categoryIcons[category]}</span>
        <span className="toggle-label">{categoryLabels[category]}</span>
        <span className="toggle-indicator">{enabled ? '✓' : '✗'}</span>
      </button>
    </div>
  );
};

const SoundPreview: React.FC<SoundPreviewProps> = ({
  sound,
  onPlay,
  isPlaying
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 0;
          }
          return prev + 10;
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setProgress(0);
    }
  }, [isPlaying]);

  return (
    <div className="sound-preview">
      <div className="preview-info">
        <span className="preview-name">{sound.name}</span>
        <span className="preview-category">{sound.category}</span>
      </div>
      <div className="preview-controls">
        <button
          className={`preview-play-button ${isPlaying ? 'playing' : ''}`}
          onClick={onPlay}
          aria-label={`Play ${sound.name}`}
        >
          {isPlaying ? '⏹️' : '▶️'}
        </button>
        <div className="preview-progress">
          <div
            className="progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const SoundControls: React.FC<SoundControlsProps> = ({
  className = '',
  compact = false,
  showLibrary = false,
  showAccessibility = false,
  showParentalControls = false,
  onVolumeChange,
  onMuteToggle
}) => {
  const {
    state,
    setMasterVolume,
    setCategoryVolume,
    toggleMute,
    setCategoryEnabled,
    isMuted,
    masterVolume,
    sfxVolume,
    musicVolume
  } = useSoundControls();

  const {
    library,
    sounds,
    loadLibrary,
    playSound,
    isLoading: libraryLoading
  } = useSoundLibrary('default');

  const {
    visualFeedback,
    closedCaptions,
    vibrationEnabled,
    setVisualFeedback,
    setClosedCaptions,
    setVibrationEnabled,
    triggerVibration,
    showVisualFeedback
  } = useSoundAccessibility();

  const [activeTab, setActiveTab] = useState<'volume' | 'categories' | 'library' | 'accessibility' | 'parental'>('volume');
  const [selectedSound, setSelectedSound] = useState<SoundEffectConfig | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [parentalVolumeLimit, setParentalVolumeLimit] = useState(0.8);

  // Load default library
  useEffect(() => {
    if (showLibrary && !library) {
      loadLibrary('default');
    }
  }, [showLibrary, library, loadLibrary]);

  // Handle volume changes
  const handleMasterVolumeChange = useCallback((volume: number) => {
    const limitedVolume = Math.min(volume, parentalVolumeLimit);
    setMasterVolume(limitedVolume);
    onVolumeChange?.(limitedVolume);

    if (visualFeedback) {
      showVisualFeedback('volume', `Volume: ${Math.round(limitedVolume * 100)}%`);
    }
  }, [setMasterVolume, onVolumeChange, visualFeedback, showVisualFeedback, parentalVolumeLimit]);

  const handleMusicVolumeChange = useCallback((volume: number) => {
    setCategoryVolume('music', volume);
    if (visualFeedback) {
      showVisualFeedback('volume', `Music: ${Math.round(volume * 100)}%`);
    }
  }, [setCategoryVolume, visualFeedback, showVisualFeedback]);

  const handleSfxVolumeChange = useCallback((volume: number) => {
    setCategoryVolume('ui', volume);
    if (visualFeedback) {
      showVisualFeedback('volume', `SFX: ${Math.round(volume * 100)}%`);
    }
  }, [setCategoryVolume, visualFeedback, showVisualFeedback]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    toggleMute();
    onMuteToggle?.(!isMuted);

    if (visualFeedback) {
      showVisualFeedback('mute', isMuted ? 'Unmuted' : 'Muted');
    }

    if (vibrationEnabled) {
      triggerVibration([50]);
    }
  }, [toggleMute, isMuted, onMuteToggle, visualFeedback, showVisualFeedback, vibrationEnabled, triggerVibration]);

  // Handle category toggle
  const handleCategoryToggle = useCallback((category: SoundEffectCategory, enabled: boolean) => {
    setCategoryEnabled(category, enabled);

    if (visualFeedback) {
      showVisualFeedback('category', `${category} ${enabled ? 'enabled' : 'disabled'}`);
    }

    if (vibrationEnabled) {
      triggerVibration([30]);
    }
  }, [setCategoryEnabled, visualFeedback, showVisualFeedback, vibrationEnabled, triggerVibration]);

  // Handle sound preview
  const handleSoundPreview = useCallback(async (sound: SoundEffectConfig) => {
    if (isPlayingPreview) return;

    setSelectedSound(sound);
    setIsPlayingPreview(true);

    try {
      await playSound(sound.id);
    } catch (error) {
      console.error('Failed to play sound preview:', error);
    } finally {
      setIsPlayingPreview(false);
    }
  }, [playSound, isPlayingPreview]);

  // Handle accessibility toggle
  const handleAccessibilityToggle = useCallback((setting: string, value: boolean) => {
    switch (setting) {
      case 'visual':
        setVisualFeedback(value);
        break;
      case 'captions':
        setClosedCaptions(value);
        break;
      case 'vibration':
        setVibrationEnabled(value);
        break;
    }

    if (value && vibrationEnabled) {
      triggerVibration([20]);
    }
  }, [setVisualFeedback, setClosedCaptions, setVibrationEnabled, vibrationEnabled, triggerVibration]);

  if (!state) {
    return <div className="sound-controls loading">Loading sound controls...</div>;
  }

  const categories: SoundEffectCategory[] = [
    'ui', 'game', 'educational', 'music', 'ambient',
    'character', 'notification', 'error', 'success', 'interaction'
  ];

  return (
    <div className={`sound-controls ${className} ${compact ? 'compact' : ''}`}>
      {/* Header */}
      <div className="controls-header">
        <h2 className="controls-title">🔊 Sound Settings</h2>
        <button
          className={`mute-button ${isMuted ? 'muted' : ''}`}
          onClick={handleMuteToggle}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

      {/* Tabs */}
      {!compact && (
        <div className="controls-tabs">
          <button
            className={`tab-button ${activeTab === 'volume' ? 'active' : ''}`}
            onClick={() => setActiveTab('volume')}
            aria-label="Volume controls"
          >
            🔊 Volume
          </button>
          <button
            className={`tab-button ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
            aria-label="Sound categories"
          >
            🎛️ Categories
          </button>
          {showLibrary && (
            <button
              className={`tab-button ${activeTab === 'library' ? 'active' : ''}`}
              onClick={() => setActiveTab('library')}
              aria-label="Sound library"
            >
              🎵 Library
            </button>
          )}
          {showAccessibility && (
            <button
              className={`tab-button ${activeTab === 'accessibility' ? 'active' : ''}`}
              onClick={() => setActiveTab('accessibility')}
              aria-label="Accessibility"
            >
              ♿ Accessibility
            </button>
          )}
          {showParentalControls && (
            <button
              className={`tab-button ${activeTab === 'parental' ? 'active' : ''}`}
              onClick={() => setActiveTab('parental')}
              aria-label="Parental controls"
            >
              👪 Parental
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="controls-content">
        {/* Volume Controls */}
        {(activeTab === 'volume' || compact) && (
          <div className="volume-section">
            <VolumeSlider
              label="Master Volume"
              value={masterVolume}
              onChange={handleMasterVolumeChange}
              icon="🔊"
              color="#4ecdc4"
            />
            {!compact && (
              <>
                <VolumeSlider
                  label="Music Volume"
                  value={musicVolume}
                  onChange={handleMusicVolumeChange}
                  icon="🎵"
                  color="#ff6b6b"
                />
                <VolumeSlider
                  label="Sound Effects"
                  value={sfxVolume}
                  onChange={handleSfxVolumeChange}
                  icon="🎛️"
                  color="#ffe66d"
                />
              </>
            )}
          </div>
        )}

        {/* Category Controls */}
        {!compact && activeTab === 'categories' && (
          <div className="categories-section">
            <h3 className="section-title">Sound Categories</h3>
            <div className="categories-grid">
              {categories.map(category => (
                <CategoryToggle
                  key={category}
                  category={category}
                  enabled={state.categories[category]}
                  onToggle={(enabled) => handleCategoryToggle(category, enabled)}
                  color={getCategoryColor(category)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sound Library */}
        {!compact && showLibrary && activeTab === 'library' && (
          <div className="library-section">
            <h3 className="section-title">Sound Library</h3>
            {libraryLoading ? (
              <div className="loading">Loading sound library...</div>
            ) : sounds.length > 0 ? (
              <div className="sound-list">
                {sounds.map(sound => (
                  <SoundPreview
                    key={sound.id}
                    sound={sound}
                    onPlay={() => handleSoundPreview(sound)}
                    isPlaying={isPlayingPreview && selectedSound?.id === sound.id}
                  />
                ))}
              </div>
            ) : (
              <div className="no-sounds">No sounds available</div>
            )}
          </div>
        )}

        {/* Accessibility Controls */}
        {!compact && showAccessibility && activeTab === 'accessibility' && (
          <div className="accessibility-section">
            <h3 className="section-title">Accessibility Options</h3>
            <div className="accessibility-grid">
              <div className="accessibility-item">
                <label className="accessibility-label">
                  <input
                    type="checkbox"
                    checked={visualFeedback}
                    onChange={(e) => handleAccessibilityToggle('visual', e.target.checked)}
                    className="accessibility-checkbox"
                  />
                  <span className="accessibility-text">Visual Feedback</span>
                </label>
                <p className="accessibility-description">Show visual indicators for sounds</p>
              </div>
              <div className="accessibility-item">
                <label className="accessibility-label">
                  <input
                    type="checkbox"
                    checked={closedCaptions}
                    onChange={(e) => handleAccessibilityToggle('captions', e.target.checked)}
                    className="accessibility-checkbox"
                  />
                  <span className="accessibility-text">Closed Captions</span>
                </label>
                <p className="accessibility-description">Display text descriptions of sounds</p>
              </div>
              <div className="accessibility-item">
                <label className="accessibility-label">
                  <input
                    type="checkbox"
                    checked={vibrationEnabled}
                    onChange={(e) => handleAccessibilityToggle('vibration', e.target.checked)}
                    className="accessibility-checkbox"
                  />
                  <span className="accessibility-text">Vibration Feedback</span>
                </label>
                <p className="accessibility-description">Vibrate on sound events</p>
              </div>
            </div>
          </div>
        )}

        {/* Parental Controls */}
        {!compact && showParentalControls && activeTab === 'parental' && (
          <div className="parental-section">
            <h3 className="section-title">Parental Controls</h3>
            <div className="parental-controls">
              <VolumeSlider
                label="Maximum Volume"
                value={parentalVolumeLimit}
                onChange={setParentalVolumeLimit}
                min={0}
                max={1}
                step={0.1}
                icon="🔒"
                color="#ff6b6b"
              />
              <div className="parental-info">
                <p className="parental-description">
                  Volume is limited to {Math.round(parentalVolumeLimit * 100)}% for safety.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visual feedback overlay */}
      {visualFeedback && (
        <div className="sound-visual-feedback">
          {/* Visual feedback elements will be inserted here */}
        </div>
      )}

      {/* Styles */}
      <style jsx>{`
        .sound-controls {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          font-family: 'Comic Neue', cursive;
        }

        .sound-controls.compact {
          padding: 15px;
        }

        .controls-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .controls-title {
          margin: 0;
          font-size: 1.5rem;
          color: #333;
        }

        .mute-button {
          background: none;
          border: 2px solid #ddd;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          font-size: 1.2rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .mute-button:hover {
          border-color: #4ecdc4;
          transform: scale(1.1);
        }

        .mute-button.muted {
          background: #ff6b6b;
          border-color: #ff6b6b;
          color: white;
        }

        .controls-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          border-bottom: 2px solid #eee;
        }

        .tab-button {
          background: none;
          border: none;
          padding: 10px 15px;
          cursor: pointer;
          font-size: 0.9rem;
          border-bottom: 2px solid transparent;
          transition: all 0.3s ease;
        }

        .tab-button.active {
          border-bottom-color: #4ecdc4;
          color: #4ecdc4;
        }

        .tab-button:hover {
          background: rgba(78, 205, 196, 0.1);
        }

        .volume-section {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .volume-slider {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .slider-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.9rem;
          color: #555;
        }

        .slider-icon {
          font-size: 1.1rem;
        }

        .slider-text {
          flex: 1;
        }

        .slider-value {
          font-weight: bold;
          color: #4ecdc4;
        }

        .volume-range {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: #ddd;
          outline: none;
          -webkit-appearance: none;
        }

        .volume-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--slider-color, #4ecdc4);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .volume-range::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
        }

        .category-toggle {
          width: 100%;
        }

        .toggle-button {
          width: 100%;
          padding: 12px;
          border: 2px solid var(--toggle-border-color, #ddd);
          border-radius: 8px;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.3s ease;
        }

        .toggle-button.enabled {
          border-color: var(--toggle-color, #4ecdc4);
          background: var(--toggle-color, #4ecdc4);
          color: white;
        }

        .toggle-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .toggle-icon {
          font-size: 1.2rem;
        }

        .toggle-label {
          flex: 1;
          text-align: left;
          font-size: 0.9rem;
        }

        .toggle-indicator {
          font-weight: bold;
        }

        .sound-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sound-preview {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 10px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 8px;
        }

        .preview-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .preview-name {
          font-weight: bold;
          color: #333;
        }

        .preview-category {
          font-size: 0.8rem;
          color: #666;
          text-transform: capitalize;
        }

        .preview-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .preview-play-button {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid #4ecdc4;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .preview-play-button:hover {
          background: #4ecdc4;
          transform: scale(1.1);
        }

        .preview-play-button.playing {
          background: #ff6b6b;
          border-color: #ff6b6b;
          color: white;
        }

        .preview-progress {
          width: 100px;
          height: 4px;
          background: #eee;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: #4ecdc4;
          transition: width 0.1s ease;
        }

        .accessibility-grid {
          display: grid;
          gap: 15px;
        }

        .accessibility-item {
          padding: 15px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 8px;
        }

        .accessibility-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: bold;
          color: #333;
          cursor: pointer;
        }

        .accessibility-checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .accessibility-text {
          flex: 1;
        }

        .accessibility-description {
          margin: 5px 0 0 0;
          font-size: 0.8rem;
          color: #666;
        }

        .parental-controls {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .parental-info {
          padding: 10px;
          background: rgba(255, 107, 107, 0.1);
          border-radius: 6px;
          border-left: 4px solid #ff6b6b;
        }

        .parental-description {
          margin: 0;
          font-size: 0.9rem;
          color: #666;
        }

        .loading {
          text-align: center;
          color: #666;
          font-style: italic;
        }

        .no-sounds {
          text-align: center;
          color: #666;
          font-style: italic;
        }

        .section-title {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 1.2rem;
        }

        @media (max-width: 768px) {
          .sound-controls {
            padding: 15px;
          }

          .categories-grid {
            grid-template-columns: 1fr;
          }

          .controls-tabs {
            flex-wrap: wrap;
          }

          .tab-button {
            padding: 8px 12px;
            font-size: 0.8rem;
          }
        }
      `}</style>
    </div>
  );
};

// Helper function to get category colors
function getCategoryColor(category: SoundEffectCategory): string {
  const colors: Record<SoundEffectCategory, string> = {
    ui: '#4ecdc4',
    game: '#ff6b6b',
    educational: '#ffe66d',
    music: '#a8e6cf',
    ambient: '#95e1d3',
    character: '#ff8cc8',
    notification: '#ffd93d',
    error: '#ff6b6b',
    success: '#6bcf7f',
    interaction: '#4ecdc4'
  };

  return colors[category] || '#4ecdc4';
}

export default SoundControls;