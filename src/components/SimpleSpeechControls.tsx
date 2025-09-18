import React, { useState, useEffect, useRef } from 'react';

interface SimpleSpeechControlsProps {
  onResult: (transcript: string) => void;
  onError: (error: string) => void;
  onVoiceActivity?: (active: boolean) => void;
  initialLanguage?: string;
  className?: string;
}

export default function SimpleSpeechControls({
  onResult,
  onError,
  onVoiceActivity,
  initialLanguage = 'en-US',
  className = ''
}: SimpleSpeechControlsProps) {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onError('Speech recognition not supported in this browser');
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = initialLanguage;

    recognitionInstance.onstart = () => {
      setIsListening(true);
      onVoiceActivity?.(true);
      console.log('Speech recognition started');
    };

    recognitionInstance.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log('Speech result:', transcript);

      if (transcript) {
        onResult(transcript);
      }

      // Reset listening state
      setIsListening(false);
      onVoiceActivity?.(false);
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      onVoiceActivity?.(false);

      let errorMessage = 'Speech recognition error';
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Speech recognition needs internet connection. Please check your Wi-Fi or try again in a moment.';
          break;
        default:
          errorMessage = `Error: ${event.error}`;
      }

      onError(errorMessage);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
      onVoiceActivity?.(false);
      console.log('Speech recognition ended');
    };

    setRecognition(recognitionInstance);

    return () => {
      if (recognitionInstance) {
        try {
          recognitionInstance.stop();
        } catch (e) {
          console.log('Error stopping recognition on cleanup:', e);
        }
      }
    };
  }, [initialLanguage, onResult, onError, onVoiceActivity]);

  const startListening = () => {
    if (isListening || !recognition) return;

    try {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      recognition.start();

      // Set a timeout to auto-stop after 10 seconds
      timeoutRef.current = setTimeout(() => {
        if (isListening) {
          stopListening();
          onError('Listening timeout. Please try again.');
        }
      }, 10000);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      onError('Failed to start speech recognition');
    }
  };

  const stopListening = () => {
    if (!isListening || !recognition) return;

    try {
      recognition.stop();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`simple-speech-controls ${className}`}>
      <button
        onClick={isListening ? stopListening : startListening}
        className={`speech-button ${isListening ? 'listening' : ''}`}
        disabled={!recognition}
        aria-label={isListening ? 'Stop listening' : 'Start talking'}
      >
        {isListening ? '🛑 Stop' : '🎤 Talk'}
      </button>
    </div>
  );
}