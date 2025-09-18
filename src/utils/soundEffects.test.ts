import { SoundManager } from './soundEffects';

// Mock AudioContext
const mockAudioContext = {
  createBufferSource: jest.fn().mockReturnValue({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
  }),
  createGain: jest.fn().mockReturnValue({
    connect: jest.fn(),
    gain: { value: 1 },
  }),
  decodeAudioData: jest.fn().mockResolvedValue({}),
  resume: jest.fn(),
  state: 'suspended',
};

global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext) as any;

describe('SoundManager', () => {
  let soundManager: SoundManager;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    originalFetch = global.fetch;

    // Mock fetch for sound loading
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('start.mp3')) {
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        } as Response);
      }
      if (url.includes('end.mp3')) {
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        } as Response);
      }
      return Promise.reject(new Error('Sound not found'));
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SoundManager.getInstance();
      const instance2 = SoundManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Sound Loading', () => {
    it('should load sounds on initialization', async () => {
      soundManager = SoundManager.getInstance();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async loading

      expect(fetch).toHaveBeenCalledWith('/sounds/start.mp3');
      expect(fetch).toHaveBeenCalledWith('/sounds/end.mp3');
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(2);
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Should not throw error
      expect(() => {
        SoundManager.getInstance();
      }).not.toThrow();
    });
  });

  describe('Sound Playback', () => {
    beforeEach(async () => {
      soundManager = SoundManager.getInstance();
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for loading
    });

    it('should play loaded sounds', async () => {
      const bufferSource = mockAudioContext.createBufferSource();
      const gainNode = mockAudioContext.createGain();

      await soundManager.play('start', 0.8);

      expect(bufferSource.connect).toHaveBeenCalledWith(gainNode);
      expect(gainNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);
      expect(bufferSource.start).toHaveBeenCalledWith(0);
      expect(gainNode.gain.value).toBe(0.8);
    });

    it('should handle missing sounds gracefully', async () => {
      // Should not throw error for missing sound
      await expect(soundManager.play('nonexistent' as any)).resolves.not.toThrow();
    });

    it('should resume audio context if suspended', async () => {
      mockAudioContext.state = 'suspended';
      const resumeSpy = jest.spyOn(mockAudioContext, 'resume');

      await soundManager.play('start');

      expect(resumeSpy).toHaveBeenCalled();
    });

    it('should generate programmatic sounds', async () => {
      // Test success sound generation
      await soundManager.play('success');
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();

      // Test error sound generation
      await soundManager.play('error');
      expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    });
  });

  describe('Volume Control', () => {
    beforeEach(async () => {
      soundManager = SoundManager.getInstance();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should use default volume when not specified', async () => {
      const gainNode = mockAudioContext.createGain();

      await soundManager.play('start');

      expect(gainNode.gain.value).toBe(0.5); // Default volume
    });

    it('should use custom volume when specified', async () => {
      const gainNode = mockAudioContext.createGain();

      await soundManager.play('start', 0.3);

      expect(gainNode.gain.value).toBe(0.3);
    });

    it('should clamp volume to valid range', async () => {
      const gainNode = mockAudioContext.createGain();

      // Test volume above 1.0
      await soundManager.play('start', 1.5);
      expect(gainNode.gain.value).toBe(1.0);

      // Test volume below 0
      await soundManager.play('start', -0.5);
      expect(gainNode.gain.value).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle AudioContext creation failure', () => {
      const originalAudioContext = global.AudioContext;
      global.AudioContext = undefined as any;

      expect(() => {
        SoundManager.getInstance();
      }).not.toThrow();

      global.AudioContext = originalAudioContext;
    });

    it('should handle decodeAudioData failure', async () => {
      mockAudioContext.decodeAudioData.mockRejectedValue(new Error('Decode error'));

      soundManager = SoundManager.getInstance();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still allow playing other sounds
      await expect(soundManager.play('success')).resolves.not.toThrow();
    });
  });
});