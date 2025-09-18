/**
 * Enhanced Speech Controller for Kid-Friendly AI
 * Provides advanced speech-to-text processing with noise cancellation,
 * multi-language support, and real-time audio analysis
 */

export interface SpeechRecognitionConfig {
  noiseReduction: number;
  voiceThreshold: number;
  gain: number;
  language: string;
  autoLanguageDetection: boolean;
  continuous: boolean;
  interimResults: boolean;
  maxRecordingDuration: number; // in seconds
  silenceTimeout: number; // in seconds
  privacyMode: 'local' | 'cloud';
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  language?: string;
  audioLevel: number;
  processingTime: number;
}

export interface SpeechRecognitionEvent {
  type: 'start' | 'stop' | 'result' | 'error' | 'audioLevel' | 'voiceActivity';
  data?: any;
  timestamp: number;
}

export interface AudioVisualizationData {
  frequencyData: Float32Array;
  audioLevel: number;
  isVoiceActive: boolean;
  peakLevel: number;
}

export class SpeechController {
  private config: SpeechRecognitionConfig;
  private audioContext: AudioContext | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private isRecording = false;
  private audioChunks: Float32Array[] = [];
  private startTime: number | null = null;
  private silenceTimer: number | null = null;
  private voiceActivityDetected = false;

  // Event listeners
  private listeners: Map<string, ((event: SpeechRecognitionEvent) => void)[]> = new Map();

  // Performance monitoring
  private processingStartTime: number = 0;
  private audioLevels: number[] = [];
  private recognitionResults: SpeechRecognitionResult[] = [];

  constructor(config: Partial<SpeechRecognitionConfig> = {}) {
    this.config = {
      noiseReduction: 0.5,
      voiceThreshold: 0.3,
      gain: 1.0,
      language: 'en-US',
      autoLanguageDetection: true,
      continuous: false,
      interimResults: true,
      maxRecordingDuration: 120, // Allow longer recordings for kids
      silenceTimeout: 5, // Longer patience for kids
      privacyMode: 'cloud',
      ...config
    };
  }

  /**
   * Initialize audio context and worklet
   */
  async initialize(): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });

      // Load audio worklet
      await this.audioContext.audioWorklet.addModule('/enhanced-audio-processor.js');

      // Create analyser for visualization
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.emit('start', { message: 'Audio context initialized' });
    } catch (error) {
      this.emit('error', {
        message: 'Failed to initialize audio context',
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Start speech recognition
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      this.emit('error', { message: 'Already recording' });
      return;
    }

    try {
      if (!this.audioContext) {
        await this.initialize();
      }

      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Get media stream with enhanced constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
          deviceId: 'default'
        }
      });

      // Create audio worklet
      this.audioWorklet = new AudioWorkletNode(
        this.audioContext,
        'enhanced-audio-processor',
        {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          processorOptions: {
            sampleRate: 16000
          }
        }
      );

      // Set up audio processing chain
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.audioWorklet);
      this.audioWorklet.connect(this.analyser!);
      this.audioWorklet.connect(this.audioContext.destination);

      // Set up worklet message handling
      this.audioWorklet.port.onmessage = this.handleWorkletMessage.bind(this);

      // Initialize recording state
      this.isRecording = true;
      this.startTime = Date.now();
      this.audioChunks = [];
      this.voiceActivityDetected = false;
      this.processingStartTime = performance.now();

      // Set up timeout for maximum recording duration
      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording('maxDuration');
        }
      }, this.config.maxRecordingDuration * 1000);

      this.emit('start', {
        message: 'Recording started',
        timestamp: this.startTime,
        privacyMode: this.config.privacyMode
      });

    } catch (error) {
      this.emit('error', {
        message: 'Failed to start recording',
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Stop speech recognition
   */
  async stopRecording(reason: string = 'manual'): Promise<SpeechRecognitionResult | null> {
    if (!this.isRecording) {
      return null;
    }

    this.isRecording = false;
    const endTime = Date.now();
    const duration = (endTime - (this.startTime || endTime)) / 1000;

    try {
      // Stop media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }

      // Disconnect audio nodes
      if (this.audioWorklet) {
        this.audioWorklet.disconnect();
        this.audioWorklet = null;
      }

      // Clear silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      // Process recorded audio if we have data
      let result: SpeechRecognitionResult | null = null;
      if (this.audioChunks.length > 0) {
        result = await this.processAudio();
      }

      this.emit('stop', {
        message: 'Recording stopped',
        duration,
        reason,
        chunksProcessed: this.audioChunks.length
      });

      return result;

    } catch (error) {
      this.emit('error', {
        message: 'Failed to stop recording',
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Handle messages from audio worklet
   */
  private handleWorkletMessage(event: MessageEvent): void {
    const { type, data } = event.data;

    switch (type) {
      case 'audioData':
        this.handleAudioData(data);
        break;
      case 'stats':
        this.handleAudioStats(data);
        break;
    }
  }

  /**
   * Process incoming audio data
   */
  private handleAudioData(data: any): void {
    if (!this.isRecording) return;

    // Store audio chunk
    this.audioChunks.push(data.audioData);

    // Update voice activity detection
    const wasVoiceActive = this.voiceActivityDetected;
    this.voiceActivityDetected = data.isVoiceActive;

    // Emit audio level updates
    this.emit('audioLevel', {
      level: data.audioLevel,
      peak: data.peakLevel,
      noiseFloor: data.noiseFloor
    });

    // Handle voice activity changes
    if (data.isVoiceActive && !wasVoiceActive) {
      this.onVoiceActivityStart();
    } else if (!data.isVoiceActive && wasVoiceActive) {
      this.onVoiceActivityEnd();
    }

    // Store audio levels for analysis
    this.audioLevels.push(data.audioLevel);
    if (this.audioLevels.length > 100) {
      this.audioLevels.shift();
    }
  }

  /**
   * Handle audio statistics
   */
  private handleAudioStats(data: any): void {
    // Additional processing for audio statistics
    this.emit('audioLevel', {
      level: data.audioLevel,
      peak: data.peakLevel,
      noiseFloor: data.noiseFloor,
      isVoiceActive: data.isVoiceActive
    });
  }

  /**
   * Handle voice activity start
   */
  private onVoiceActivityStart(): void {
    // Clear silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    this.emit('voiceActivity', { active: true });
  }

  /**
   * Handle voice activity end
   */
  private onVoiceActivityEnd(): void {
    // Set silence timer for automatic stopping
    if (this.config.silenceTimeout > 0 && !this.config.continuous) {
      this.silenceTimer = window.setTimeout(() => {
        this.stopRecording('silence');
      }, this.config.silenceTimeout * 1000);
    }

    this.emit('voiceActivity', { active: false });
  }

  /**
   * Process recorded audio for transcription
   */
  private async processAudio(): Promise<SpeechRecognitionResult> {
    const processingStart = performance.now();

    try {
      // Combine audio chunks
      const combinedAudio = this.combineAudioChunks();

      // Apply noise reduction and enhancement
      const enhancedAudio = await this.enhanceAudio(combinedAudio);

      // Convert to WAV format
      const wavBlob = this.convertToWav(enhancedAudio);

      // Transcribe audio
      const transcription = await this.transcribeAudio(wavBlob);

      const processingTime = performance.now() - processingStart;
      const result: SpeechRecognitionResult = {
        transcript: transcription.text || '',
        confidence: transcription.confidence || 0,
        isFinal: true,
        language: transcription.language || this.config.language,
        audioLevel: this.calculateAverageAudioLevel(),
        processingTime
      };

      this.recognitionResults.push(result);
      this.emit('result', result);

      return result;

    } catch (error) {
      this.emit('error', {
        message: 'Failed to process audio',
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  /**
   * Combine audio chunks into a single buffer
   */
  private combineAudioChunks(): Float32Array {
    const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Float32Array(totalLength);

    let offset = 0;
    for (const chunk of this.audioChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined;
  }

  /**
   * Enhance audio with noise reduction and other processing
   */
  private async enhanceAudio(audio: Float32Array): Promise<Float32Array> {
    // Apply gain control
    const enhanced = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      enhanced[i] = audio[i] * this.config.gain;
    }

    // Additional enhancement can be added here
    return enhanced;
  }

  /**
   * Convert audio to WAV format
   */
  private convertToWav(audio: Float32Array): Blob {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitDepth = 16;
    const format = 1; // PCM

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataLength = audio.length * bytesPerSample;

    // Create WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // RIFF header
    view.setUint32(0, 0x46464952, true); // "RIFF"
    view.setUint32(4, 36 + dataLength, true);
    view.setUint32(8, 0x45564157, true); // "WAVE"

    // fmt chunk
    view.setUint32(12, 0x20746d66, true); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    view.setUint32(36, 0x61746164, true); // "data"
    view.setUint32(40, dataLength, true);

    // Convert to 16-bit PCM
    const pcmData = new Int16Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      const sample = Math.max(-1, Math.min(1, audio[i]));
      pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    return new Blob([wavHeader, pcmData.buffer], { type: 'audio/wav' });
  }

  /**
   * Transcribe audio using API
   */
  private async transcribeAudio(audioBlob: Blob): Promise<{ text: string; confidence?: number; language?: string }> {
    if (this.config.privacyMode === 'local') {
      // For local processing, return empty result (would integrate with local ML models)
      return { text: '', confidence: 0, language: this.config.language };
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');

    // Add language detection parameters
    const params = new URLSearchParams();
    if (this.config.autoLanguageDetection) {
      params.append('detect_language', 'true');
    } else {
      params.append('language', this.config.language);
    }

    const response = await fetch(`/api/transcribe?${params}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Transcription failed');
    }

    return response.json();
  }

  /**
   * Calculate average audio level
   */
  private calculateAverageAudioLevel(): number {
    if (this.audioLevels.length === 0) return 0;
    const sum = this.audioLevels.reduce((acc, level) => acc + level, 0);
    return sum / this.audioLevels.length;
  }

  /**
   * Get current audio visualization data
   */
  getVisualizationData(): AudioVisualizationData {
    if (!this.analyser || !this.isRecording) {
      return {
        frequencyData: new Float32Array(64),
        audioLevel: 0,
        isVoiceActive: false,
        peakLevel: 0
      };
    }

    const frequencyData = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(frequencyData);

    // Convert to normalized values
    const normalizedData = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      normalizedData[i] = Math.max(0, (frequencyData[i] + 100) / 100);
    }

    return {
      frequencyData: normalizedData,
      audioLevel: this.audioLevels[this.audioLevels.length - 1] || 0,
      isVoiceActive: this.voiceActivityDetected,
      peakLevel: Math.max(...this.audioLevels)
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const processingTime = performance.now() - this.processingStartTime;
    const averageAudioLevel = this.calculateAverageAudioLevel();

    return {
      processingTime,
      averageAudioLevel,
      recordingDuration: this.startTime ? (Date.now() - this.startTime) / 1000 : 0,
      chunksProcessed: this.audioChunks.length,
      voiceActivityRatio: this.recognitionResults.filter(r => r.transcript.length > 0).length / Math.max(1, this.recognitionResults.length)
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SpeechRecognitionConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update worklet parameters if active
    if (this.audioWorklet && this.audioWorklet.parameters) {
      if (this.audioWorklet.parameters.get('noiseReduction')) {
        this.audioWorklet.parameters.get('noiseReduction')!.value = this.config.noiseReduction;
      }
      if (this.audioWorklet.parameters.get('voiceThreshold')) {
        this.audioWorklet.parameters.get('voiceThreshold')!.value = this.config.voiceThreshold;
      }
      if (this.audioWorklet.parameters.get('gain')) {
        this.audioWorklet.parameters.get('gain')!.value = this.config.gain;
      }
    }
  }

  /**
   * Add event listener
   */
  addEventListener(type: string, listener: (event: SpeechRecognitionEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(type: string, listener: (event: SpeechRecognitionEvent) => void): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      const index = typeListeners.indexOf(listener);
      if (index > -1) {
        typeListeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(type: 'start' | 'stop' | 'result' | 'error' | 'audioLevel' | 'voiceActivity', data?: any): void {
    const event: SpeechRecognitionEvent = {
      type,
      data,
      timestamp: Date.now()
    };

    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in speech recognition event listener:', error);
        }
      });
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.isRecording) {
      await this.stopRecording('cleanup');
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.listeners.clear();
    this.audioChunks = [];
    this.audioLevels = [];
    this.recognitionResults = [];
  }
}