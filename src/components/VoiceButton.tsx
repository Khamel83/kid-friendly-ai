import { useState, useEffect, useRef } from 'react';

interface VoiceButtonProps {
  onResult: (text: string) => void;
  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
}

export default function VoiceButton({ onResult, isListening, setIsListening }: VoiceButtonProps) {
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const startSoundRef = useRef<HTMLAudioElement | null>(null);
  const endSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    console.log('Initializing VoiceButton component...');
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.log('Not in browser environment');
      return;
    }

    // Check if Web Speech API is supported
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      const errorMsg = 'Speech recognition is not supported in this browser. Please use a Chromium-based browser like Chrome, Edge, or Arc.';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    // Check if we're on a secure context (HTTPS or localhost)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      const errorMsg = 'Speech recognition requires a secure context (HTTPS) or localhost.';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }

    try {
      console.log('Creating SpeechRecognition instance...');
      recognitionRef.current = new SpeechRecognition();
      
      // Configure recognition settings
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      
      // Set up event handlers
      recognitionRef.current.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
        setError(null);
      };

      recognitionRef.current.onresult = (event: any) => {
        console.log('Speech recognition result:', event);
        const current = event.resultIndex;
        const result = event.results[current][0].transcript;
        console.log('Recognized text:', result);
        setTranscript(result);
        stopListening();
        onResult(result);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event);
        let errorMessage = 'I couldn\'t hear that. Can you try again?';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech was detected. Please try again.';
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
          default:
            errorMessage = `Error: ${event.error}. Please try again.`;
        }
        
        setError(errorMessage);
        stopListening();
      };

      recognitionRef.current.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
      };

      // Initialize sound effects
      startSoundRef.current = new Audio('/sounds/start.mp3');
      endSoundRef.current = new Audio('/sounds/end.mp3');
      
      console.log('VoiceButton initialization complete');
    } catch (err) {
      console.error('Error initializing speech recognition:', err);
      setError('Failed to initialize speech recognition. Please try again.');
    }

    return () => {
      if (recognitionRef.current) {
        console.log('Cleaning up speech recognition');
        recognitionRef.current.abort();
      }
    };
  }, [onResult, setIsListening]);

  const startListening = () => {
    console.log('Starting listening...');
    setError(null);
    setTranscript('');
    
    if (!recognitionRef.current) {
      console.error('Speech recognition not initialized');
      setError('Speech recognition is not available. Please refresh the page.');
      return;
    }

    // Check microphone permissions
    navigator.permissions.query({ name: 'microphone' as any })
      .then(permissionStatus => {
        if (permissionStatus.state === 'denied') {
          setError('Microphone access was denied. Please allow microphone access in your browser settings.');
          return;
        }
        
        try {
          console.log('Starting speech recognition...');
          startSoundRef.current?.play().catch(e => console.log('Audio play error:', e));
          recognitionRef.current.start();
        } catch (err) {
          console.error('Error starting speech recognition:', err);
          setError('Failed to start speech recognition. Please try again.');
          setIsListening(false);
        }
      })
      .catch(err => {
        console.error('Error checking microphone permissions:', err);
        setError('Unable to check microphone permissions. Please try again.');
      });
  };

  const stopListening = () => {
    console.log('Stopping listening...');
    if (recognitionRef.current && isListening) {
      try {
        endSoundRef.current?.play().catch(e => console.log('Audio play error:', e));
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (err) {
        console.error('Error stopping speech recognition:', err);
      }
    }
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
      {transcript && !isListening && <p className="transcript">"{transcript}"</p>}
    </div>
  );
} 