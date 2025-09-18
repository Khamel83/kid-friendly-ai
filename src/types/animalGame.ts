export interface Animal {
  id: string;
  name: string;
  species: string;
  habitat: string;
  diet: 'herbivore' | 'carnivore' | 'omnivore';
  size: 'small' | 'medium' | 'large' | 'giant';
  lifespan: number;
  conservationStatus: 'least concern' | 'near threatened' | 'vulnerable' | 'endangered' | 'critically endangered';
  funFacts: string[];
  sounds: string[];
  behaviors: string[];
  adaptations: string[];
  imageUrl?: string;
}

export interface AnimalQuestion {
  id: string;
  type: 'identification' | 'habitat' | 'diet' | 'behavior' | 'adaptation' | 'conservation' | 'fun-fact';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  question: string;
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
  animal: Animal;
  multimedia?: {
    type: 'image' | 'sound' | 'video';
    url: string;
    altText?: string;
  };
}

export interface AnimalGameState {
  currentQuestion: AnimalQuestion | null;
  gameState: 'menu' | 'playing' | 'paused' | 'completed' | 'failed' | 'learning';
  score: number;
  level: number;
  streak: number;
  hints: number;
  animalsDiscovered: string[];
  achievements: string[];
  currentAnimal?: Animal;
  timeRemaining?: number;
  userProgress: {
    questionId: string;
    correct: boolean;
    timeTaken: number;
    hintsUsed: number;
  }[];
}

export interface AnimalGameConfig {
  maxHints: number;
  timePerQuestion: number;
  scoreMultiplier: number;
  adaptiveDifficulty: boolean;
  soundEnabled: boolean;
  multimediaEnabled: boolean;
  educationalMode: boolean;
}