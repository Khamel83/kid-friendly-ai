import { useState, useEffect, useRef } from 'react';

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

  useEffect(() => {
    isMountedRef.current = true;
    // Ensure cleanup happens on unmount
    return () => {
      isMountedRef.current = false;
      // Call stopRecording to ensure resources are released
      // Need to pass the current state/refs if needed, or ensure stopRecording uses refs
      stopRecordingInternal(); 
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = []; // Reset chunks
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100, // Ensure consistent sample rate
          channelCount: 1
        }
      });
      streamRef.current = stream;
      
      // Create audio context if it doesn't exist or is closed
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext();
      }
      const audioContext = audioContextRef.current;
      sourceNodeRef.current = audioContext.createMediaStreamSource(stream);
      processorRef.current = audioContext.createScriptProcessor(4096, 1, 1);

      const processor = processorRef.current;
      const source = sourceNodeRef.current;
      
      processor.onaudioprocess = (e) => {
        // Use the ref to access isListening state
        if (isListening) { 
          // Make a copy of the data to ensure it's not overwritten
          audioChunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination); // Connect processor to destination
      
      setIsListening(true);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Check mic permissions & use Chrome.');
      setIsListening(false);
      cleanupAudioResources(); // Ensure cleanup on error
    }
  };

  // Renamed to avoid conflict with the exported stopRecording
  const stopRecordingInternal = async () => {
    if (!isListening && !streamRef.current) return; // Check if already stopped or never started
    
    console.log("Stopping recording...");
    setIsListening(false); // Set state immediately

    cleanupAudioResources();

    // Process accumulated chunks
    if (audioChunksRef.current.length > 0) {
      console.log(`Processing ${audioChunksRef.current.length} audio chunks.`);
      try {
        const wavBlob = convertToWav(audioChunksRef.current);
        console.log('Final Audio Blob:', {
          size: wavBlob.size,
          type: wavBlob.type
        });

        // Check blob size again before sending
        if (wavBlob.size <= 44) {
            console.error('Warning: WAV blob size is suspiciously small. No audio data captured?');
            setError('No audio detected. Please try speaking louder or closer to the mic.');
            return; // Don't attempt transcription if likely empty
        }

        await transcribeAudio(wavBlob);
      } catch (err) {
        console.error('Error processing or transcribing audio:', err);
        setError('Failed to process recording. Please try again.');
      } finally {
         audioChunksRef.current = []; // Clear chunks after processing
      }
    } else {
      console.warn('No audio chunks recorded.');
      setError('No audio recorded. Please try again.');
    }
  };

  // Helper function for cleanup
  const cleanupAudioResources = () => {
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

    // Close audio context (optional, can be reused)
    // if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
    //   audioContextRef.current.close().then(() => console.log("Audio context closed."));
    // }
  };

  const convertToWav = (chunks: Float32Array[]): Blob => {
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
        // Return an empty blob or throw an error, here returning minimal header
        // Although the check in stopRecordingInternal should prevent this
        return new Blob([new ArrayBuffer(44)], { type: 'audio/wav' }); 
    }
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    // Create WAV header buffer
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // RIFF identifier
    view.setUint32(0, 0x46464952, false); // "RIFF"
    // File size (header size + data size)
    view.setUint32(4, 36 + totalLength * bytesPerSample, true);
    // WAVE identifier
    view.setUint32(8, 0x45564157, false); // "WAVE"
    // fmt chunk identifier
    view.setUint32(12, 0x20746d66, false); // "fmt "
    // fmt chunk length
    view.setUint32(16, 16, true); // 16 for PCM
    // Audio format (PCM)
    view.setUint16(20, format, true);
    // Number of channels
    view.setUint16(22, numChannels, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint32(28, sampleRate * blockAlign, true);
    // Block align (NumChannels * BitsPerSample/8)
    view.setUint16(32, blockAlign, true);
    // Bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    view.setUint32(36, 0x61746164, false); // "data"
    // data chunk size
    view.setUint32(40, totalLength * bytesPerSample, true);
    
    // Convert Float32 data to 16-bit PCM
    const pcmData = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        // Scale to 16-bit range
        pcmData[offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
    }
    
    // Combine header and PCM data
    const wavBlob = new Blob([view, pcmData.buffer], { type: 'audio/wav' });
    
    return wavBlob;
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      console.log('Sending audio to API:', {
        size: audioBlob.size,
        type: audioBlob.type
      });

      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      // No need to append model here if it's handled by the API route
      // formData.append('model', 'whisper-1'); 

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);
        // Provide more specific error based on status
        let errorMessage = `Transcription failed with status ${response.status}`;
        if (errorData.error) {
          errorMessage = errorData.error; // Use error message from API if available
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.text && data.text.trim() !== "") {
        onResult(data.text);
      } else {
         console.warn("Transcription result is empty or whitespace.")
        // More specific feedback if transcription is empty
        setError('Could not understand audio. Please try speaking clearly.');
      }
    } catch (err) {
      console.error('Error transcribing audio:', err);
      // Set error state based on the caught error message
      setError(err instanceof Error ? err.message : 'Failed to transcribe audio. Please try again.');
    } 
  };

  return (
    <div className="voice-button-container">
      <button 
        className={`voice-button ${isListening ? 'listening' : ''}`}
        onClick={isListening ? stopRecordingInternal : startRecording} // Use internal stop function
        aria-label={isListening ? "Stop recording" : "Start recording"}
      >
        {isListening ? 'Stop Recording' : 'Start Recording'}
        <div className={`pulse-ring ${isListening ? 'animate' : ''}`}></div>
      </button>
      
      {error && <p className="error-message">{error}</p>}
    </div>
  );
} 