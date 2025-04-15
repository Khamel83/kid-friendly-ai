import { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceButtonProps {
  onResult: (text: string) => void;
  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
}

export default function VoiceButton({ onResult, isListening, setIsListening }: VoiceButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);
  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]); 
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null); // Ref for source node
  const isListeningRef = useRef(isListening); // Ref to track listening state reliably in callbacks

  // Keep isListeningRef synced with the isListening prop/state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Helper function for cleanup (wrapped in useCallback)
  const cleanupAudioResources = useCallback(() => {
    console.log("Cleaning up audio resources...");
    // Disconnect nodes first
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null; // Remove handler
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    // Stop media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      console.log("Media stream stopped.");
    }

    // Optional: Close audio context - decided against closing automatically to allow reuse
    // if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
    //   audioContextRef.current.close().then(() => console.log("Audio context closed."));
    //   audioContextRef.current = null; 
    // }
  }, []); // No dependencies as it only interacts with refs

  // Convert to WAV function (wrapped in useCallback)
  const convertToWav = useCallback((chunks: Float32Array[]): Blob => {
    const sampleRate = 44100;
    const numChannels = 1;
    const bitDepth = 16;
    const format = 1; // PCM
    
    // Calculate total length
    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.length;
    }

    if (totalLength === 0) {
        console.error("Cannot convert to WAV: No audio data provided.");
        return new Blob([new ArrayBuffer(44)], { type: 'audio/wav' }); 
    }
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    
    // Create WAV header buffer
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // Write WAV header
    // RIFF chunk descriptor
    view.setUint32(0, 0x46464952, true); // "RIFF"
    view.setUint32(4, 36 + totalLength * bytesPerSample, true); // file length
    view.setUint32(8, 0x45564157, true); // "WAVE"
    
    // fmt sub-chunk
    view.setUint32(12, 0x20746d66, true); // "fmt "
    view.setUint32(16, 16, true); // length of format chunk
    view.setUint16(20, format, true); // format type
    view.setUint16(22, numChannels, true); // number of channels
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, byteRate, true); // byte rate
    view.setUint16(32, blockAlign, true); // block align
    view.setUint16(34, bitDepth, true); // bits per sample
    
    // data sub-chunk
    view.setUint32(36, 0x61746164, true); // "data"
    view.setUint32(40, totalLength * bytesPerSample, true); // data length
    
    // Convert Float32 data to 16-bit PCM
    const pcmData = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcmData[offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
    }
    
    // Combine header and PCM data
    const wavBlob = new Blob([wavHeader, pcmData.buffer], { type: 'audio/wav' });
    
    return wavBlob;
  }, []);

  // Transcribe function (wrapped in useCallback)
  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    // Reset error before transcription attempt
    setError(null); 
    try {
      console.log('Sending audio to API:', {
        size: audioBlob.size,
        type: audioBlob.type
      });

      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonError) {
          // Handle cases where the response is not valid JSON (e.g., plain text error)
          const textError = await response.text();
          console.error('API Error Response (non-JSON):', textError);
          throw new Error(`Transcription failed: ${response.status} ${response.statusText}. Server response: ${textError}`);
        }
        console.error('API Error Response:', errorData);
        let errorMessage = `Transcription failed with status ${response.status}`;
        if (errorData && errorData.error) {
          errorMessage = errorData.error; // Use error message from API if available
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.text && data.text.trim() !== "") {
        onResult(data.text);
      } else {
         console.warn("Transcription result is empty or whitespace.")
        setError('Could not understand audio. Please try speaking clearly.');
      }
    } catch (err) {
      console.error('Error transcribing audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to transcribe audio. Please try again.');
    } 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onResult]); // Dependency: onResult prop

  // Stop recording function (wrapped in useCallback)
  const stopRecordingInternal = useCallback(async () => {
    // Use the ref to check the *actual* current listening state
    if (!isListeningRef.current && !streamRef.current) {
      console.log("Stop recording called but not currently listening or stream not active.");
      return; 
    }
    
    // Prevent double-stopping
    if (!isListeningRef.current) {
      console.log("Already stopped recording.");
      return;
    }

    console.log("Stopping recording...");
    setIsListening(false); // Trigger state update which updates isListeningRef via useEffect

    // Get chunks *before* cleanup disconnects the processor
    const recordedChunks = [...audioChunksRef.current]; 
    audioChunksRef.current = []; // Clear chunks immediately after copying

    cleanupAudioResources();

    // Process accumulated chunks
    if (recordedChunks.length > 0) {
      console.log(`Processing ${recordedChunks.length} audio chunks.`);
      try {
        const wavBlob = convertToWav(recordedChunks);
        console.log('Final Audio Blob:', {
          size: wavBlob.size,
          type: wavBlob.type
        });

        // Check blob size again before sending
        if (wavBlob.size <= 44) {
            console.error('Warning: WAV blob size indicates no audio data captured.');
            setError('No audio detected. Please try speaking louder or closer to the mic.');
            return; // Don't attempt transcription if likely empty
        }

        await transcribeAudio(wavBlob);
      } catch (err) {
        console.error('Error processing or transcribing audio:', err);
        if (!(err instanceof Error && err.message.includes('Transcription failed'))) {
          setError('Failed to process recording. Please try again.');
        }
      }
    } else {
      console.warn('No audio chunks recorded.');
      if (!streamRef.current) {
         setError('Failed to start recording. Check mic permissions.');
      } else {
         setError('No audio recorded. Please try again.');
      }
    }
  }, [setIsListening, cleanupAudioResources, convertToWav, transcribeAudio]);

  // Effect for component mount/unmount cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Ensure cleanup happens on unmount
      // Use the ref value at the time of unmount
      if (isListeningRef.current) {
        stopRecordingInternal(); 
      }
    };
  }, [stopRecordingInternal]); // Dependency: stopRecordingInternal

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = []; // Reset chunks
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100, 
          channelCount: 1
        }
      });
      streamRef.current = stream;
      
      // Create audio context if it doesn't exist or is closed
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
         // Ensure any previous context is properly closed before creating a new one
         if (audioContextRef.current) {
             await audioContextRef.current.close();
         }
        audioContextRef.current = new AudioContext({ sampleRate: 44100 }); // Specify sample rate
        console.log('AudioContext created or reused.');
      }
      const audioContext = audioContextRef.current;
      
      // Create nodes
      sourceNodeRef.current = audioContext.createMediaStreamSource(stream);
      // Buffer size recommendation: power of 2, e.g., 4096. Larger buffer = more latency, smaller = more CPU
      processorRef.current = audioContext.createScriptProcessor(4096, 1, 1);

      const processor = processorRef.current;
      const source = sourceNodeRef.current;
      
      processor.onaudioprocess = (e) => {
        // Use the ref to check listening state reliably
        if (isListeningRef.current) { 
          // Get a copy of the input buffer data
          const inputData = e.inputBuffer.getChannelData(0);
          // Store a copy, not the original buffer
          audioChunksRef.current.push(new Float32Array(inputData)); 
        } else {
           // Optional: Log if process event fires while not listening, might indicate cleanup issue
           // console.log("onaudioprocess fired while not listening.");
        }
      };
      
      // Connect the nodes: source -> processor -> destination
      source.connect(processor);
      // It's important to connect the processor to the destination to keep the audio graph alive
      // even if you don't want to hear the live audio.
      processor.connect(audioContext.destination); 
      
      console.log("Audio nodes connected, starting listening state.");
      setIsListening(true); // Update state -> triggers useEffect -> updates isListeningRef
      
    } catch (err) {
      console.error('Error starting recording:', err);
      let message = 'Failed to start recording. Check mic permissions & use Chrome.';
      if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.message.includes('permission denied')) {
              message = 'Microphone permission denied. Please allow access.';
          } else if (err.name === 'NotFoundError' || err.message.includes('not found')) {
              message = 'No microphone found. Please ensure it is connected.';
          } else if (err.message.includes('sampleRate')) {
              message = 'Could not set desired audio sample rate (44.1kHz). Try a different mic or browser.';
          }
      }
      setError(message);
      setIsListening(false);
      cleanupAudioResources(); // Ensure cleanup on error
    }
  };


  return (
    <div className="voice-button-container">
      <button 
        className={`voice-button ${isListening ? 'listening' : ''}`}
        onClick={isListening ? stopRecordingInternal : startRecording} 
        aria-label={isListening ? "Stop recording" : "Start recording"}
      >
        {isListening ? 'Stop Recording' : 'Start Recording'}
        <div className={`pulse-ring ${isListening ? 'animate' : ''}`}></div>
      </button>
      
      {error && <p className="error-message">{error}</p>}
    </div>
  );
} 