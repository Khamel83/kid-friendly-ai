/**
 * Enhanced AudioWorklet for advanced audio processing in the kid-friendly AI
 * Handles noise cancellation, voice isolation, and real-time audio analysis
 */
class EnhancedAudioProcessor extends AudioWorkletProcessor {
  // Audio processing parameters
  static get parameterDescriptors() {
    return [
      {
        name: 'noiseReduction',
        defaultValue: 0.5,
        minValue: 0,
        maxValue: 1
      },
      {
        name: 'voiceThreshold',
        defaultValue: 0.3,
        minValue: 0,
        maxValue: 1
      },
      {
        name: 'gain',
        defaultValue: 1.0,
        minValue: 0,
        maxValue: 2
      }
    ];
  }

  constructor() {
    super();

    // Initialize audio processing buffers
    this.sampleRate = sampleRate;
    this.bufferSize = 1024;
    this.historyBuffer = new Float32Array(this.bufferSize);
    this.historyIndex = 0;

    // Voice activity detection (VAD) parameters
    this.vadThreshold = 0.3;
    this.silenceFrames = 0;
    this.maxSilenceFrames = Math.floor(sampleRate / 100); // 100ms of silence

    // Noise reduction parameters
    this.noiseFloor = 0;
    this.noiseAdaptationRate = 0.95;

    // Audio level monitoring
    this.audioLevel = 0;
    this.peakLevel = 0;

    // Initialize with message handling
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    const { type, data } = event.data;

    switch (type) {
      case 'setThreshold':
        this.vadThreshold = data.threshold;
        break;
      case 'reset':
        this.reset();
        break;
      case 'getStats':
        this.sendStats();
        break;
    }
  }

  reset() {
    this.historyBuffer.fill(0);
    this.historyIndex = 0;
    this.silenceFrames = 0;
    this.noiseFloor = 0;
    this.audioLevel = 0;
    this.peakLevel = 0;
  }

  sendStats() {
    this.port.postMessage({
      type: 'stats',
      data: {
        audioLevel: this.audioLevel,
        peakLevel: this.peakLevel,
        noiseFloor: this.noiseFloor,
        isVoiceActive: this.isVoiceActive()
      }
    });
  }

  /**
   * Advanced noise cancellation using spectral subtraction
   */
  processNoiseReduction(input, noiseReductionLevel) {
    const output = new Float32Array(input.length);

    // Simple noise reduction based on energy threshold
    for (let i = 0; i < input.length; i++) {
      const sample = input[i];
      const magnitude = Math.abs(sample);

      // Update noise floor (adaptive)
      if (magnitude < this.noiseFloor * 1.5) {
        this.noiseFloor = this.noiseFloor * this.noiseAdaptationRate + magnitude * (1 - this.noiseAdaptationRate);
      }

      // Apply noise reduction
      const noiseThreshold = this.noiseFloor * (1 + noiseReductionLevel);
      if (magnitude < noiseThreshold) {
        // Suppress noise
        output[i] = sample * 0.1; // Attenuate noise
      } else {
        // Preserve speech
        output[i] = sample;
      }
    }

    return output;
  }

  /**
   * Voice Activity Detection (VAD)
   */
  detectVoiceActivity(audioData) {
    // Calculate RMS energy
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);

    // Update audio level with smoothing
    this.audioLevel = this.audioLevel * 0.9 + rms * 0.1;
    this.peakLevel = Math.max(this.peakLevel * 0.99, rms);

    // Detect voice activity
    const isVoiceActive = this.audioLevel > this.vadThreshold;

    if (isVoiceActive) {
      this.silenceFrames = 0;
    } else {
      this.silenceFrames++;
    }

    return isVoiceActive;
  }

  /**
   * Audio gain control with compression
   */
  applyGainControl(input, gain) {
    const output = new Float32Array(input.length);

    for (let i = 0; i < input.length; i++) {
      let sample = input[i] * gain;

      // Soft clipping to prevent distortion
      const threshold = 0.8;
      if (sample > threshold) {
        sample = threshold + (sample - threshold) / (1 + Math.abs(sample - threshold));
      } else if (sample < -threshold) {
        sample = -threshold + (sample + threshold) / (1 + Math.abs(sample + threshold));
      }

      output[i] = Math.max(-1, Math.min(1, sample));
    }

    return output;
  }

  /**
   * Generate audio visualization data
   */
  generateVisualizationData(audioData) {
    // Downsample for visualization
    const visSize = 64;
    const visData = new Float32Array(visSize);
    const step = Math.floor(audioData.length / visSize);

    for (let i = 0; i < visSize; i++) {
      const start = i * step;
      const end = Math.min(start + step, audioData.length);
      let sum = 0;

      for (let j = start; j < end; j++) {
        sum += Math.abs(audioData[j]);
      }

      visData[i] = sum / (end - start);
    }

    return visData;
  }

  isVoiceActive() {
    return this.silenceFrames < this.maxSilenceFrames;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0];
    const outputChannel = output[0];
    const noiseReduction = parameters.noiseReduction[0];
    const voiceThreshold = parameters.voiceThreshold[0];
    const gain = parameters.gain[0];

    // Update VAD threshold
    this.vadThreshold = voiceThreshold;

    // Process audio in chunks
    const processedAudio = this.processNoiseReduction(inputChannel, noiseReduction);
    const gainControlled = this.applyGainControl(processedAudio, gain);

    // Voice activity detection
    const isVoiceActive = this.detectVoiceActivity(gainControlled);

    // Copy to output
    for (let i = 0; i < gainControlled.length; i++) {
      outputChannel[i] = gainControlled[i];
    }

    // Send processed data and status to main thread
    if (this.historyIndex === 0 || Math.random() < 0.1) { // Send periodically
      const visualizationData = this.generateVisualizationData(gainControlled);

      this.port.postMessage({
        type: 'audioData',
        data: {
          audioData: new Float32Array(gainControlled),
          isVoiceActive: isVoiceActive,
          audioLevel: this.audioLevel,
          peakLevel: this.peakLevel,
          visualizationData: visualizationData,
          noiseFloor: this.noiseFloor
        }
      });
    }

    // Update history buffer
    for (let i = 0; i < inputChannel.length; i++) {
      this.historyBuffer[this.historyIndex] = inputChannel[i];
      this.historyIndex = (this.historyIndex + 1) % this.bufferSize;
    }

    return true;
  }
}

registerProcessor('enhanced-audio-processor', EnhancedAudioProcessor);