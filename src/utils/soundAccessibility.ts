/**
 * Sound Accessibility Utilities
 *
 * This module provides comprehensive accessibility features for sound effects with:
 * - Closed captioning for sound effects
 * - Visual alternatives to audio feedback
 * - Hearing impairment support
 * - Sound effect intensity mapping
 * - Alternative feedback mechanisms
 * - Audio description generation
 * - Vibration feedback integration
 * - Multi-sensory feedback systems
 */

import {
  SoundEffectConfig,
  SoundEffectCategory,
  SoundAccessibilityConfig,
  Vector3D
} from '../types/sound';

export interface AccessibilityProfile {
  visualFeedback: boolean;
  closedCaptions: boolean;
  vibrationFeedback: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  screenReader: boolean;
  soundIntensity: 'low' | 'medium' | 'high';
  alternativeFeedback: boolean;
  visualIndicators: boolean;
  textDescriptions: boolean;
}

export interface VisualFeedbackConfig {
  type: 'pulse' | 'bounce' | 'shake' | 'glow' | 'flash' | 'slide';
  duration: number;
  intensity: number;
  color: string;
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  size: 'small' | 'medium' | 'large';
}

export interface VibrationPattern {
  pattern: number[];
  intensity: number;
  repeat: boolean;
  description: string;
}

export interface ClosedCaptionConfig {
  text: string;
  duration: number;
  position: 'top' | 'bottom' | 'custom';
  style: 'simple' | 'enhanced' | 'minimal';
  color: string;
  backgroundColor: string;
  fontSize: 'small' | 'medium' | 'large';
}

export interface SoundDescription {
  soundId: string;
  name: string;
  category: SoundEffectCategory;
  description: string;
  intensity: number;
  emotionalImpact: string;
  context: string;
  alternatives: string[];
}

export class SoundAccessibilityManager {
  private static instance: SoundAccessibilityManager;
  private profile: AccessibilityProfile;
  private soundDescriptions: Map<string, SoundDescription> = new Map();
  private vibrationPatterns: Map<string, VibrationPattern> = new Map();
  private visualFeedbackElements: Map<string, HTMLElement> = new Map();
  private captionElements: Map<string, HTMLElement> = new Map();

  private constructor() {
    this.profile = this.getDefaultProfile();
    this.loadSoundDescriptions();
    this.loadVibrationPatterns();
    this.initializeEventListeners();
  }

  static getInstance(): SoundAccessibilityManager {
    if (!SoundAccessibilityManager.instance) {
      SoundAccessibilityManager.instance = new SoundAccessibilityManager();
    }
    return SoundAccessibilityManager.instance;
  }

  private getDefaultProfile(): AccessibilityProfile {
    return {
      visualFeedback: true,
      closedCaptions: true,
      vibrationFeedback: true,
      reducedMotion: false,
      highContrast: false,
      screenReader: false,
      soundIntensity: 'medium',
      alternativeFeedback: true,
      visualIndicators: true,
      textDescriptions: true
    };
  }

  private loadSoundDescriptions(): void {
    // Load predefined sound descriptions
    const descriptions: SoundDescription[] = [
      {
        soundId: 'click',
        name: 'Click Sound',
        category: 'ui',
        description: 'A soft clicking sound indicating a button press',
        intensity: 0.3,
        emotionalImpact: 'neutral',
        context: 'User interface interaction',
        alternatives: ['visual button press', 'haptic feedback', 'screen reader announcement']
      },
      {
        soundId: 'success',
        name: 'Success Chime',
        category: 'success',
        description: 'A pleasant ascending chime indicating successful completion',
        intensity: 0.6,
        emotionalImpact: 'positive',
        context: 'Task completion or achievement',
        alternatives: ['success animation', 'confetti effect', 'achievement badge']
      },
      {
        soundId: 'error',
        name: 'Error Beep',
        category: 'error',
        description: 'A descending beep indicating an error or problem',
        intensity: 0.5,
        emotionalImpact: 'negative',
        context: 'Input validation failure or system error',
        alternatives: ['error message display', 'shake animation', 'color change indicator']
      },
      {
        soundId: 'notification',
        name: 'Notification Ping',
        category: 'notification',
        description: 'A short ping sound for new notifications',
        intensity: 0.4,
        emotionalImpact: 'informative',
        context: 'System notifications or alerts',
        alternatives: ['notification badge', 'popup alert', 'status bar update']
      },
      {
        soundId: 'cheer',
        name: 'Celebration Fanfare',
        category: 'success',
        description: 'A cheerful fanfare for celebrations and achievements',
        intensity: 0.8,
        emotionalImpact: 'excited',
        context: 'Major achievements or celebrations',
        alternatives: ['celebration animation', 'particle effects', 'victory screen']
      }
    ];

    descriptions.forEach(desc => {
      this.soundDescriptions.set(desc.soundId, desc);
    });
  }

  private loadVibrationPatterns(): void {
    const patterns: VibrationPattern[] = [
      {
        pattern: [50],
        intensity: 0.5,
        repeat: false,
        description: 'Short vibration for feedback'
      },
      {
        pattern: [30, 50, 30],
        intensity: 0.7,
        repeat: false,
        description: 'Triple vibration for success'
      },
      {
        pattern: [100, 50, 100],
        intensity: 0.8,
        repeat: false,
        description: 'Double long vibration for errors'
      },
      {
        pattern: [20, 30, 20, 30, 20],
        intensity: 0.6,
        repeat: false,
        description: 'Pattern vibration for notifications'
      },
      {
        pattern: [10, 20, 10, 20, 10, 20, 10],
        intensity: 0.4,
        repeat: true,
        description: 'Continuous light vibration for ongoing actions'
      }
    ];

    patterns.forEach((pattern, index) => {
      this.vibrationPatterns.set(`pattern_${index}`, pattern);
    });
  }

  private initializeEventListeners(): void {
    // Listen for system accessibility preferences
    if (window.matchMedia) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');

      prefersReducedMotion.addEventListener('change', (e) => {
        this.profile.reducedMotion = e.matches;
      });

      prefersHighContrast.addEventListener('change', (e) => {
        this.profile.highContrast = e.matches;
      });
    }

    // Listen for screen reader
    if ('ariaHidden' in document.documentElement) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
            // Screen reader detection logic
            this.detectScreenReader();
          }
        });
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['aria-hidden']
      });
    }
  }

  private detectScreenReader(): void {
    // Simple screen reader detection
    const hasScreenReader = document.querySelector('[aria-live]') !== null ||
      document.querySelector('[aria-busy="true"]') !== null;

    this.profile.screenReader = hasScreenReader;
  }

  // Public API methods
  updateProfile(updates: Partial<AccessibilityProfile>): void {
    this.profile = { ...this.profile, ...updates };
    this.saveProfile();
    this.applyProfile();
  }

  getProfile(): AccessibilityProfile {
    return { ...this.profile };
  }

  private saveProfile(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('soundAccessibilityProfile', JSON.stringify(this.profile));
      } catch (error) {
        console.error('Failed to save accessibility profile:', error);
      }
    }
  }

  private loadProfile(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('soundAccessibilityProfile');
        if (saved) {
          this.profile = { ...this.profile, ...JSON.parse(saved) };
        }
      } catch (error) {
        console.error('Failed to load accessibility profile:', error);
      }
    }
  }

  private applyProfile(): void {
    // Apply visual preferences
    if (this.profile.highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }

    if (this.profile.reducedMotion) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }

    // Apply screen reader preferences
    if (this.profile.screenReader) {
      document.documentElement.setAttribute('aria-live', 'polite');
    }
  }

  // Sound event handling
  async onSoundPlayed(soundId: string, config: SoundEffectConfig): Promise<void> {
    const description = this.soundDescriptions.get(soundId);
    if (!description) return;

    // Provide visual feedback
    if (this.profile.visualFeedback) {
      this.showVisualFeedback(description, config);
    }

    // Show closed captions
    if (this.profile.closedCaptions) {
      this.showClosedCaption(description);
    }

    // Provide vibration feedback
    if (this.profile.vibrationFeedback) {
      this.triggerVibration(description);
    }

    // Announce to screen reader
    if (this.profile.screenReader) {
      this.announceToScreenReader(description);
    }

    // Generate alternative feedback
    if (this.profile.alternativeFeedback) {
      this.generateAlternativeFeedback(description);
    }
  }

  private showVisualFeedback(description: SoundDescription, config: SoundEffectConfig): void {
    if (this.profile.reducedMotion) {
      this.showMinimalVisualFeedback(description);
    } else {
      this.showEnhancedVisualFeedback(description, config);
    }
  }

  private showMinimalVisualFeedback(description: SoundDescription): void {
    const feedbackId = `feedback_${description.soundId}_${Date.now()}`;

    // Create a simple color change or border flash
    const element = document.createElement('div');
    element.className = 'sound-feedback-minimal';
    element.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: ${this.getIntensityColor(description.intensity)};
      opacity: 0.8;
      z-index: 9999;
      pointer-events: none;
      animation: fadeInOut 1s ease-in-out;
    `;

    document.body.appendChild(element);
    this.visualFeedbackElements.set(feedbackId, element);

    // Remove after animation
    setTimeout(() => {
      element.remove();
      this.visualFeedbackElements.delete(feedbackId);
    }, 1000);
  }

  private showEnhancedVisualFeedback(description: SoundDescription, config: SoundEffectConfig): void {
    const feedbackId = `feedback_${description.soundId}_${Date.now()}`;

    const element = document.createElement('div');
    element.className = 'sound-feedback-enhanced';

    const feedbackConfig = this.getVisualFeedbackConfig(description, config);

    element.style.cssText = `
      position: fixed;
      ${this.getPositionStyle(feedbackConfig.position)};
      width: ${this.getSizeStyle(feedbackConfig.size)};
      height: ${this.getSizeStyle(feedbackConfig.size)};
      border-radius: 50%;
      background: ${feedbackConfig.color};
      opacity: ${feedbackConfig.intensity};
      z-index: 9999;
      pointer-events: none;
      animation: ${this.getAnimationStyle(feedbackConfig.type)} ${feedbackConfig.duration}s ease-in-out;
    `;

    document.body.appendChild(element);
    this.visualFeedbackElements.set(feedbackId, element);

    // Remove after animation
    setTimeout(() => {
      element.remove();
      this.visualFeedbackElements.delete(feedbackId);
    }, feedbackConfig.duration * 1000);
  }

  private getVisualFeedbackConfig(description: SoundDescription, config: SoundEffectConfig): VisualFeedbackConfig {
    const intensity = description.intensity * (config.volume || 1);

    const typeMap: Record<string, VisualFeedbackConfig['type']> = {
      'positive': 'bounce',
      'negative': 'shake',
      'neutral': 'pulse',
      'informative': 'glow',
      'excited': 'flash'
    };

    return {
      type: typeMap[description.emotionalImpact] || 'pulse',
      duration: Math.max(0.5, Math.min(2, intensity * 2)),
      intensity: Math.max(0.3, Math.min(1, intensity)),
      color: this.getEmotionalColor(description.emotionalImpact),
      position: 'center',
      size: intensity > 0.7 ? 'large' : intensity > 0.4 ? 'medium' : 'small'
    };
  }

  private getIntensityColor(intensity: number): string {
    if (intensity > 0.7) return '#ff6b6b';
    if (intensity > 0.4) return '#ffe66d';
    return '#4ecdc4';
  }

  private getEmotionalColor(impact: string): string {
    const colors: Record<string, string> = {
      'positive': '#6bcf7f',
      'negative': '#ff6b6b',
      'neutral': '#4ecdc4',
      'informative': '#ffe66d',
      'excited': '#ff8cc8'
    };

    return colors[impact] || '#4ecdc4';
  }

  private getPositionStyle(position: string): string {
    const positions: Record<string, string> = {
      'center': 'top: 50%; left: 50%; transform: translate(-50%, -50%);',
      'top': 'top: 20px; left: 50%; transform: translateX(-50%);',
      'bottom': 'bottom: 20px; left: 50%; transform: translateX(-50%);',
      'left': 'left: 20px; top: 50%; transform: translateY(-50%);',
      'right': 'right: 20px; top: 50%; transform: translateY(-50%);'
    };

    return positions[position] || positions.center;
  }

  private getSizeStyle(size: string): string {
    const sizes: Record<string, string> = {
      'small': '30px',
      'medium': '50px',
      'large': '70px'
    };

    return sizes[size] || sizes.medium;
  }

  private getAnimationStyle(type: string): string {
    const animations: Record<string, string> = {
      'pulse': 'pulse',
      'bounce': 'bounce',
      'shake': 'shake',
      'glow': 'glow',
      'flash': 'flash',
      'slide': 'slide'
    };

    return animations[type] || animations.pulse;
  }

  private showClosedCaption(description: SoundDescription): void {
    const captionId = `caption_${description.soundId}_${Date.now()}`;

    const element = document.createElement('div');
    element.className = 'sound-caption';
    element.setAttribute('role', 'alert');
    element.setAttribute('aria-live', 'polite');

    element.textContent = description.description;

    element.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${this.profile.highContrast ? '#000' : 'rgba(0, 0, 0, 0.8)'};
      color: ${this.profile.highContrast ? '#fff' : '#fff'};
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 10000;
      pointer-events: none;
      animation: slideUp 0.3s ease-out, slideDown 0.3s ease-in 2.7s;
    `;

    document.body.appendChild(element);
    this.captionElements.set(captionId, element);

    // Remove after 3 seconds
    setTimeout(() => {
      element.remove();
      this.captionElements.delete(captionId);
    }, 3000);
  }

  private triggerVibration(description: SoundDescription): void {
    if (!('vibrate' in navigator)) return;

    const pattern = this.getVibrationPattern(description);
    if (pattern) {
      navigator.vibrate(pattern.pattern);
    }
  }

  private getVibrationPattern(description: SoundDescription): VibrationPattern | null {
    const patternMap: Record<string, string> = {
      'positive': 'pattern_1',
      'negative': 'pattern_2',
      'neutral': 'pattern_0',
      'informative': 'pattern_3',
      'excited': 'pattern_4'
    };

    const patternId = patternMap[description.emotionalImpact] || 'pattern_0';
    return this.vibrationPatterns.get(patternId) || null;
  }

  private announceToScreenReader(description: SoundDescription): void {
    const announcement = `Sound: ${description.name}. ${description.description}`;

    // Create or use existing live region
    let liveRegion = document.getElementById('sound-announcements');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'sound-announcements';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = announcement;

    // Clear after announcement
    setTimeout(() => {
      liveRegion.textContent = '';
    }, 1000);
  }

  private generateAlternativeFeedback(description: SoundDescription): void {
    // Generate alternative feedback based on sound description
    const alternatives = description.alternatives || [];

    if (alternatives.length > 0) {
      const selectedAlternative = alternatives[0]; // Simple selection

      switch (selectedAlternative) {
        case 'visual button press':
          this.simulateButtonPress();
          break;
        case 'success animation':
          this.showSuccessAnimation();
          break;
        case 'error message display':
          this.showErrorMessage();
          break;
        case 'notification badge':
          this.showNotificationBadge();
          break;
        default:
          this.showGenericFeedback(selectedAlternative);
      }
    }
  }

  private simulateButtonPress(): void {
    // Find the most recently clicked element and add visual feedback
    const activeElement = document.activeElement;
    if (activeElement && activeElement instanceof HTMLElement) {
      activeElement.style.transform = 'scale(0.95)';
      setTimeout(() => {
        activeElement.style.transform = '';
      }, 150);
    }
  }

  private showSuccessAnimation(): void {
    const animation = document.createElement('div');
    animation.className = 'success-animation';
    animation.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 60px;
      z-index: 9999;
      pointer-events: none;
      animation: successPulse 1s ease-out;
    `;
    animation.textContent = '✓';
    document.body.appendChild(animation);

    setTimeout(() => {
      animation.remove();
    }, 1000);
  }

  private showErrorMessage(): void {
    // Show a subtle error indicator
    const indicator = document.createElement('div');
    indicator.className = 'error-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 10px;
      height: 10px;
      background: #ff6b6b;
      border-radius: 50%;
      z-index: 9999;
      animation: errorPulse 2s ease-in-out;
    `;
    document.body.appendChild(indicator);

    setTimeout(() => {
      indicator.remove();
    }, 2000);
  }

  private showNotificationBadge(): void {
    // Add a notification badge to the first available notification element
    const notificationElement = document.querySelector('[role="notification"]') ||
      document.querySelector('.notification') ||
      document.querySelector('.badge');

    if (notificationElement) {
      const badge = document.createElement('span');
      badge.className = 'notification-badge';
      badge.textContent = '!';
      badge.style.cssText = `
        background: #ff6b6b;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        margin-left: 5px;
        animation: badgePulse 1s ease-in-out;
      `;
      notificationElement.appendChild(badge);

      setTimeout(() => {
        badge.remove();
      }, 3000);
    }
  }

  private showGenericFeedback(feedbackType: string): void {
    const feedback = document.createElement('div');
    feedback.className = 'generic-feedback';
    feedback.textContent = feedbackType;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 20px;
      font-size: 14px;
      z-index: 10000;
      animation: fadeInOut 2s ease-in-out;
    `;
    document.body.appendChild(feedback);

    setTimeout(() => {
      feedback.remove();
    }, 2000);
  }

  // Utility methods
  addSoundDescription(description: SoundDescription): void {
    this.soundDescriptions.set(description.soundId, description);
  }

  removeSoundDescription(soundId: string): boolean {
    return this.soundDescriptions.delete(soundId);
  }

  getSoundDescription(soundId: string): SoundDescription | null {
    return this.soundDescriptions.get(soundId) || null;
  }

  getAllSoundDescriptions(): SoundDescription[] {
    return Array.from(this.soundDescriptions.values());
  }

  isSupported(feature: keyof AccessibilityProfile): boolean {
    switch (feature) {
      case 'vibrationFeedback':
        return 'vibrate' in navigator;
      case 'screenReader':
        return 'ariaHidden' in document.documentElement;
      case 'visualFeedback':
      case 'closedCaptions':
      case 'alternativeFeedback':
        return true;
      default:
        return false;
    }
  }

  getSupportedFeatures(): Partial<AccessibilityProfile> {
    const supported: Partial<AccessibilityProfile> = {};

    Object.keys(this.profile).forEach(key => {
      const feature = key as keyof AccessibilityProfile;
      if (this.isSupported(feature)) {
        supported[feature] = this.profile[feature];
      }
    });

    return supported;
  }

  clearAllFeedback(): void {
    // Clear visual feedback elements
    this.visualFeedbackElements.forEach(element => element.remove());
    this.visualFeedbackElements.clear();

    // Clear caption elements
    this.captionElements.forEach(element => element.remove());
    this.captionElements.clear();
  }

  exportProfile(): string {
    return JSON.stringify(this.profile, null, 2);
  }

  importProfile(profileData: string): boolean {
    try {
      const imported = JSON.parse(profileData);
      this.updateProfile(imported);
      return true;
    } catch (error) {
      console.error('Failed to import accessibility profile:', error);
      return false;
    }
  }

  resetProfile(): void {
    this.profile = this.getDefaultProfile();
    this.saveProfile();
    this.applyProfile();
  }
}

// Export CSS animations
export const soundAccessibilityCSS = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(20px); }
    20% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-20px); }
  }

  @keyframes slideUp {
    from { transform: translate(-50%, 20px); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
  }

  @keyframes slideDown {
    from { transform: translate(-50%, 0); opacity: 1; }
    to { transform: translate(-50%, 20px); opacity: 0; }
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); opacity: 0.8; }
  }

  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-20px); }
    60% { transform: translateY(-10px); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }

  @keyframes glow {
    0% { box-shadow: 0 0 5px rgba(78, 205, 196, 0.5); }
    50% { box-shadow: 0 0 20px rgba(78, 205, 196, 0.8); }
    100% { box-shadow: 0 0 5px rgba(78, 205, 196, 0.5); }
  }

  @keyframes flash {
    0%, 50%, 100% { opacity: 0.8; }
    25%, 75% { opacity: 1; }
  }

  @keyframes successPulse {
    0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
  }

  @keyframes errorPulse {
    0% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.5); opacity: 1; }
    100% { transform: scale(1); opacity: 0.8; }
  }

  @keyframes badgePulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }

  .high-contrast {
    filter: contrast(1.2);
  }

  .reduced-motion * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
`;

// Add CSS to document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = soundAccessibilityCSS;
  document.head.appendChild(styleElement);
}