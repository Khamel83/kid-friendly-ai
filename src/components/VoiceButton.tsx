import { useState, useEffect, useRef } from 'react';

interface VoiceButtonProps {
  onResult: (text: string) => void;
  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
}

export default function VoiceButton({ onResult, isListening, setIsListening }: VoiceButtonProps) {
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const recognitionRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const isStartingRef = useRef(false);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const noSpeechTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const initializeSpeechRecognition = () => {
    try {
      console.log('Creating SpeechRecognition instance...');
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      // Configure recognition settings
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

        // Set timeout for no speech detection
        noSpeechTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && isListening) {
            console.log('No speech detected within timeout');
            stopListening();
            setError('No speech detected. Please try again.');
          }
        }, 10000); // 10 seconds timeout
      };

      recognitionRef.current.onresult = (event: any) => {
        if (!isMountedRef.current) return;
        console.log('Speech recognition result:', event);
        const current = event.resultIndex;
        const result = event.results[current][0].transcript;
        console.log('Recognized text:', result);
        setTranscript(result);
        stopListening();
        onResult(result);
        retryCountRef.current = 0; // Reset retry count on success
      };

      recognitionRef.current.onerror = (event: any) => {
        if (!isMountedRef.current) return;
        console.error('Speech recognition error:', event);
        isStartingRef.current = false;
        
        let errorMessage = 'I couldn\'t hear that. Can you try again?';
        let shouldRetry = false;
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech was detected. Please try again.';
            shouldRetry = true;
            break;
          case 'aborted':
            errorMessage = 'Speech recognition was aborted. Please try again.';
            shouldRetry = true;
            break;
          case 'audio-capture':
            errorMessage = 'No microphone was found. Please ensure a microphone is connected.';
            break;
          case 'network':
            errorMessage = 'Network error occurred. Please check your connection and try again.';
            shouldRetry = true;
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access was denied. Please allow microphone access.';
            break;
          case 'service-not-allowed':
            errorMessage = 'Speech recognition service is not allowed. Please try again later.';
            break;
          default:
            errorMessage = `Error: ${event.error}. Please try again.`;
            shouldRetry = true;
        }
        
        setError(errorMessage);
        stopListening();

        // Handle retry logic
        if (shouldRetry && retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          console.log(`Retrying speech recognition (attempt ${retryCountRef.current}/${maxRetries})`);
          // Add delay between retries
          setTimeout(() => {
            if (isMountedRef.current) {
              startListening();
            }
          }, 2000); // Wait 2 seconds before retrying
        }
      };

      recognitionRef.current.onend = () => {
        if (!isMountedRef.current) return;
        console.log('Speech recognition ended');
        setIsListening(false);
        isStartingRef.current = false;
        if (noSpeechTimeoutRef.current) {
          clearTimeout(noSpeechTimeoutRef.current);
          noSpeechTimeoutRef.current = null;
        }
      };
      
      console.log('VoiceButton initialization complete');
      setIsInitializing(false);
      return true;
    } catch (err) {
      console.error('Error initializing speech recognition:', err);
      setError('Failed to initialize speech recognition. Please try again.');
      setIsInitializing(false);
      return false;
    }
  };

  // Initialize speech recognition
  useEffect(() => {
    isMountedRef.current = true;

    // Prevent multiple initializations
    if (initializedRef.current) return;
    initializedRef.current = true;

    console.log('Initializing VoiceButton component...');
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.log('Not in browser environment');
      setIsInitializing(false);
      return;
    }

    // Check if Web Speech API is supported
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      const errorMsg = 'Speech recognition is not supported in this browser. Please use a Chromium-based browser like Chrome, Edge, or Arc.';
      console.error(errorMsg);
      setError(errorMsg);
      setIsInitializing(false);
      return;
    }

    // Check if we're on a secure context (HTTPS or localhost)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      const errorMsg = 'Speech recognition requires a secure context (HTTPS) or localhost.';
      console.error(errorMsg);
      setError(errorMsg);
      setIsInitializing(false);
      return;
    }

    // Add delay before initialization to prevent race conditions
    setTimeout(() => {
      if (isMountedRef.current) {
        initializeSpeechRecognition();
      }
    }, 500);

    return () => {
      isMountedRef.current = false;
      if (recognitionRef.current) {
        console.log('Cleaning up speech recognition');
        try {
          recognitionRef.current.abort();
        } catch (err) {
          console.error('Error during cleanup:', err);
        }
        recognitionRef.current = null;
      }
      if (noSpeechTimeoutRef.current) {
        clearTimeout(noSpeechTimeoutRef.current);
        noSpeechTimeoutRef.current = null;
      }
    };
  }, [onResult, setIsListening]);

  const startListening = () => {
    if (isStartingRef.current) {
      console.log('Already starting speech recognition');
      return;
    }

    console.log('Starting listening...');
    setError(null);
    setTranscript('');
    
    // Reinitialize if needed
    if (!recognitionRef.current) {
      console.log('Reinitializing speech recognition...');
      const success = initializeSpeechRecognition();
      if (!success) {
        console.error('Failed to reinitialize speech recognition');
        setError('Speech recognition is not available. Please refresh the page.');
        return;
      }
    }

    // Check microphone permissions
    navigator.permissions.query({ name: 'microphone' as any })
      .then(permissionStatus => {
        if (!isMountedRef.current) return;
        
        if (permissionStatus.state === 'denied') {
          setError('Microphone access was denied. Please allow microphone access in your browser settings.');
          return;
        }
        
        try {
          console.log('Starting speech recognition...');
          isStartingRef.current = true;
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
    console.log('Stopping listening...');
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
        isStartingRef.current = false;
        if (noSpeechTimeoutRef.current) {
          clearTimeout(noSpeechTimeoutRef.current);
          noSpeechTimeoutRef.current = null;
        }
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
  };

  return (
    <div className="voice-button-container">
      {isInitializing && (
        <div className="initializing-message">
          Initializing speech recognition...
        </div>
      )}
      <button 
        className={`voice-button ${isListening ? 'listening' : ''} ${isInitializing ? 'disabled' : ''}`}
        onClick={isListening ? stopListening : startListening}
        aria-label={isListening ? "Stop listening" : "Start listening"}
        disabled={isInitializing}
      >
        {isListening ? 'I\'m Listening...' : 'Tap to Ask a Question'}
        <div className={`pulse-ring ${isListening ? 'animate' : ''}`}></div>
      </button>
      
      {error && <p className="error-message">{error}</p>}
      {transcript && !isListening && <p className="transcript">"{transcript}"</p>}
    </div>
  );
} 