/**
 * Tests for Enhanced Speech Controller
 */

import { SpeechController } from '../controllers/speechController';
import { AudioProcessor } from './audioProcessor';
import { SpeechQualityEnhancer } from './speechEnhancer';

// Mock the browser APIs
global.AudioContext = class {
  sampleRate = 16000;
  state = 'suspended';
  audioWorklet = {
    addModule: jest.fn().mockResolvedValue(undefined)
  };
  createAnalyser = jest.fn().mockReturnValue({
    fftSize: 2048,
    smoothingTimeConstant: 0.8,
    connect: jest.fn(),
    getFloatFrequencyData: jest.fn()
  });
  createMediaStreamSource = jest.fn().mockReturnValue({
    connect: jest.fn()
  });
  resume = jest.fn().mockResolvedValue(undefined);
  close = jest.fn().mockResolvedValue(undefined);
  createBufferSource = jest.fn().mockReturnValue({
    connect: jest.fn(),
    start: jest.fn()
  });
  destination = {};
} as any;

global.AudioWorkletNode = class {
  port = { onmessage: null };
  parameters = new Map();
  connect = jest.fn();
  disconnect = jest.fn();
  constructor(context: any, name: string, options: any) {
    // Mock parameters
    this.parameters.set('noiseReduction', { value: 0.5 });
    this.parameters.set('voiceThreshold', { value: 0.3 });
    this.parameters.set('gain', { value: 1.0 });
  }
};

global.navigator.mediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue({
    getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
  })
} as any;

global.fetch = jest.fn();

describe('SpeechController', () => {
  let speechController: SpeechController;

  beforeEach(() => {
    jest.clearAllMocks();
    speechController = new SpeechController();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(speechController).toBeDefined();
    });

    test('should initialize audio context', async () => {
      await speechController.initialize();
      expect(global.AudioContext).toHaveBeenCalled();
    });

    test('should handle initialization errors', async () => {
      (global.AudioContext as jest.Mock).mockImplementation(() => {
        throw new Error('AudioContext not supported');
      });

      await expect(speechController.initialize()).rejects.toThrow('Failed to initialize audio context');
    });
  });

  describe('Recording', () => {
    beforeEach(async () => {
      await speechController.initialize();
    });

    test('should start recording successfully', async () => {
      await speechController.startRecording();
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
          deviceId: 'default'
        }
      });
    });

    test('should stop recording and process audio', async () => {
      await speechController.startRecording();
      const result = await speechController.stopRecording();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    test('should handle recording errors', async () => {
      (global.navigator.mediaDevices.getUserMedia as jest.Mock)
        .mockRejectedValueOnce(new Error('Permission denied'));

      await expect(speechController.startRecording()).rejects.toThrow('Failed to start recording');
    });

    test('should not start recording if already recording', async () => {
      await speechController.startRecording();

      // Try to start recording again
      const errorSpy = jest.spyOn(console, 'error');
      await speechController.startRecording();

      expect(errorSpy).toHaveBeenCalledWith('Already recording');
    });
  });

  describe('Event handling', () => {
    test('should add and remove event listeners', () => {
      const listener = jest.fn();
      speechController.addEventListener('start', listener);
      speechController.removeEventListener('start', listener);

      // Should not throw
      expect(() => {
        speechController.removeEventListener('start', listener);
      }).not.toThrow();
    });

    test('should emit events correctly', async () => {
      const startListener = jest.fn();
      const stopListener = jest.fn();
      const errorListener = jest.fn();

      speechController.addEventListener('start', startListener);
      speechController.addEventListener('stop', stopListener);
      speechController.addEventListener('error', errorListener);

      await speechController.initialize();
      await speechController.startRecording();
      await speechController.stopRecording();

      expect(startListener).toHaveBeenCalled();
      expect(stopListener).toHaveBeenCalled();
    });
  });

  describe('Audio processing', () => {
    test('should combine audio chunks correctly', () => {
      const chunk1 = new Float32Array([1, 2, 3]);
      const chunk2 = new Float32Array([4, 5, 6]);

      // Set up audio chunks
      (speechController as any).audioChunks = [chunk1, chunk2];

      const combined = (speechController as any).combineAudioChunks();

      expect(combined).toEqual(new Float32Array([1, 2, 3, 4, 5, 6]));
    });

    test('should convert audio to WAV format', () => {
      const audio = new Float32Array([0.5, -0.5, 0.25, -0.25]);
      const wavBlob = (speechController as any).convertToWav(audio);

      expect(wavBlob).toBeInstanceOf(Blob);
      expect(wavBlob.type).toBe('audio/wav');
      expect(wavBlob.size).toBeGreaterThan(0);
    });

    test('should calculate average audio level', () => {
      (speechController as any).audioLevels = [0.1, 0.2, 0.3, 0.4];
      const averageLevel = (speechController as any).calculateAverageAudioLevel();

      expect(averageLevel).toBe(0.25);
    });
  });

  describe('Configuration', () => {
    test('should update configuration correctly', async () => {
      await speechController.initialize();
      await speechController.startRecording();

      speechController.updateConfig({
        language: 'es-ES',
        noiseReduction: 0.8,
        voiceThreshold: 0.5
      });

      // Verify the configuration was updated
      expect((speechController as any).config.language).toBe('es-ES');
      expect((speechController as any).config.noiseReduction).toBe(0.8);
      expect((speechController as any).config.voiceThreshold).toBe(0.5);
    });

    test('should handle privacy mode changes', async () => {
      await speechController.initialize();

      speechController.updateConfig({ privacyMode: 'local' });
      expect((speechController as any).config.privacyMode).toBe('local');

      speechController.updateConfig({ privacyMode: 'cloud' });
      expect((speechController as any).config.privacyMode).toBe('cloud');
    });
  });

  describe('Visualization data', () => {
    test('should generate visualization data', async () => {
      await speechController.initialize();
      await speechController.startRecording();

      const vizData = speechController.getVisualizationData();

      expect(vizData).toBeDefined();
      expect(vizData.frequencyData).toBeInstanceOf(Float32Array);
      expect(vizData.audioLevel).toBeGreaterThanOrEqual(0);
      expect(typeof vizData.isVoiceActive).toBe('boolean');
    });

    test('should provide performance statistics', async () => {
      await speechController.initialize();
      await speechController.startRecording();

      const stats = speechController.getPerformanceStats();

      expect(stats).toBeDefined();
      expect(stats.processingTime).toBeGreaterThanOrEqual(0);
      expect(stats.chunksProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await speechController.initialize();
      await speechController.startRecording();

      await speechController.cleanup();

      // Verify cleanup happened
      expect((speechController as any).audioContext).toBeNull();
      expect((speechController as any).audioChunks).toEqual([]);
    });
  });
});

describe('AudioProcessor', () => {
  let audioProcessor: AudioProcessor;

  beforeEach(() => {
    audioProcessor = new AudioProcessor();
  });

  describe('Audio processing', () => {
    test('should process audio with noise reduction', () => {
      const audio = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

      const result = audioProcessor.processAudio(audio, {
        noiseReductionLevel: 0.5,
        voiceThreshold: 0.3,
        gain: 1.0,
        echoCancellation: true,
        sampleRate: 16000,
        enableVAD: true,
        enableAGC: true
      });

      expect(result.processedAudio).toBeInstanceOf(Float32Array);
      expect(result.metrics).toBeDefined();
      expect(result.vadResult).toBeDefined();
    });

    test('should generate visualization data', () => {
      const audio = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

      const vizData = audioProcessor.generateVisualizationData(audio);

      expect(vizData.waveform).toBeInstanceOf(Float32Array);
      expect(vizData.frequency).toBeInstanceOf(Float32Array);
      expect(vizData.amplitude).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('SpeechQualityEnhancer', () => {
  let enhancer: SpeechQualityEnhancer;

  beforeEach(() => {
    enhancer = new SpeechQualityEnhancer();
  });

  describe('Speech enhancement', () => {
    test('should enhance speech quality', async () => {
      const audio = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

      const result = await enhancer.enhanceSpeech(audio, {
        enableLanguageDetection: true,
        enableSpeechRateAdjustment: true,
        enableVolumeNormalization: true,
        enableBackgroundNoiseSuppression: true,
        enableVoiceIsolation: true,
        enableQualityAssessment: true,
        targetLanguages: ['en-US', 'es-ES'],
        adaptiveEnhancement: true
      });

      expect(result.audio).toBeInstanceOf(Float32Array);
      expect(result.language).toBeDefined();
      expect(result.quality).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });
});

describe('Integration tests', () => {
  test('should handle complete speech recognition workflow', async () => {
    const controller = new SpeechController();

    // Initialize
    await controller.initialize();

    // Start recording
    await controller.startRecording();

    // Add some audio data
    (controller as any).audioChunks.push(new Float32Array([0.1, 0.2, 0.3]));

    // Stop recording and get result
    const result = await controller.stopRecording();

    // Verify result
    expect(result).toBeDefined();
    expect(result.transcript).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);

    // Cleanup
    await controller.cleanup();
  });

  test('should handle error scenarios gracefully', async () => {
    const controller = new SpeechController();

    // Mock a failure
    (global.navigator.mediaDevices.getUserMedia as jest.Mock)
      .mockRejectedValueOnce(new Error('Microphone not found'));

    // Should handle the error
    await expect(controller.startRecording()).rejects.toThrow();

    // Should still be able to cleanup
    await controller.cleanup();
  });
});