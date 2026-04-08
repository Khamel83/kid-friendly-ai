import { useState, useEffect } from 'react';
import { LOCAL_VOICES, CLOUD_VOICES } from '../utils/ttsClient';
import type { ServiceMode } from '../hooks/useServiceMode';

const STORAGE_KEY = 'buddy-selected-voice';

interface VoiceSelectorProps {
  mode: ServiceMode;
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
}

export default function VoiceSelector({ mode, selectedVoice, onVoiceChange }: VoiceSelectorProps) {
  const voices = mode === 'local' ? LOCAL_VOICES : CLOUD_VOICES;
  const defaultVoice = voices[0].id;

  // Initialize from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && voices.some(v => v.id === saved)) {
      onVoiceChange(saved);
    } else {
      onVoiceChange(defaultVoice);
      localStorage.setItem(STORAGE_KEY, defaultVoice);
    }
  }, [mode]); // Re-init when mode changes

  const handleChange = (voiceId: string) => {
    onVoiceChange(voiceId);
    localStorage.setItem(STORAGE_KEY, voiceId);
  };

  return (
    <div className="voice-selector">
      <label className="voice-label">Voice:</label>
      <div className="voice-buttons">
        {voices.map(voice => (
          <button
            key={voice.id}
            className={`voice-btn ${selectedVoice === voice.id ? 'active' : ''}`}
            onClick={() => handleChange(voice.id)}
            title={voice.description}
          >
            {voice.name}
          </button>
        ))}
      </div>
    </div>
  );
}
