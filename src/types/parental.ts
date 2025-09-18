export interface TriviaQuestion {
  id: string;
  question: string;
  answer: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ParentalSettings {
  contentSettings: {
    topicFiltering: boolean;
    allowedTopics: string[];
    difficulty: 'easy' | 'medium' | 'hard';
    educationalMode: boolean;
  };
  usageManagement: {
    dailyTimeLimit: number; // minutes
    sessionTimeout: number; // minutes
    breakReminders: boolean;
    breakInterval: number; // minutes
  };
  safetySettings: {
    contentFiltering: boolean;
    dataCollection: boolean;
    voiceRecording: boolean;
    locationServices: boolean;
  };
  privacySettings: {
    shareProgress: boolean;
    analyticsEnabled: boolean;
    personalizedAds: boolean;
  };
}

export interface UsageData {
  totalTimeToday: number; // minutes
  sessionCount: number;
  lastSession: Date | null;
  breaksTaken: number;
}

export interface ParentalGateProps {
  onSuccess: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
}

export type SettingsSection = 'content' | 'usage' | 'safety' | 'privacy';

export const DEFAULT_PARENTAL_SETTINGS: ParentalSettings = {
  contentSettings: {
    topicFiltering: true,
    allowedTopics: ['animals', 'science', 'math', 'reading', 'art'],
    difficulty: 'easy',
    educationalMode: true,
  },
  usageManagement: {
    dailyTimeLimit: 60, // 1 hour
    sessionTimeout: 30, // 30 minutes
    breakReminders: true,
    breakInterval: 15, // 15 minutes
  },
  safetySettings: {
    contentFiltering: true,
    dataCollection: false,
    voiceRecording: true,
    locationServices: false,
  },
  privacySettings: {
    shareProgress: false,
    analyticsEnabled: false,
    personalizedAds: false,
  },
};