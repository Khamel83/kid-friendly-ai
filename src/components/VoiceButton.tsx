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
    // Initialize the Web Speech API
    if (typeof window !== 'undefined') {
      try {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        
        if (!SpeechRecognition) {
          setError('Speech recognition is not supported in this browser. Please use Chrome.');
          return;
        }

        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onstart = () => {
          console.log('Speech recognition started');
          setIsListening(true);
        };

        recognitionRef.current.onresult = (event: any) => {
          console.log('Speech recognition result:', event);
          const current = event.resultIndex;
          const result = event.results[current][0].transcript;
          setTranscript(result);
          stopListening();
          onResult(result);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event);
          setError(`I couldn't hear that. Can you try again? (Error: ${event.error})`);
          stopListening();
        };

        recognitionRef.current.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
        };

        // Load sound effects
        startSoundRef.current = new Audio('/sounds/start.mp3');
        endSoundRef.current = new Audio('/sounds/end.mp3');
      } catch (err) {
        console.error('Error initializing speech recognition:', err);
        setError('Failed to initialize speech recognition. Please try again.');
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onResult, setIsListening]);

  const startListening = () => {
    setError(null);
    setTranscript('');
    
    if (recognitionRef.current) {
      try {
        console.log('Starting speech recognition...');
        startSoundRef.current?.play().catch(e => console.log('Audio play error:', e));
        recognitionRef.current.start();
      } catch (err) {
        console.error('Speech recognition error on start:', err);
        setError('Oops! There was a problem. Try tapping the button again.');
        setIsListening(false);
      }
    } else {
      setError('Speech recognition is not available. Please use Chrome browser.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      try {
        console.log('Stopping speech recognition...');
        endSoundRef.current?.play().catch(e => console.log('Audio play error:', e));
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (err) {
        console.error('Speech recognition error on stop:', err);
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