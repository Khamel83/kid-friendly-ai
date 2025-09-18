import { PatternPuzzle } from '../types/patternPuzzle';

export class PatternPuzzleGenerator {
  private static instance: PatternPuzzleGenerator;

  private constructor() {}

  public static getInstance(): PatternPuzzleGenerator {
    if (!PatternPuzzleGenerator.instance) {
      PatternPuzzleGenerator.instance = new PatternPuzzleGenerator();
    }
    return PatternPuzzleGenerator.instance;
  }

  public generatePuzzle(type: PatternPuzzle['type'], difficulty: PatternPuzzle['difficulty']): PatternPuzzle {
    const puzzleGenerators = {
      visual: this.generateVisualPuzzle,
      numerical: this.generateNumericalPuzzle,
      logical: this.generateLogicalPuzzle,
      spatial: this.generateSpatialPuzzle,
      sequence: this.generateSequencePuzzle
    };

    return puzzleGenerators[type](difficulty);
  }

  private generateVisualPuzzle(difficulty: PatternPuzzle['difficulty']): PatternPuzzle {
    const shapes = ['circle', 'square', 'triangle', 'star', 'diamond', 'hexagon'];
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

    const difficultyConfig = {
      easy: { length: 4, variations: 2 },
      medium: { length: 6, variations: 3 },
      hard: { length: 8, variations: 4 },
      expert: { length: 10, variations: 5 }
    };

    const config = difficultyConfig[difficulty];
    const pattern = [];
    const patternType = Math.random() > 0.5 ? 'color' : 'shape';

    for (let i = 0; i < config.length; i++) {
      if (patternType === 'color') {
        pattern.push({
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          color: colors[i % colors.length]
        });
      } else {
        pattern.push({
          shape: shapes[i % shapes.length],
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
    }

    const missingIndex = Math.floor(Math.random() * pattern.length);
    const answer = pattern[missingIndex];
    const sequence = [...pattern];
    sequence[missingIndex] = null as any;

    return {
      id: `visual-${Date.now()}-${Math.random()}`,
      type: 'visual',
      difficulty,
      sequence,
      answer,
      hint: `Look for the ${patternType} pattern`,
      explanation: `The pattern follows a ${patternType} sequence that repeats every ${config.variations} elements.`,
      visualData: {
        type: 'shapes',
        pattern: sequence,
        displaySize: { width: 400, height: 300 }
      }
    };
  }

  private generateNumericalPuzzle(difficulty: PatternPuzzle['difficulty']): PatternPuzzle {
    const sequences = [
      { pattern: (n: number) => n + 2, name: 'addition' },
      { pattern: (n: number) => n * 2, name: 'multiplication' },
      { pattern: (n: number) => n * n, name: 'squares' },
      { pattern: (n: number) => n + (n - 1), name: 'fibonacci-like' },
      { pattern: (n: number) => n * 3 - 1, name: 'complex' }
    ];

    const difficultyConfig = {
      easy: { length: 4, complexity: 0 },
      medium: { length: 6, complexity: 1 },
      hard: { length: 8, complexity: 2 },
      expert: { length: 10, complexity: 3 }
    };

    const config = difficultyConfig[difficulty];
    const sequenceType = sequences[Math.min(config.complexity, sequences.length - 1)];
    const sequence = [];

    let start = Math.floor(Math.random() * 10) + 1;
    for (let i = 0; i < config.length; i++) {
      sequence.push(start);
      start = sequenceType.pattern(start);
    }

    const missingIndex = Math.floor(Math.random() * sequence.length);
    const answer = sequence[missingIndex];
    const questionSequence = [...sequence];
    questionSequence[missingIndex] = '?' as any;

    return {
      id: `numerical-${Date.now()}-${Math.random()}`,
      type: 'numerical',
      difficulty,
      sequence: questionSequence,
      answer,
      hint: `Look for ${sequenceType.name} pattern`,
      explanation: `Each number follows the rule: ${sequenceType.name}`
    };
  }

  private generateLogicalPuzzle(difficulty: PatternPuzzle['difficulty']): PatternPuzzle {
    const logicalPatterns = [
      { type: 'alternating', values: [true, false, true, false] },
      { type: 'categorization', values: ['fruit', 'vegetable', 'fruit', 'vegetable'] },
      { type: 'size-order', values: ['small', 'medium', 'large', 'extra-large'] },
      { type: 'alphabetical', values: ['A', 'B', 'C', 'D', 'E'] }
    ];

    const difficultyConfig = {
      easy: { complexity: 0 },
      medium: { complexity: 1 },
      hard: { complexity: 2 },
      expert: { complexity: 3 }
    };

    const config = difficultyConfig[difficulty];
    const pattern = logicalPatterns[Math.min(config.complexity, logicalPatterns.length - 1)];
    const sequence = [...pattern.values];

    const missingIndex = Math.floor(Math.random() * sequence.length);
    const answer = sequence[missingIndex];
    sequence[missingIndex] = '?' as any;

    const options = [...pattern.values];
    if (pattern.type === 'size-order') {
      options.push('tiny', 'giant');
    } else if (pattern.type === 'categorization') {
      options.push('grain', 'dairy');
    }

    return {
      id: `logical-${Date.now()}-${Math.random()}`,
      type: 'logical',
      difficulty,
      sequence,
      answer,
      options: this.shuffleArray(options).slice(0, 6),
      hint: `Think about ${pattern.type} patterns`,
      explanation: `The pattern follows ${pattern.type} logic`
    };
  }

  private generateSpatialPuzzle(difficulty: PatternPuzzle['difficulty']): PatternPuzzle {
    const directions = ['up', 'down', 'left', 'right', 'diagonal'];
    const rotations = [0, 90, 180, 270];

    const difficultyConfig = {
      easy: { moves: 3, variations: 2 },
      medium: { moves: 5, variations: 3 },
      hard: { moves: 7, variations: 4 },
      expert: { moves: 9, variations: 5 }
    };

    const config = difficultyConfig[difficulty];
    const sequence = [];

    let currentPosition = { x: 0, y: 0, rotation: 0 };

    for (let i = 0; i < config.moves; i++) {
      const move = {
        direction: directions[i % directions.length],
        distance: i + 1,
        rotation: rotations[i % rotations.length]
      };

      sequence.push(move);

      if (move.direction === 'up') currentPosition.y += move.distance;
      if (move.direction === 'down') currentPosition.y -= move.distance;
      if (move.direction === 'left') currentPosition.x -= move.distance;
      if (move.direction === 'right') currentPosition.x += move.distance;
    }

    const missingIndex = Math.floor(Math.random() * sequence.length);
    const answer = sequence[missingIndex];
    const questionSequence = [...sequence];
    questionSequence[missingIndex] = '?' as any;

    return {
      id: `spatial-${Date.now()}-${Math.random()}`,
      type: 'spatial',
      difficulty,
      sequence: questionSequence,
      answer,
      hint: 'Follow the movement pattern step by step',
      explanation: 'Each step changes position and rotation according to the pattern',
      visualData: {
        type: 'positions',
        pattern: questionSequence,
        displaySize: { width: 500, height: 400 }
      }
    };
  }

  private generateSequencePuzzle(difficulty: PatternPuzzle['difficulty']): PatternPuzzle {
    const sequenceTypes = [
      { name: 'arithmetic', generator: (n: number, index: number) => n + 3 },
      { name: 'geometric', generator: (n: number, index: number) => n * 2 },
      { name: 'prime', generator: (n: number, index: number) => this.getPrime(index) },
      { name: 'factorial', generator: (n: number, index: number) => this.getFactorial(n) },
      { name: 'triangular', generator: (n: number, index: number) => (n * (n + 1)) / 2 }
    ];

    const difficultyConfig = {
      easy: { length: 5, complexity: 0 },
      medium: { length: 7, complexity: 1 },
      hard: { length: 9, complexity: 2 },
      expert: { length: 11, complexity: 3 }
    };

    const config = difficultyConfig[difficulty];
    const sequenceType = sequenceTypes[Math.min(config.complexity, sequenceTypes.length - 1)];
    const sequence = [];

    for (let i = 0; i < config.length; i++) {
      if (sequenceType.name === 'prime') {
        sequence.push(this.getPrime(i + 1));
      } else if (sequenceType.name === 'factorial') {
        sequence.push(this.getFactorial(i));
      } else {
        sequence.push(sequenceType.generator(i + 1, i));
      }
    }

    const missingIndex = Math.floor(Math.random() * sequence.length);
    const answer = sequence[missingIndex];
    const questionSequence = [...sequence];
    questionSequence[missingIndex] = '?' as any;

    return {
      id: `sequence-${Date.now()}-${Math.random()}`,
      type: 'sequence',
      difficulty,
      sequence: questionSequence,
      answer,
      hint: `This is a ${sequenceType.name} sequence`,
      explanation: `The pattern follows ${sequenceType.name} progression`
    };
  }

  private getPrime(n: number): number {
    if (n <= 0) return 0;
    if (n === 1) return 2;
    if (n === 2) return 3;

    let count = 2;
    let candidate = 5;

    while (count < n) {
      let isPrime = true;
      for (let i = 2; i <= Math.sqrt(candidate); i++) {
        if (candidate % i === 0) {
          isPrime = false;
          break;
        }
      }
      if (isPrime) count++;
      if (count < n) candidate += 2;
    }

    return candidate;
  }

  private getFactorial(n: number): number {
    if (n <= 1) return 1;
    return n * this.getFactorial(n - 1);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}