import { useState, useEffect, useRef, useCallback } from 'react';

// --- Simplify Props --- 
interface VoiceButtonProps {
  onResult: (text: string) => void;
  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
}
// --- End Simplify Props ---

export default function VoiceButton({ 
  onResult, 
  isListening, 
  setIsListening, 
}: VoiceButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<AudioWorkletNode | ScriptProcessorNode | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Helper function for cleanup (wrapped in useCallback)
  const cleanupAudioResources = useCallback(() => {
    console.log("Cleaning up audio resources...");
    
    // Disconnect and cleanup processor
    if (processorRef.current) {
      if ('port' in processorRef.current) {
        // AudioWorkletNode
        processorRef.current.port.close();
      } else {
        // ScriptProcessorNode
        processorRef.current.onaudioprocess = null;
      }
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    // Disconnect source
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
    
    // Clear audio chunks
    audioChunksRef.current = [];
  }, []);

  // Convert to WAV function (wrapped in useCallback)
  const convertToWav = useCallback((chunks: Float32Array[]): Blob => {
    const sampleRate = 16000; // Whisper requires 16kHz
    const numChannels = 1; // Mono audio
    const bitDepth = 16; // 16-bit PCM
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

    // Ensure audio length is optimal for Whisper (pad or trim to 30 seconds)
    const targetLength = 30 * sampleRate; // 30 seconds at 16kHz
    const audioData = new Float32Array(targetLength);
    let offset = 0;
    
    // Copy and pad/trim audio data
    for (const chunk of chunks) {
      const remainingSpace = targetLength - offset;
      if (remainingSpace <= 0) break;
      
      const copyLength = Math.min(chunk.length, remainingSpace);
      audioData.set(chunk.slice(0, copyLength), offset);
      offset += copyLength;
    }
    
    // If we didn't fill the buffer, pad with silence
    if (offset < targetLength) {
      audioData.fill(0, offset);
    }
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataLength = targetLength * bytesPerSample;
    
    // Create WAV header buffer
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // Write WAV header
    // RIFF chunk descriptor
    view.setUint32(0, 0x46464952, true); // "RIFF"
    view.setUint32(4, 36 + dataLength, true); // file length
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
    view.setUint32(40, dataLength, true); // data length
    
    // Convert Float32 data to 16-bit PCM
    const pcmData = new Int16Array(targetLength);
    for (let i = 0; i < targetLength; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Combine header and PCM data
    const wavBlob = new Blob([wavHeader, pcmData.buffer], { type: 'audio/wav' });
    
    console.log('Generated WAV file:', {
      sampleRate,
      numChannels,
      bitDepth,
      duration: targetLength / sampleRate,
      size: wavBlob.size,
      headerSize: wavHeader.byteLength,
      dataSize: pcmData.buffer.byteLength
    });
    
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

  const stopRecordingInternal = useCallback(async () => {
    if (!isListeningRef.current && !streamRef.current) {
      console.log("Stop recording called but not currently listening or stream not active.");
      return; 
    }
    if (!isListeningRef.current) {
      console.log("Already stopped recording.");
      return;
    }
    console.log("Stopping recording...");
    setIsListening(false); 
    const recordedChunks = [...audioChunksRef.current]; 
    audioChunksRef.current = []; 
    setError(null); 
    cleanupAudioResources();
    if (recordedChunks.length > 0) {
      console.log(`Processing ${recordedChunks.length} audio chunks.`);
      try {
        const wavBlob = convertToWav(recordedChunks);
        console.log('Final Audio Blob:', { size: wavBlob.size, type: wavBlob.type });
        if (wavBlob.size <= 44) {
            console.error('Warning: WAV blob size indicates no audio data captured.');
            setError('No audio detected. Please try speaking louder or closer to the mic.');
            return; 
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
    }
  }, [setIsListening, cleanupAudioResources, convertToWav, transcribeAudio]);

  const startRecording = async () => {
    setError(null); 
    try {
      audioChunksRef.current = []; 
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000, channelCount: 1, autoGainControl: true } });
      streamRef.current = stream;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        if (audioContextRef.current) await audioContextRef.current.close();
        audioContextRef.current = new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' });
        console.log('AudioContext created with sample rate:', audioContextRef.current.sampleRate);
      }
      const audioContext = audioContextRef.current;
      sourceNodeRef.current = audioContext.createMediaStreamSource(stream);
      try {
        await audioContext.audioWorklet.addModule('/audio-processor.js');
        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor', { numberOfInputs: 1, numberOfOutputs: 1, processorOptions: { sampleRate: 16000 } });
        workletNode.port.onmessage = (event: MessageEvent) => {
          if (isListeningRef.current) audioChunksRef.current.push(new Float32Array(event.data));
        };
        processorRef.current = workletNode;
      } catch (err) {
        console.warn('AudioWorklet not supported, falling back to ScriptProcessorNode');
        const scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
        scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
          if (isListeningRef.current) audioChunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };
        processorRef.current = scriptNode;
      }
      if (sourceNodeRef.current && processorRef.current) {
        sourceNodeRef.current.connect(processorRef.current);
        processorRef.current.connect(audioContext.destination);
      } else {
        throw new Error('Failed to create audio nodes');
      }
      console.log("Audio nodes connected, starting recording...");
      setIsListening(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      let message = 'Failed to start recording. Please check microphone settings/permissions.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.message.includes('permission denied')) {
          message = 'Microphone permission denied. Please allow access to your microphone.';
        } else if (err.name === 'NotFoundError' || err.message.includes('not found')) {
          message = 'No microphone found. Please ensure your microphone is connected.';
        } else if (err.message.includes('sampleRate')) {
          message = 'Could not set 16kHz sample rate. Please try a different microphone or browser.';
        }
      }
      setError(message); 
      setIsListening(false);
      cleanupAudioResources();
    }
  };
  
  // --- Simplify Button State Logic --- 
  const buttonText = isListening ? 'Stop Recording' : 'Talk';
  const buttonAction = isListening ? stopRecordingInternal : startRecording;
  const buttonClass = isListening ? 'recording' : 'idle'; // Use 'recording' class
  // --- End Simplify Button State Logic --- 

  return (
    <div className="voice-button-container">
      {/* Single button manages Talk/Stop Recording */}
      <button 
        className={`voice-button ${buttonClass}`} 
        onClick={buttonAction} 
        aria-label={buttonText} 
      >
        {buttonText} 
        {isListening && <div className="pulse-ring animate"></div>} 
      </button>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

// Dummy implementations for unchanged functions to satisfy TypeScript during edit
const _dummyCleanup = () => {};
const _dummyConvertToWav = (c: Float32Array[]): Blob => new Blob();
const _dummyTranscribe = async (b: Blob) => {}; 