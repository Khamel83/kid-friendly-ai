/**
 * Simple usage tracking for ElevenLabs character limits
 * Uses localStorage (no server-side database needed)
 */

interface UsageData {
  month: string; // YYYY-MM format
  characterCount: number;
  lastReset: string; // ISO date string
}

const STORAGE_KEY = 'elevenlabs_usage';
const MONTHLY_LIMIT = 10000; // ElevenLabs free tier limit

export class UsageTracker {
  private static instance: UsageTracker;

  static getInstance(): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker();
    }
    return UsageTracker.instance;
  }

  /**
   * Get current month key (YYYY-MM)
   */
  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  /**
   * Load usage data from localStorage
   */
  private loadUsage(): UsageData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as UsageData;

        // Check if we need to reset for new month
        if (data.month !== this.getCurrentMonth()) {
          console.log('New month detected, resetting usage counter');
          return this.resetUsage();
        }

        return data;
      }
    } catch (error) {
      console.error('Error loading usage data:', error);
    }

    // Return default data
    return this.resetUsage();
  }

  /**
   * Save usage data to localStorage
   */
  private saveUsage(data: UsageData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving usage data:', error);
    }
  }

  /**
   * Reset usage counter for new month
   */
  private resetUsage(): UsageData {
    const data: UsageData = {
      month: this.getCurrentMonth(),
      characterCount: 0,
      lastReset: new Date().toISOString()
    };
    this.saveUsage(data);
    return data;
  }

  /**
   * Add character count to usage
   */
  public addUsage(characterCount: number): void {
    const usage = this.loadUsage();
    usage.characterCount += characterCount;
    this.saveUsage(usage);

    console.log(`Usage updated: ${usage.characterCount}/${MONTHLY_LIMIT} characters this month`);
  }

  /**
   * Get current usage information
   */
  public getCurrentUsage(): {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    month: string;
  } {
    const usage = this.loadUsage();

    return {
      used: usage.characterCount,
      limit: MONTHLY_LIMIT,
      remaining: Math.max(0, MONTHLY_LIMIT - usage.characterCount),
      percentage: Math.round((usage.characterCount / MONTHLY_LIMIT) * 100),
      month: usage.month
    };
  }

  /**
   * Check if usage limit has been reached
   */
  public isLimitReached(): boolean {
    const usage = this.loadUsage();
    return usage.characterCount >= MONTHLY_LIMIT;
  }

  /**
   * Check if usage is near limit (>80%)
   */
  public isNearLimit(): boolean {
    const usage = this.loadUsage();
    return usage.characterCount >= (MONTHLY_LIMIT * 0.8);
  }

  /**
   * Get kid-friendly usage message
   */
  public getUsageMessage(): string {
    const stats = this.getCurrentUsage();

    if (stats.percentage >= 100) {
      return "We've used up all our talking time for this month! We can still chat with text. 😊";
    } else if (stats.percentage >= 80) {
      return `We're using lots of talking time! ${stats.remaining} characters left this month.`;
    } else if (stats.percentage >= 50) {
      return `We're halfway through our talking time for the month! ${stats.remaining} characters left.`;
    } else {
      return `Plenty of talking time left! ${stats.remaining} characters remaining this month.`;
    }
  }
}

// Export singleton instance
export const usageTracker = UsageTracker.getInstance();