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

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          channelCount: 1
        }
      });
      streamRef.current = stream;
      
      // Create audio context
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      const audioChunks: Float32Array[] = [];
      
      processor.onaudioprocess = (e) => {
        if (isListening) {
          audioChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsListening(true);
      
      // Store the audio context and processor for cleanup
      (window as any).audioContext = audioContext;
      (window as any).audioProcessor = processor;
      (window as any).audioChunks = audioChunks;
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording. Please check your microphone permissions and try using Chrome browser.');
      setIsListening(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const stopRecording = async () => {
    if (!isListening) return;
    
    try {
      setIsListening(false);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Get the recorded audio data
      const audioChunks = (window as any).audioChunks as Float32Array[];
      const audioContext = (window as any).audioContext as AudioContext;
      const processor = (window as any).audioProcessor as ScriptProcessorNode;
      
      if (processor) {
        processor.disconnect();
      }
      
      if (audioContext) {
        await audioContext.close();
      }
      
      // Convert Float32Array chunks to WAV format
      const wavBlob = convertToWav(audioChunks);
      console.log('Final Audio Blob:', {
        size: wavBlob.size,
        type: wavBlob.type
      });
      
      await transcribeAudio(wavBlob);
      
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError('Failed to process recording. Please try again.');
    }
  };

  const convertToWav = (audioChunks: Float32Array[]): Blob => {
    const sampleRate = 44100;
    const numChannels = 1;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    // Calculate total length
    let totalLength = 0;
    for (const chunk of audioChunks) {
      totalLength += chunk.length;
    }
    
    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    
    // Write WAV header
    view.setUint32(0, 0x46464952, true); // "RIFF"
    view.setUint32(4, 36 + totalLength * bytesPerSample, true); // file length
    view.setUint32(8, 0x45564157, true); // "WAVE"
    view.setUint32(12, 0x20746d66, true); // "fmt "
    view.setUint32(16, 16, true); // length of format chunk
    view.setUint16(20, format, true); // format type
    view.setUint16(22, numChannels, true); // number of channels
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, sampleRate * blockAlign, true); // bytes per second
    view.setUint16(32, blockAlign, true); // bytes per sample
    view.setUint16(34, bitDepth, true); // bits per sample
    view.setUint32(36, 0x61746164, true); // "data"
    view.setUint32(40, totalLength * bytesPerSample, true); // data length
    
    // Convert audio data to 16-bit PCM
    const pcmData = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcmData[offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
    }
    
    // Combine header and data
    const wavBlob = new Blob(
      [wavHeader, pcmData.buffer],
      { type: 'audio/wav' }
    );
    
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