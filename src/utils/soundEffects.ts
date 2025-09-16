export class SoundManager {
  private static instance: SoundManager;
  private audioContext: AudioContext | null = null;
  private sounds: { [key: string]: AudioBuffer } = {};

  private constructor() {
    if (typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.loadSounds();
    }
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private async loadSounds() {
    if (!this.audioContext) return;

    try {
      // Load existing sounds
      const startResponse = await fetch('/sounds/start.mp3');
      const startArrayBuffer = await startResponse.arrayBuffer();
      this.sounds.start = await this.audioContext.decodeAudioData(startArrayBuffer);

      const endResponse = await fetch('/sounds/end.mp3');
      const endArrayBuffer = await endResponse.arrayBuffer();
      this.sounds.end = await this.audioContext.decodeAudioData(endArrayBuffer);

      // Generate additional sounds programmatically
      this.generateSuccessSound();
      this.generateCheerSound();
      this.generateErrorSound();
    } catch (error) {
      console.warn('Error loading sounds:', error);
    }
  }

  private generateSuccessSound() {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.3;
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Create a pleasant ascending chime
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 523.25 + (t / duration) * 261.63; // C5 to E6
      data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 3) * 0.3;
    }

    this.sounds.success = buffer;
  }

  private generateCheerSound() {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.8;
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Create a cheerful fanfare
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C
      const freqIndex = Math.floor(t * 8) % frequencies.length;
      const frequency = frequencies[freqIndex];
      data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 2) * 0.2;
    }

    this.sounds.cheer = buffer;
  }

  private generateErrorSound() {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.2;
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Create a gentle descending sound
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 440 - (t / duration) * 110; // A4 descending
      data[i] = Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 5) * 0.2;
    }

    this.sounds.error = buffer;
  }

  async play(soundName: string, volume: number = 0.5) {
    if (!this.audioContext || !this.sounds[soundName]) return;

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = this.sounds[soundName];
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start();
    } catch (error) {
      console.warn('Error playing sound:', error);
    }
  }

  // Convenience methods
  playStart() { this.play('start', 0.3); }
  playEnd() { this.play('end', 0.3); }
  playSuccess() { this.play('success', 0.4); }
  playCheer() { this.play('cheer', 0.5); }
  playError() { this.play('error', 0.3); }
}