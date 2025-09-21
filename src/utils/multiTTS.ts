/**
 * Multi-tier TTS system with quality fallbacks
 * Priority: ElevenLabs -> Azure -> OpenAI -> Browser (last resort)
 */

export interface TTSOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
}

export class MultiTTS {
  private currentProvider: 'elevenlabs' | 'azure' | 'openai' | 'browser' | null = null;

  constructor() {
    this.detectBestProvider();
  }

  /**
   * Detect the best available TTS provider
   */
  private async detectBestProvider(): Promise<void> {
    // Check for ElevenLabs (best quality, reasonable cost)
    if (await this.testElevenLabs()) {
      this.currentProvider = 'elevenlabs';
      console.log('🎯 Using ElevenLabs TTS (best quality)');
      return;
    }

    // Check for Azure Cognitive Services (good quality, cheap)
    if (await this.testAzure()) {
      this.currentProvider = 'azure';
      console.log('🎯 Using Azure TTS (good quality, cheap)');
      return;
    }

    // Check OpenAI (if billing is fixed)
    if (await this.testOpenAI()) {
      this.currentProvider = 'openai';
      console.log('🎯 Using OpenAI TTS');
      return;
    }

    // Fallback to browser (free but poor quality)
    this.currentProvider = 'browser';
    console.log('🎯 Using Browser TTS (fallback)');
  }

  /**
   * Test ElevenLabs availability
   */
  private async testElevenLabs(): Promise<boolean> {
    // ElevenLabs has excellent kid-friendly voices and reasonable pricing
    // Would need API key setup
    return false; // For now, not configured
  }

  /**
   * Test Azure availability
   */
  private async testAzure(): Promise<boolean> {
    // Azure has very good TTS at low cost
    // Would need API key setup
    return false; // For now, not configured
  }

  /**
   * Test OpenAI availability
   */
  private async testOpenAI(): Promise<boolean> {
    try {
      const response = await fetch('/api/tts-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'test', test: true })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Main speak function - automatically uses best available provider
   */
  public async speak(text: string, options: TTSOptions = {}): Promise<void> {
    if (!this.currentProvider) {
      await this.detectBestProvider();
    }

    console.log(`🎤 Speaking with ${this.currentProvider}: "${text.substring(0, 30)}..."`);

    switch (this.currentProvider) {
      case 'elevenlabs':
        return this.speakWithElevenLabs(text, options);
      case 'azure':
        return this.speakWithAzure(text, options);
      case 'openai':
        return this.speakWithOpenAI(text, options);
      case 'browser':
      default:
        return this.speakWithBrowser(text, options);
    }
  }

  /**
   * ElevenLabs TTS (premium quality)
   */
  private async speakWithElevenLabs(text: string, options: TTSOptions): Promise<void> {
    // TODO: Implement ElevenLabs API call
    throw new Error('ElevenLabs not configured');
  }

  /**
   * Azure TTS (good quality, cheap)
   */
  private async speakWithAzure(text: string, options: TTSOptions): Promise<void> {
    // TODO: Implement Azure Cognitive Services TTS
    throw new Error('Azure TTS not configured');
  }

  /**
   * OpenAI TTS (current implementation)
   */
  private async speakWithOpenAI(text: string, options: TTSOptions): Promise<void> {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`OpenAI TTS failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      await this.playAudioBlob(audioBlob);
    } catch (error) {
      console.error('OpenAI TTS failed, falling back to browser:', error);
      this.currentProvider = 'browser';
      return this.speakWithBrowser(text, options);
    }
  }

  /**
   * Browser TTS (fallback)
   */
  private async speakWithBrowser(text: string, options: TTSOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Browser TTS not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);

      // Kid-friendly settings
      utterance.rate = options.speed || 0.8;
      utterance.pitch = options.pitch || 1.2;
      utterance.volume = 0.7;

      // Try to get a better voice
      const voices = speechSynthesis.getVoices();
      const goodVoice = voices.find(v =>
        v.name.includes('Google') ||
        v.name.includes('Samantha') ||
        v.name.includes('Karen') ||
        (v.lang.startsWith('en') && v.name.includes('Female'))
      );

      if (goodVoice) {
        utterance.voice = goodVoice;
        console.log('🎭 Using voice:', goodVoice.name);
      }

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(new Error(e.error));

      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Play audio blob (for API-based TTS)
   */
  private async playAudioBlob(blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Audio playback failed'));
      };

      audio.src = url;
      audio.play().catch(reject);
    });
  }

  /**
   * Stop any ongoing speech
   */
  public stop(): void {
    // Stop browser TTS
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }

    // TODO: Stop other providers if needed
    console.log('🛑 Stopped all TTS');
  }

  /**
   * Get current provider info
   */
  public getProviderInfo(): { provider: string; quality: string; cost: string } {
    const info = {
      elevenlabs: { provider: 'ElevenLabs', quality: 'Excellent', cost: 'Low' },
      azure: { provider: 'Azure', quality: 'Good', cost: 'Very Low' },
      openai: { provider: 'OpenAI', quality: 'Good', cost: 'Medium' },
      browser: { provider: 'Browser', quality: 'Poor', cost: 'Free' }
    };

    return info[this.currentProvider || 'browser'];
  }
}

// Export singleton
export const multiTTS = new MultiTTS();