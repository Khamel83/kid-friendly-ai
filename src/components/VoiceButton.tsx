import { useState, useEffect, useRef } from 'react';

interface VoiceButtonProps {
  onResult: (text: string) => void;
  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
}

export default function VoiceButton({ onResult, isListening, setIsListening }: VoiceButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const isStartingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initialize speech recognition
    const initSpeechRecognition = () => {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (!SpeechRecognition) {
          throw new Error('Speech recognition not supported');
        }

        // Create new instance
        recognitionRef.current = new SpeechRecognition();
        
        // Configure settings
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';
        recognitionRef.current.maxAlternatives = 1;

        // Set up event handlers
        recognitionRef.current.onstart = () => {
          if (!isMountedRef.current) return;
          console.log('Speech recognition started');
          setIsListening(true);
          setError(null);
          isStartingRef.current = false;
        };

        recognitionRef.current.onresult = (event: any) => {
          if (!isMountedRef.current) return;
          console.log('Speech recognition result:', event);
          const transcript = event.results[0][0].transcript;
          console.log('Recognized text:', transcript);
          onResult(transcript);
          stopListening();
        };

        recognitionRef.current.onerror = (event: any) => {
          if (!isMountedRef.current) return;
          console.error('Speech recognition error:', event);
          isStartingRef.current = false;
          
          let errorMessage = 'Speech recognition error. Please try again.';
          switch (event.error) {
            case 'no-speech':
              errorMessage = 'No speech detected. Please try again.';
              break;
            case 'aborted':
              errorMessage = 'Speech recognition was aborted. Please try again.';
              break;
            case 'audio-capture':
              errorMessage = 'No microphone was found. Please ensure a microphone is connected.';
              break;
            case 'network':
              errorMessage = 'Network error occurred. Please check your connection.';
              break;
            case 'not-allowed':
              errorMessage = 'Microphone access was denied. Please allow microphone access.';
              break;
            case 'service-not-allowed':
              errorMessage = 'Speech recognition service is not allowed. Please try again later.';
              break;
          }
          
          setError(errorMessage);
          stopListening();
        };

        recognitionRef.current.onend = () => {
          if (!isMountedRef.current) return;
          console.log('Speech recognition ended');
          setIsListening(false);
          isStartingRef.current = false;
        };

        return true;
      } catch (err) {
        console.error('Error initializing speech recognition:', err);
        setError('Speech recognition is not available. Please try again later.');
        return false;
      }
    };

    // Check if we're in a browser environment and on HTTPS/localhost
    if (typeof window !== 'undefined' && 
        (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      initSpeechRecognition();
    } else {
      setError('Speech recognition requires a secure context (HTTPS) or localhost.');
    }

    return () => {
      isMountedRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
          recognitionRef.current = null;
        } catch (err) {
          console.error('Error during cleanup:', err);
        }
      }
    };
  }, [onResult, setIsListening]);

  const startListening = () => {
    if (isStartingRef.current) {
      console.log('Already starting speech recognition');
      return;
    }

    if (!recognitionRef.current) {
      setError('Speech recognition is not available. Please refresh the page.');
      return;
    }

    setError(null);
    isStartingRef.current = true;

    // Check microphone permissions first
    navigator.permissions.query({ name: 'microphone' as any })
      .then(permissionStatus => {
        if (!isMountedRef.current) return;
        
        if (permissionStatus.state === 'denied') {
          setError('Microphone access was denied. Please allow microphone access in your browser settings.');
          isStartingRef.current = false;
          return;
        }
        
        try {
          console.log('Starting speech recognition...');
          recognitionRef.current.start();
        } catch (err) {
          console.error('Error starting speech recognition:', err);
          setError('Failed to start speech recognition. Please try again.');
          setIsListening(false);
          isStartingRef.current = false;
        }
      })
      .catch(err => {
        console.error('Error checking microphone permissions:', err);
        setError('Unable to check microphone permissions. Please try again.');
        isStartingRef.current = false;
      });
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        console.log('Stopping speech recognition...');
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
    setIsListening(false);
    isStartingRef.current = false;
  };

  return (
    <div className="voice-button-container">
      <button 
        className={`voice-button ${isListening ? 'listening' : ''}`}
        onClick={isListening ? stopListening : startListening}
        aria-label={isListening ? "Stop listening" : "Start listening"}
      >
        {isListening ? 'I\'m Listening...' : 'Tap to Ask a Question'}
        <div className={`pulse-ring ${isListening ? 'animate' : ''}`}></div>
      </button>
      
      {error && <p className="error-message">{error}</p>}
    </div>
  );
} 