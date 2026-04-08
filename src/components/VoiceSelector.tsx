import { useState, useEffect } from 'react';
import { LOCAL_VOICES, CLOUD_VOICES } from '../utils/ttsClient';
import type { ServiceMode } from '../hooks/useServiceMode';

const STORAGE_KEY = 'buddy-selected-voice';

// Emojis for each voice (local Piper voices have custom ones, cloud voices use OpenAI names)
const voiceEmojis: Record<string, string> = {
  // Local Piper voices
  'en_US-lessac-medium': '🎙️',
  'en_US-amy-medium': '🌸',
  'en_US-jenny_dioco-medium': '🎵',
  'en_US-libritts_r-medium': '🗣️',
  'en_US-glados': '🤖',
  // Cloud OpenAI voices
  'shimmer': '✨',
  'nova': '⭐',
  'alloy': '🤖',
  'echo': '🔊',
  'fable': '📖',
};

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
    <>
      <div className="voice-row">
        {voices.map(voice => (
          <button
            key={voice.id}
            className={`voice-card ${selectedVoice === voice.id ? 'active' : ''}`}
            onClick={() => handleChange(voice.id)}
            title={voice.description}
          >
            <div className="voice-icon">{voiceEmojis[voice.id] || '🔊'}</div>
            <div className="voice-name">{voice.name}</div>
          </button>
        ))}
      </div>
      <style jsx>{`
        .voice-row {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .voice-card {
          background: white;
          border: 3px solid transparent;
          border-radius: 16px;
          padding: 14px 18px;
          cursor: pointer;
          transition: transform 0.2s, border-color 0.2s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          min-width: 72px;
        }

        .voice-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        .voice-card:active {
          transform: translateY(-1px);
        }

        .voice-card.active {
          border-color: #667eea;
          transform: scale(1.05);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        }

        .voice-icon {
          font-size: 32px;
          line-height: 1;
        }

        .voice-name {
          font-size: 13px;
          font-weight: bold;
          color: #2c3e50;
        }

        @media (max-width: 600px) {
          .voice-row {
            gap: 8px;
            margin-bottom: 16px;
          }

          .voice-card {
            padding: 10px 14px;
            min-width: 60px;
          }

          .voice-icon {
            font-size: 24px;
          }

          .voice-name {
            font-size: 11px;
          }
        }
      `}</style>
    </>
  );
}
