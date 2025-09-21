/**
 * Browser-based Text-to-Speech utility
 * Uses Web Speech API - free, fast, and works offline!
 */

export interface BrowserTTSOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;  // 0.1 to 10
  pitch?: number; // 0 to 2
  volume?: number; // 0 to 1
}

export class BrowserTTS {
  private synthesis: SpeechSynthesis;
  private defaultOptions: BrowserTTSOptions;

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.defaultOptions = {
      rate: 0.9,    // Slightly slower for kids
      pitch: 1.1,   // Slightly higher for friendly voice
      volume: 0.8,  // Not too loud
    };
  }

  /**
   * Get all available voices, prioritizing kid-friendly ones
   */
  public getVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
  }

  /**
   * Get the best kid-friendly voice
   */
  public getKidFriendlyVoice(): SpeechSynthesisVoice | null {
    const voices = this.getVoices();

    // Priority order for kid-friendly voices
    const kidFriendlyNames = [
      'Samantha',      // macOS - very natural
      'Karen',         // macOS - friendly female
      'Zira',          // Windows - clear female
      'Hazel',         // macOS - young female
      'Google UK English Female',  // Chrome
      'Microsoft Zira Desktop',    // Windows
      'Alex',          // macOS - clear male backup
    ];

    // First try exact matches
    for (const name of kidFriendlyNames) {
      const voice = voices.find(v => v.name === name);
      if (voice) return voice;
    }

    // Then try partial matches for female voices
    const femaleVoice = voices.find(v =>
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('woman') ||
      (v.name.toLowerCase().includes('google') && v.lang.startsWith('en'))
    );
    if (femaleVoice) return femaleVoice;

    // Fallback to any English voice
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    return englishVoice || null;
  }

  /**
   * Speak text with kid-friendly settings
   */
  public speak(text: string, options: BrowserTTSOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      // Stop any ongoing speech
      this.stop();

      if (!text.trim()) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);

      // Apply options with kid-friendly defaults
      const finalOptions = { ...this.defaultOptions, ...options };

      utterance.voice = finalOptions.voice || this.getKidFriendlyVoice();
      utterance.rate = finalOptions.rate || 0.9;
      utterance.pitch = finalOptions.pitch || 1.1;
      utterance.volume = finalOptions.volume || 0.8;

      // Event handlers
      utterance.onend = () => {
        console.log('✅ TTS finished speaking');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('❌ TTS error:', event.error);
        reject(new Error(`TTS failed: ${event.error}`));
      };

      utterance.onstart = () => {
        console.log('🎤 TTS started speaking');
      };

      // Speak!
      this.synthesis.speak(utterance);
    });
  }

  /**
   * Stop any ongoing speech
   */
  public stop(): void {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
      console.log('🛑 TTS stopped');
    }
  }

  /**
   * Check if TTS is currently speaking
   */
  public isSpeaking(): boolean {
    return this.synthesis.speaking;
  }

  /**
   * Get available voices info for debugging
   */
  public getVoicesInfo(): Array<{name: string, lang: string, gender?: string}> {
    return this.getVoices().map(voice => ({
      name: voice.name,
      lang: voice.lang,
      gender: voice.name.toLowerCase().includes('female') ? 'female' :
              voice.name.toLowerCase().includes('male') ? 'male' : 'unknown'
    }));
  }

  /**
   * Test TTS with a kid-friendly phrase
   */
  public async test(): Promise<void> {
    const testPhrases = [
      "Hi there! I'm your AI buddy!",
      "Let's learn something fun together!",
      "What would you like to know about today?"
    ];

    const randomPhrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];
    console.log('🧪 Testing TTS with:', randomPhrase);

    await this.speak(randomPhrase);
  }
}

// Export singleton instance
export const browserTTS = new BrowserTTS();

// Wait for voices to load
export const waitForVoices = (): Promise<void> => {
  return new Promise((resolve) => {
    const checkVoices = () => {
      if (speechSynthesis.getVoices().length > 0) {
        resolve();
      } else {
        setTimeout(checkVoices, 100);
      }
    };

    if (speechSynthesis.getVoices().length > 0) {
      resolve();
    } else {
      speechSynthesis.onvoiceschanged = () => {
        checkVoices();
      };
      checkVoices();
    }
  });
};