import { ParentalSettings, UsageData, SettingsSection } from '../types/parental';
import { DEFAULT_PARENTAL_SETTINGS } from '../types/parental';

const STORAGE_KEYS = {
  SETTINGS: 'kid-friendly-ai-parental-settings',
  USAGE: 'kid-friendly-ai-usage-data',
  LAST_VERIFICATION: 'kid-friendly-ai-last-verification',
  FAILED_ATTEMPTS: 'kid-friendly-ai-failed-attempts',
};

const SETTINGS_SECTIONS: SettingsSection[] = ['content', 'usage', 'safety', 'privacy'];

class ParentalControlsManager {
  private static instance: ParentalControlsManager;
  private settings: ParentalSettings;
  private usageData: UsageData;
  private lastVerification: Date | null = null;
  private failedAttempts: number = 0;

  private constructor() {
    this.settings = this.loadSettings();
    this.usageData = this.loadUsageData();
    this.lastVerification = this.loadLastVerification();
    this.failedAttempts = this.loadFailedAttempts();
  }

  static getInstance(): ParentalControlsManager {
    if (!ParentalControlsManager.instance) {
      ParentalControlsManager.instance = new ParentalControlsManager();
    }
    return ParentalControlsManager.instance;
  }

  // Settings Management
  private loadSettings(): ParentalSettings {
    // Check if localStorage is available (not during SSR)
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_PARENTAL_SETTINGS };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_PARENTAL_SETTINGS, ...parsed };
      }
    } catch (error) {
      console.error('Error loading parental settings:', error);
    }
    return { ...DEFAULT_PARENTAL_SETTINGS };
  }

  saveSettings(settings: ParentalSettings): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      }
      this.settings = settings;
    } catch (error) {
      console.error('Error saving parental settings:', error);
    }
  }

  getSettings(): ParentalSettings {
    return { ...this.settings };
  }

  updateSettingsSection(section: SettingsSection, updates: any): void {
    const newSettings = { ...this.settings };
    (newSettings as any)[section] = { ...(newSettings as any)[section], ...updates };
    this.saveSettings(newSettings);
  }

  // Usage Tracking
  private loadUsageData(): UsageData {
    // Check if localStorage is available (not during SSR)
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        totalTimeToday: 0,
        sessionCount: 0,
        lastSession: null,
        breaksTaken: 0,
      };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USAGE);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if it's a new day
        const lastDate = new Date(parsed.lastSession || Date.now());
        const today = new Date();
        if (lastDate.toDateString() !== today.toDateString()) {
          // Reset daily usage
          return {
            totalTimeToday: 0,
            sessionCount: 0,
            lastSession: null,
            breaksTaken: 0,
          };
        }
        return {
          ...parsed,
          lastSession: parsed.lastSession ? new Date(parsed.lastSession) : null,
        };
      }
    } catch (error) {
      console.error('Error loading usage data:', error);
    }

    return {
      totalTimeToday: 0,
      sessionCount: 0,
      lastSession: null,
      breaksTaken: 0,
    };
  }

  private saveUsageData(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEYS.USAGE, JSON.stringify(this.usageData));
      }
    } catch (error) {
      console.error('Error saving usage data:', error);
    }
  }

  startSession(): void {
    this.usageData.sessionCount++;
    this.usageData.lastSession = new Date();
    this.saveUsageData();
  }

  addUsageTime(minutes: number): void {
    this.usageData.totalTimeToday += minutes;
    this.saveUsageData();
  }

  takeBreak(): void {
    this.usageData.breaksTaken++;
    this.saveUsageData();
  }

  getUsageData(): UsageData {
    return { ...this.usageData };
  }

  // Time Limit Checks
  isTimeLimitExceeded(): boolean {
    const { dailyTimeLimit } = this.settings.usageManagement;
    return this.usageData.totalTimeToday >= dailyTimeLimit;
  }

  getTimeRemaining(): number {
    const { dailyTimeLimit } = this.settings.usageManagement;
    return Math.max(0, dailyTimeLimit - this.usageData.totalTimeToday);
  }

  shouldTakeBreak(): boolean {
    const { breakReminders, breakInterval } = this.settings.usageManagement;
    if (!breakReminders || this.usageData.totalTimeToday === 0) {
      return false;
    }

    const sessionsSinceBreak = Math.floor(this.usageData.totalTimeToday / breakInterval);
    const breaksNeeded = sessionsSinceBreak - this.usageData.breaksTaken;
    return breaksNeeded > 0;
  }

  // Security & Verification
  private loadLastVerification(): Date | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.LAST_VERIFICATION);
      return stored ? new Date(stored) : null;
    } catch {
      return null;
    }
  }

  private loadFailedAttempts(): number {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 0;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.FAILED_ATTEMPTS);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  private saveLastVerification(date: Date): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEYS.LAST_VERIFICATION, date.toISOString());
      }
      this.lastVerification = date;
    } catch (error) {
      console.error('Error saving last verification:', error);
    }
  }

  private saveFailedAttempts(attempts: number): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, attempts.toString());
      }
      this.failedAttempts = attempts;
    } catch (error) {
      console.error('Error saving failed attempts:', error);
    }
  }

  recordSuccessfulVerification(): void {
    this.failedAttempts = 0;
    this.saveFailedAttempts(0);
    this.saveLastVerification(new Date());
  }

  recordFailedAttempt(): void {
    this.failedAttempts++;
    this.saveFailedAttempts(this.failedAttempts);
  }

  isLockedOut(): boolean {
    // Lock out after 5 failed attempts for 5 minutes
    if (this.failedAttempts >= 5) {
      const lockoutTime = 5 * 60 * 1000; // 5 minutes
      const timeSinceLastAttempt = Date.now() - (this.lastVerification?.getTime() || 0);
      return timeSinceLastAttempt < lockoutTime;
    }
    return false;
  }

  getFailedAttempts(): number {
    return this.failedAttempts;
  }

  resetFailedAttempts(): void {
    this.failedAttempts = 0;
    this.saveFailedAttempts(0);
  }

  // Content Filtering
  isContentAllowed(topic: string): boolean {
    const { topicFiltering, allowedTopics } = this.settings.contentSettings;
    if (!topicFiltering) {
      return true;
    }
    return allowedTopics.some(allowed =>
      topic.toLowerCase().includes(allowed.toLowerCase())
    );
  }

  isEducationalModeEnabled(): boolean {
    return this.settings.contentSettings.educationalMode;
  }

  // Safety Settings
  isContentFilteringEnabled(): boolean {
    return this.settings.safetySettings.contentFiltering;
  }

  isDataCollectionEnabled(): boolean {
    return this.settings.safetySettings.dataCollection;
  }

  isVoiceRecordingEnabled(): boolean {
    return this.settings.safetySettings.voiceRecording;
  }

  // Privacy Settings
  isProgressSharingEnabled(): boolean {
    return this.settings.privacySettings.shareProgress;
  }

  areAnalyticsEnabled(): boolean {
    return this.settings.privacySettings.analyticsEnabled;
  }

  arePersonalizedAdsEnabled(): boolean {
    return this.settings.privacySettings.personalizedAds;
  }

  // Utility Methods
  resetToDefaults(): void {
    this.saveSettings(DEFAULT_PARENTAL_SETTINGS);
  }

  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  importSettings(settingsJson: string): boolean {
    try {
      const imported = JSON.parse(settingsJson);
      this.saveSettings({ ...DEFAULT_PARENTAL_SETTINGS, ...imported });
      return true;
    } catch {
      return false;
    }
  }

  clearUsageData(): void {
    this.usageData = {
      totalTimeToday: 0,
      sessionCount: 0,
      lastSession: null,
      breaksTaken: 0,
    };
    this.saveUsageData();
  }
}

export const parentalControls = ParentalControlsManager.getInstance();
export { STORAGE_KEYS, SETTINGS_SECTIONS };