import { useState, useEffect, useRef } from 'react';

interface VoiceButtonProps {
  onResult: (text: string) => void;
  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
}

export default function VoiceButton({ onResult, isListening, setIsListening }: VoiceButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isMountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Force MP3 format as it's widely supported
      const mimeType = 'audio/mp3';
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('MP3 format is not supported in this browser');
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // Set a reasonable bitrate
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('Audio chunk received:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = async () => {
        if (!isMountedRef.current) return;
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        console.log('Final Audio Blob:', {
          size: audioBlob.size,
          type: audioBlob.type,
          chunks: audioChunksRef.current.length
        });
        
        await transcribeAudio(audioBlob);
        
        cleanupTimeoutRef.current = setTimeout(() => {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          mediaRecorderRef.current = null;
          setIsListening(false);
        }, 100);
      };

      mediaRecorder.start(100);
      setIsListening(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please check your microphone permissions.');
      setIsListening(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsListening(false);
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      console.log('Sending audio to API:', {
        size: audioBlob.size,
        type: audioBlob.type
      });

      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.mp3');
      formData.append('model', 'whisper-1');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);
        throw new Error(errorData.error || `Transcription failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.text) {
        onResult(data.text);
      } else {
        setError('No speech detected. Please try again.');
      }
    } catch (err) {
      console.error('Error transcribing audio:', err);
      setError('Failed to transcribe audio. Please try again.');
    }
  };

  return (
    <div className="voice-button-container">
      <button 
        className={`voice-button ${isListening ? 'listening' : ''}`}
        onClick={isListening ? stopRecording : startRecording}
        aria-label={isListening ? "Stop recording" : "Start recording"}
      >
        {isListening ? 'Stop Recording' : 'Start Recording'}
        <div className={`pulse-ring ${isListening ? 'animate' : ''}`}></div>
      </button>
      
      {error && <p className="error-message">{error}</p>}
    </div>
  );
} 