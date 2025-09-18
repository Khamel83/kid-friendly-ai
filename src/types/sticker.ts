export interface Sticker {
  id: string;
  name: string;
  category: 'animals' | 'stars' | 'achievements' | 'learning';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  emoji: string;
  description: string;
  earnedAt?: Date;
  animation?: string;
  unlocked?: boolean;
}

export interface StickerBook {
  stickers: Sticker[];
  totalEarned: number;
  categoryCounts: Record<string, number>;
  rarityCounts: Record<string, number>;
}

export interface StickerCollection {
  animals: Sticker[];
  stars: Sticker[];
  achievements: Sticker[];
  learning: Sticker[];
}

export interface StickerFilter {
  category?: 'animals' | 'stars' | 'achievements' | 'learning' | 'all';
  rarity?: 'common' | 'rare' | 'epic' | 'legendary' | 'all';
  search?: string;
}

export interface StickerReward {
  type: 'conversation' | 'game' | 'achievement' | 'learning';
  subtype?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  count: number;
}

export const RARITY_COLORS = {
  common: '#95a5a6',
  rare: '#3498db',
  epic: '#9b59b6',
  legendary: '#f39c12'
};

export const RARITY_NAMES = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary'
};

export const CATEGORY_NAMES = {
  animals: 'Animals',
  stars: 'Stars',
  achievements: 'Achievements',
  learning: 'Learning'
};

export const RARITY_DROP_RATES = {
  common: 0.60,
  rare: 0.25,
  epic: 0.12,
  legendary: 0.03
};