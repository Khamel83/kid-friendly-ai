export interface PatternPuzzle {
  id: string;
  type: 'visual' | 'numerical' | 'logical' | 'spatial' | 'sequence';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  sequence: any[];
  answer: any;
  options?: any[];
  hint?: string;
  explanation?: string;
  visualData?: {
    type: 'shapes' | 'colors' | 'positions' | 'rotations';
    pattern: any[];
    displaySize: { width: number; height: number };
  };
}

export interface PatternPuzzleState {
  currentPuzzle: PatternPuzzle | null;
  gameState: 'menu' | 'playing' | 'paused' | 'completed' | 'failed';
  score: number;
  level: number;
  streak: number;
  hints: number;
  timeRemaining?: number;
  userProgress: any[];
  achievements: string[];
}

export interface PatternPuzzleConfig {
  maxHints: number;
  timePerPuzzle: number;
  scoreMultiplier: number;
  adaptiveDifficulty: boolean;
  visualEffects: boolean;
  soundEnabled: boolean;
}