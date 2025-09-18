/**
 * Enhanced Sound Effects Module
 *
 * This module extends the existing SoundManager with the enhanced capabilities
 * while maintaining backward compatibility with existing code.
 */

import { EnhancedSoundManager } from './soundManager';
import { SoundEffectConfig } from '../types/sound';

// Export the enhanced manager as the default SoundManager for backward compatibility
// Export will be at the end of file

// Re-export any other needed functions for backward compatibility
export const getInstance = () => EnhancedSoundManager.getInstance();

// Additional utility functions
export const playSound = async (soundId: string, config?: Partial<SoundEffectConfig>) => {
  const manager = EnhancedSoundManager.getInstance();
  return manager.playSound(soundId, config);
};

export const stopSound = (sessionId: string) => {
  const manager = EnhancedSoundManager.getInstance();
  return manager.stopSound(sessionId);
};

export const setVolume = (volume: number) => {
  const manager = EnhancedSoundManager.getInstance();
  manager.setMasterVolume(volume);
};

export const toggleMute = () => {
  const manager = EnhancedSoundManager.getInstance();
  manager.toggleMute();
};

// Keep the original class name for backward compatibility
export class SoundManager extends EnhancedSoundManager {
  private static instance: SoundManager;

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  // Override the play method to maintain backward compatibility
  async play(soundName: string, volume: number = 0.5): Promise<void> {
    try {
      await this.playSound(soundName, { volume });
    } catch (error) {
      console.warn('Failed to play sound:', error);
    }
  }

  // Keep convenience methods
  playStart() { this.play('start', 0.3); }
  playEnd() { this.play('end', 0.3); }
  playSuccess() { this.play('success', 0.4); }
  playCheer() { this.play('cheer', 0.5); }
  playError() { this.play('error', 0.3); }
}

// Export the SoundManager class (this is the only export)