/**
 * Sound Composition Utilities
 *
 * This module provides advanced sound composition capabilities with:
 * - Dynamic sound generation
 * - Sound effect mixing and layering
 * - Audio filters and effects (reverb, delay, etc.)
 * - Procedural sound generation
 * - Music generation algorithms
 * - Sound effect variation and randomization
 * - Audio waveform manipulation
 * - Sound effect synthesis
 */

import {
  AudioEffect,
  SoundEffectConfig,
  SoundPlaybackSession,
  ProceduralSoundConfig,
  ADSREnvelope,
  ModulationConfig,
  SoundMixerConfig,
  MixerTrack,
  AudioProcessingConfig
} from '../types/sound';

export interface CompositionConfig {
  sampleRate: number;
  bufferSize: number;
  channels: number;
  bitDepth: number;
}

export interface WaveformConfig {
  type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise' | 'custom';
  frequency: number;
  amplitude: number;
  phase?: number;
  dutyCycle?: number; // For square wave
  harmonics?: number[]; // For complex waveforms
}

export interface FilterConfig {
  type: 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'peaking' | 'lowshelf' | 'highshelf';
  frequency: number;
  Q?: number;
  gain?: number;
}

export interface ReverbConfig {
  decayTime: number;
  preDelay: number;
  wetLevel: number;
  dryLevel: number;
  roomSize: number;
  damping: number;
}

export interface DelayConfig {
  delayTime: number;
  feedback: number;
  wetLevel: number;
  dryLevel: number;
  mix: number;
}

export interface CompressorConfig {
  threshold: number;
  knee: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
}

export interface ChorusConfig {
  rate: number;
  depth: number;
  feedback: number;
  delay: number;
  mix: number;
}

export class SoundComposer {
  private audioContext: AudioContext | null = null;
  private config: CompositionConfig;
  private mixer: SoundMixer | null = null;
  private effects: Map<string, AudioEffectNode> = new Map();
  private synthesizers: Map<string, Synthesizer> = new Map();

  constructor(config: Partial<CompositionConfig> = {}) {
    this.config = {
      sampleRate: 48000,
      bufferSize: 2048,
      channels: 2,
      bitDepth: 16,
      ...config
    };

    if (typeof window !== 'undefined') {
      this.initializeAudioContext();
    }
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive'
      });

      this.mixer = new SoundMixer(this.audioContext);
      console.log('Sound Composer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioContext for Sound Composer:', error);
    }
  }

  // Waveform generation
  generateWaveform(
    config: WaveformConfig,
    duration: number,
    envelope?: ADSREnvelope
  ): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const sampleRate = this.audioContext.sampleRate;
    const samples = Math.floor(sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      switch (config.type) {
        case 'sine':
          sample = Math.sin(2 * Math.PI * config.frequency * t + (config.phase || 0));
          break;
        case 'square':
          sample = Math.sign(Math.sin(2 * Math.PI * config.frequency * t + (config.phase || 0)));
          break;
        case 'sawtooth':
          sample = 2 * (t * config.frequency - Math.floor(t * config.frequency + 0.5));
          break;
        case 'triangle':
          sample = 2 * Math.abs(2 * (t * config.frequency - Math.floor(t * config.frequency + 0.5))) - 1;
          break;
        case 'noise':
          sample = Math.random() * 2 - 1;
          break;
        case 'custom':
          sample = this.generateCustomWaveform(config, t);
          break;
      }

      // Apply harmonics if specified
      if (config.harmonics) {
        for (let h = 0; h < config.harmonics.length; h++) {
          const harmonic = config.harmonics[h];
          sample += (harmonic / (h + 2)) * Math.sin(2 * Math.PI * config.frequency * (h + 2) * t);
        }
        sample /= config.harmonics.length + 1;
      }

      // Apply amplitude
      sample *= config.amplitude;

      // Apply envelope if provided
      if (envelope) {
        const envelopeValue = this.applyEnvelope(envelope, t, duration);
        sample *= envelopeValue;
      }

      data[i] = sample;
    }

    return buffer;
  }

  private generateCustomWaveform(config: WaveformConfig, t: number): number {
    // Custom waveform generation - can be overridden for specific sounds
    return Math.sin(2 * Math.PI * config.frequency * t) *
           Math.sin(2 * Math.PI * config.frequency * t * 0.5); // Example: frequency modulation
  }

  private applyEnvelope(envelope: ADSREnvelope, t: number, duration: number): number {
    const attackTime = envelope.attack;
    const decayTime = envelope.decay;
    const sustainLevel = envelope.sustain;
    const releaseTime = envelope.release;

    if (t < attackTime) {
      // Attack phase
      return (t / attackTime) * envelope.peak;
    } else if (t < attackTime + decayTime) {
      // Decay phase
      const decayProgress = (t - attackTime) / decayTime;
      return envelope.peak - (envelope.peak - sustainLevel) * decayProgress;
    } else if (t < duration - releaseTime) {
      // Sustain phase
      return sustainLevel;
    } else {
      // Release phase
      const releaseProgress = (t - (duration - releaseTime)) / releaseTime;
      return sustainLevel * (1 - releaseProgress);
    }
  }

  // Procedural sound generation
  generateProceduralSound(config: ProceduralSoundConfig): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    let buffer: AudioBuffer;

    switch (config.type) {
      case 'tone':
        buffer = this.generateTone(config);
        break;
      case 'chord':
        buffer = this.generateChord(config);
        break;
      case 'sequence':
        buffer = this.generateSequence(config);
        break;
      case 'ambient':
        buffer = this.generateAmbient(config);
        break;
      case 'noise':
        buffer = this.generateNoise(config);
        break;
      default:
        throw new Error(`Unknown procedural sound type: ${config.type}`);
    }

    return buffer;
  }

  private generateTone(config: ProceduralSoundConfig): AudioBuffer {
    const frequency = config.params.frequency || 440;
    const waveform: WaveformConfig = {
      type: 'sine',
      frequency,
      amplitude: config.params.amplitude || 0.5
    };

    return this.generateWaveform(waveform, config.duration, config.envelope);
  }

  private generateChord(config: ProceduralSoundConfig): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const root = config.params.root || 440;
    const chordType = config.params.chordType || 'major';
    const sampleRate = this.audioContext.sampleRate;
    const samples = Math.floor(sampleRate * config.duration);
    const buffer = this.audioContext.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    // Calculate chord frequencies
    const frequencies = this.calculateChordFrequencies(root, chordType);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      // Mix all chord frequencies
      for (const freq of frequencies) {
        sample += Math.sin(2 * Math.PI * freq * t) * (config.params.amplitude || 0.3);
      }

      // Apply envelope
      if (config.envelope) {
        sample *= this.applyEnvelope(config.envelope, t, config.duration);
      }

      data[i] = sample / frequencies.length; // Normalize
    }

    return buffer;
  }

  private calculateChordFrequencies(root: number, chordType: string): number[] {
    const intervals: Record<string, number[]> = {
      major: [0, 4, 7],
      minor: [0, 3, 7],
      diminished: [0, 3, 6],
      augmented: [0, 4, 8],
      seventh: [0, 4, 7, 10],
      major7th: [0, 4, 7, 11],
      minor7th: [0, 3, 7, 10]
    };

    const chordIntervals = intervals[chordType] || intervals.major;
    return chordIntervals.map(interval => root * Math.pow(2, interval / 12));
  }

  private generateSequence(config: ProceduralSoundConfig): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const notes = config.params.notes || [440, 523, 659, 784]; // A, C, E, G
    const tempo = config.params.tempo || 120;
    const sampleRate = this.audioContext.sampleRate;
    const beatDuration = 60 / tempo;
    const totalDuration = config.duration;
    const samples = Math.floor(sampleRate * totalDuration);
    const buffer = this.audioContext.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    let currentNote = 0;
    let noteStartTime = 0;

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const noteProgress = (t - noteStartTime) / beatDuration;

      if (noteProgress >= 1) {
        currentNote = (currentNote + 1) % notes.length;
        noteStartTime = t;
      }

      const frequency = notes[currentNote];
      let sample = Math.sin(2 * Math.PI * frequency * t) * (config.params.amplitude || 0.3);

      // Apply envelope for each note
      if (config.envelope) {
        const noteDuration = Math.min(beatDuration, totalDuration - noteStartTime);
        sample *= this.applyEnvelope(config.envelope, t - noteStartTime, noteDuration);
      }

      data[i] = sample;
    }

    return buffer;
  }

  private generateAmbient(config: ProceduralSoundConfig): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const sampleRate = this.audioContext.sampleRate;
    const samples = Math.floor(sampleRate * config.duration);
    const buffer = this.audioContext.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;

      // Generate ambient sound using multiple sine waves and noise
      let sample = 0;

      // Low frequency drones
      sample += Math.sin(2 * Math.PI * 55 * t) * 0.1;
      sample += Math.sin(2 * Math.PI * 110 * t) * 0.08;

      // Mid frequency texture
      sample += Math.sin(2 * Math.PI * 220 * t * (1 + Math.sin(t * 0.5) * 0.1)) * 0.05;

      // High frequency shimmer
      sample += Math.sin(2 * Math.PI * 880 * t) * 0.03;

      // Noise for texture
      sample += (Math.random() - 0.5) * 0.02;

      // Apply slow amplitude modulation
      sample *= (1 + Math.sin(t * 0.2) * 0.3);

      // Apply envelope
      if (config.envelope) {
        sample *= this.applyEnvelope(config.envelope, t, config.duration);
      }

      data[i] = sample;
    }

    return buffer;
  }

  private generateNoise(config: ProceduralSoundConfig): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const sampleRate = this.audioContext.sampleRate;
    const samples = Math.floor(sampleRate * config.duration);
    const buffer = this.audioContext.createBuffer(1, samples, sampleRate);
    const data = buffer.getChannelData(0);

    const noiseType = config.params.type || 'white';
    const amplitude = config.params.amplitude || 0.5;

    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      let sample = 0;

      switch (noiseType) {
        case 'white':
          sample = (Math.random() - 0.5) * 2;
          break;
        case 'pink':
          // Pink noise has equal power per octave
          sample = this.generatePinkNoise();
          break;
        case 'brown':
          // Brown noise has more power at lower frequencies
          sample = this.generateBrownNoise();
          break;
      }

      sample *= amplitude;

      // Apply filtering if specified
      if (config.params.filterFrequency) {
        sample = this.applySimpleFilter(sample, config.params.filterFrequency, sampleRate);
      }

      // Apply envelope
      if (config.envelope) {
        sample *= this.applyEnvelope(config.envelope, t, config.duration);
      }

      data[i] = sample;
    }

    return buffer;
  }

  private generatePinkNoise(): number {
    // Simple pink noise approximation
    const white = Math.random() - 0.5;
    return white * 0.5 + (Math.random() - 0.5) * 0.3 + (Math.random() - 0.5) * 0.2;
  }

  private generateBrownNoise(): number {
    // Brown noise using random walk
    const lastValue = this.lastBrownValue || 0;
    const white = Math.random() - 0.5;
    const brown = (lastValue + white * 0.1) * 0.998;
    this.lastBrownValue = brown;
    return brown;
  }

  private lastBrownValue: number = 0;

  private applySimpleFilter(sample: number, frequency: number, sampleRate: number): number {
    // Simple low-pass filter approximation
    const alpha = frequency / (sampleRate * 2);
    return sample * (1 - alpha) + (this.lastFilterValue || 0) * alpha;
  }

  private lastFilterValue: number = 0;

  // Audio effects
  createReverb(config: ReverbConfig): ConvolverNode | null {
    if (!this.audioContext) return null;

    const convolver = this.audioContext.createConvolver();
    const length = this.audioContext.sampleRate * config.decayTime;
    const impulse = this.audioContext.createBuffer(2, length, this.audioContext.sampleRate);

    // Create impulse response
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, config.damping);
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  createDelay(config: DelayConfig): DelayNode | null {
    if (!this.audioContext) return null;

    const delay = this.audioContext.createDelay(config.delayTime);
    const feedback = this.audioContext.createGain();
    const wetGain = this.audioContext.createGain();
    const dryGain = this.audioContext.createGain();

    delay.delayTime.value = config.delayTime;
    feedback.gain.value = config.feedback;
    wetGain.gain.value = config.wetLevel;
    dryGain.gain.value = config.dryLevel;

    // Connect the delay loop
    delay.connect(feedback);
    feedback.connect(delay);

    this.effects.set('delay', delay);
    return delay;
  }

  createFilter(config: FilterConfig): BiquadFilterNode | null {
    if (!this.audioContext) return null;

    const filter = this.audioContext.createBiquadFilter();
    filter.type = config.type;
    filter.frequency.value = config.frequency;

    if (config.Q !== undefined) filter.Q.value = config.Q;
    if (config.gain !== undefined) filter.gain.value = config.gain;

    this.effects.set('filter', filter);
    return filter;
  }

  createCompressor(config: CompressorConfig): DynamicsCompressorNode | null {
    if (!this.audioContext) return null;

    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = config.threshold;
    compressor.knee.value = config.knee;
    compressor.ratio.value = config.ratio;
    compressor.attack.value = config.attack;
    compressor.release.value = config.release;

    this.effects.set('compressor', compressor);
    return compressor;
  }

  createChorus(config: ChorusConfig): { input: GainNode, output: GainNode } | null {
    if (!this.audioContext) return null;

    const input = this.audioContext.createGain();
    const output = this.audioContext.createGain();
    const delay1 = this.audioContext.createDelay(0.1);
    const delay2 = this.audioContext.createDelay(0.1);
    const gain1 = this.audioContext.createGain();
    const gain2 = this.audioContext.createGain();

    delay1.delayTime.value = config.delay;
    delay2.delayTime.value = config.delay + 0.01;

    gain1.gain.value = config.feedback;
    gain2.gain.value = config.feedback;

    // Create LFO modulation
    const lfo1 = this.audioContext.createOscillator();
    const lfoGain1 = this.audioContext.createGain();
    lfo1.frequency.value = config.rate;
    lfoGain1.gain.value = config.depth * 0.01;

    lfo1.connect(lfoGain1);
    lfoGain1.connect(delay1.delayTime);

    lfo1.start();

    input.connect(delay1);
    input.connect(delay2);
    delay1.connect(gain1);
    delay2.connect(gain2);
    gain1.connect(output);
    gain2.connect(output);

    this.effects.set('chorus', delay1);
    return { input, output };
  }

  // Sound mixing and layering
  createSoundMixer(config: SoundMixerConfig): SoundMixer | null {
    if (!this.audioContext) return null;

    return new SoundMixer(this.audioContext, config);
  }

  // Music generation
  generateMelody(
    scale: number[],
    rhythm: number[],
    tempo: number,
    duration: number
  ): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    const sampleRate = this.audioContext.sampleRate;
    const beatDuration = 60 / tempo;
    const totalSamples = Math.floor(sampleRate * duration);
    const buffer = this.audioContext.createBuffer(1, totalSamples, sampleRate);
    const data = buffer.getChannelData(0);

    let currentBeat = 0;
    let currentNote = 0;

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      const beatProgress = (t / beatDuration) - currentBeat;

      if (beatProgress >= rhythm[currentNote % rhythm.length]) {
        currentBeat++;
        currentNote++;
      }

      const frequency = scale[currentNote % scale.length];
      let sample = Math.sin(2 * Math.PI * frequency * t) * 0.3;

      // Apply note envelope
      const noteDuration = beatDuration * rhythm[currentNote % rhythm.length];
      const noteProgress = (t - currentBeat * beatDuration) / noteDuration;
      sample *= Math.exp(-noteProgress * 3);

      data[i] = sample;
    }

    return buffer;
  }

  // Utility methods
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  getEffects(): Map<string, AudioEffectNode> {
    return new Map(this.effects);
  }

  clearEffects(): void {
    this.effects.clear();
  }

  isInitialized(): boolean {
    return this.audioContext !== null;
  }
}

// Sound mixer class for advanced mixing
class SoundMixer {
  private audioContext: AudioContext;
  private tracks: Map<string, MixerTrack> = new Map();
  private masterEffects: AudioEffectNode[] = [];
  private masterGain: GainNode;
  private output: AudioNode;

  constructor(audioContext: AudioContext, config?: SoundMixerConfig) {
    this.audioContext = audioContext;
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = 1.0;
    this.output = this.masterGain;

    if (config) {
      this.loadConfig(config);
    }
  }

  private loadConfig(config: SoundMixerConfig): void {
    // Create tracks
    config.tracks.forEach(trackConfig => {
      this.createTrack(trackConfig);
    });

    // Create master effects
    config.masterEffects.forEach(effectConfig => {
      this.createMasterEffect(effectConfig);
    });
  }

  createTrack(config: MixerTrack): string {
    const track: MixerTrack = {
      ...config,
      id: config.id || this.generateTrackId(),
      effects: []
    };

    // Create audio nodes for the track
    const gain = this.audioContext.createGain();
    gain.gain.value = config.volume;

    track.audioNode = gain;
    this.tracks.set(track.id, track);

    return track.id;
  }

  private createMasterEffect(config: AudioEffect): void {
    // Create master effect based on type
    // This would be implemented based on specific effect types
  }

  private generateTrackId(): string {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getTrack(id: string): MixerTrack | null {
    return this.tracks.get(id) || null;
  }

  getTracks(): MixerTrack[] {
    return Array.from(this.tracks.values());
  }

  connectTo(destination: AudioNode): void {
    this.output.connect(destination);
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.value = volume;
  }
}

// Synthesizer class for advanced sound synthesis
class Synthesizer {
  private audioContext: AudioContext;
  private oscillators: OscillatorNode[] = [];
  private filters: BiquadFilterNode[] = [];
  private envelopes: ADSREnvelope[] = [];
  private output: GainNode;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.output = audioContext.createGain();
    this.output.gain.value = 0.5;
  }

  playNote(frequency: number, duration: number, velocity: number = 0.5): void {
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gain.gain.value = velocity;

    oscillator.connect(gain);
    gain.connect(this.output);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);

    this.oscillators.push(oscillator);
  }

  connectTo(destination: AudioNode): void {
    this.output.connect(destination);
  }

  setVolume(volume: number): void {
    this.output.gain.value = volume;
  }
}