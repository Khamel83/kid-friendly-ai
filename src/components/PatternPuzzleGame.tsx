import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PatternPuzzle, PatternPuzzleState, PatternPuzzleConfig } from '../types/patternPuzzle';
import { PatternPuzzleGenerator } from '../utils/patternPuzzleGenerator';
import { SoundManager } from '../utils/soundEffects';
import { AccessibilityUtils } from '../utils/accessibility';

interface PatternPuzzleGameProps {
  isOpen: boolean;
  onClose: () => void;
  onStickerEarned?: (stickerId: string) => void;
}

const PatternPuzzleGame: React.FC<PatternPuzzleGameProps> = ({ isOpen, onClose, onStickerEarned }) => {
  const [gameState, setGameState] = useState<PatternPuzzleState>({
    currentPuzzle: null,
    gameState: 'menu',
    score: 0,
    level: 1,
    streak: 0,
    hints: 3,
    timeRemaining: undefined,
    userProgress: [],
    achievements: []
  });

  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [showHint, setShowHint] = useState(false);
  const [visualEffects, setVisualEffects] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  const config: PatternPuzzleConfig = {
    maxHints: 3,
    timePerPuzzle: 60,
    scoreMultiplier: 10,
    adaptiveDifficulty: true,
    visualEffects: true,
    soundEnabled: true
  };

  const puzzleGenerator = PatternPuzzleGenerator.getInstance();
  const soundManager = SoundManager.getInstance();

  useEffect(() => {
    if (isOpen) {
      resetGame();
    }
  }, [isOpen]);

  useEffect(() => {
    if (gameState.timeRemaining && gameState.timeRemaining > 0 && gameState.gameState === 'playing') {
      const newTimer = setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining! - 1
        }));
      }, 1000);
      setTimer(newTimer);
    } else if (gameState.timeRemaining === 0) {
      endGame(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [gameState.timeRemaining, gameState.gameState]);

  const startGame = useCallback((puzzleType: PatternPuzzle['type'] = 'visual') => {
    const puzzle = puzzleGenerator.generatePuzzle(puzzleType, 'easy');
    setGameState(prev => ({
      ...prev,
      currentPuzzle: puzzle,
      gameState: 'playing',
      timeRemaining: config.timePerPuzzle
    }));
    setSelectedAnswer(null);
    setShowHint(false);
    if (soundEnabled) {
      soundManager.play('start');
    }
  }, [puzzleGenerator, soundManager, soundEnabled, config.timePerPuzzle]);

  const resetGame = useCallback(() => {
    setGameState({
      currentPuzzle: null,
      gameState: 'menu',
      score: 0,
      level: 1,
      streak: 0,
      hints: config.maxHints,
      timeRemaining: undefined,
      userProgress: [],
      achievements: []
    });
    setSelectedAnswer(null);
    setShowHint(false);
  }, [config.maxHints]);

  const submitAnswer = useCallback((answer: any) => {
    if (!gameState.currentPuzzle || gameState.gameState !== 'playing') return;

    setSelectedAnswer(answer);
    const isCorrect = checkAnswer(answer, gameState.currentPuzzle?.answer);

    if (isCorrect) {
      handleCorrectAnswer();
    } else {
      handleIncorrectAnswer();
    }
  }, [gameState.currentPuzzle, gameState.gameState]);

  const checkAnswer = (userAnswer: any, correctAnswer: any): boolean => {
    if (typeof userAnswer === 'object' && typeof correctAnswer === 'object') {
      return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer);
    }
    return userAnswer === correctAnswer;
  };

  const handleCorrectAnswer = useCallback(() => {
    const baseScore = 100;
    const streakBonus = gameState.streak * 10;
    const timeBonus = gameState.timeRemaining! * 2;
    const totalScore = baseScore + streakBonus + timeBonus;

    setGameState(prev => ({
      ...prev,
      score: prev.score + totalScore,
      streak: prev.streak + 1,
      level: prev.level + (prev.streak + 1) % 3 === 0 ? 1 : 0,
      userProgress: [...prev.userProgress, {
        puzzleId: prev.currentPuzzle!.id,
        correct: true,
        timeTaken: config.timePerPuzzle - prev.timeRemaining!,
        hintsUsed: config.maxHints - prev.hints
      }]
    }));

    if (soundEnabled) {
      soundManager.play('success');
    }

    if (visualEffects) {
      showCelebration();
    }

    if (gameState.streak >= 5 && onStickerEarned) {
      onStickerEarned(`pattern-sticker-${Date.now()}`);
    }

    setTimeout(() => {
      nextPuzzle();
    }, 1500);
  }, [gameState.streak, gameState.timeRemaining, soundEnabled, visualEffects, onStickerEarned, config]);

  const handleIncorrectAnswer = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      streak: 0,
      userProgress: [...prev.userProgress, {
        puzzleId: prev.currentPuzzle!.id,
        correct: false,
        timeTaken: config.timePerPuzzle - prev.timeRemaining!,
        hintsUsed: config.maxHints - prev.hints
      }]
    }));

    if (soundEnabled) {
      soundManager.play('error');
    }

    setTimeout(() => {
      nextPuzzle();
    }, 1500);
  }, [soundEnabled, config]);

  const nextPuzzle = useCallback(() => {
    const difficulty = gameState.level <= 3 ? 'easy' :
                      gameState.level <= 6 ? 'medium' :
                      gameState.level <= 9 ? 'hard' : 'expert';

    const types: PatternPuzzle['type'][] = ['visual', 'numerical', 'logical', 'spatial', 'sequence'];
    const randomType = types[Math.floor(Math.random() * types.length)];

    const puzzle = puzzleGenerator.generatePuzzle(randomType, difficulty);

    setGameState(prev => ({
      ...prev,
      currentPuzzle: puzzle,
      timeRemaining: config.timePerPuzzle,
      hints: Math.min(prev.hints + 1, config.maxHints)
    }));

    setSelectedAnswer(null);
    setShowHint(false);
  }, [gameState.level, puzzleGenerator, config]);

  const useHint = useCallback(() => {
    if (gameState.hints > 0 && gameState.currentPuzzle) {
      setGameState(prev => ({
        ...prev,
        hints: prev.hints - 1
      }));
      setShowHint(true);

      if (soundEnabled) {
        soundManager.play('start');
      }
    }
  }, [gameState.hints, gameState.currentPuzzle, soundEnabled]);

  const pauseGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      gameState: 'paused'
    }));
  }, []);

  const resumeGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      gameState: 'playing'
    }));
  }, []);

  const endGame = useCallback((completed: boolean = true) => {
    setGameState(prev => ({
      ...prev,
      gameState: completed ? 'completed' : 'failed'
    }));

    if (soundEnabled) {
      soundManager.play(completed ? 'success' : 'error');
    }
  }, [soundEnabled]);

  const showCelebration = useCallback(() => {
    if (!visualEffects) return;

    const colors = ['#FFD700', '#FF69B4', '#00CED1', '#98FB98', '#DDA0DD'];
    const particles = [];

    for (let i = 0; i < 20; i++) {
      particles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    setTimeout(() => {
      // Clear particles after animation
    }, 2000);
  }, [visualEffects]);

  const renderPuzzle = useCallback(() => {
    if (!gameState.currentPuzzle) return null;

    const puzzle = gameState.currentPuzzle;

    switch (puzzle.type) {
      case 'visual':
        return renderVisualPuzzle(puzzle);
      case 'numerical':
        return renderNumericalPuzzle(puzzle);
      case 'logical':
        return renderLogicalPuzzle(puzzle);
      case 'spatial':
        return renderSpatialPuzzle(puzzle);
      case 'sequence':
        return renderSequencePuzzle(puzzle);
      default:
        return <div>Unknown puzzle type</div>;
    }
  }, [gameState.currentPuzzle]);

  const renderVisualPuzzle = (puzzle: PatternPuzzle) => {
    return (
      <div className="visual-puzzle">
        <div className="pattern-grid">
          {puzzle.sequence.map((item, index) => (
            <div key={index} className="pattern-item">
              {item ? (
                <div
                  className={`shape ${item.shape} ${item.color}`}
                  style={{
                    width: '50px',
                    height: '50px',
                    backgroundColor: item.color
                  }}
                />
              ) : (
                <div className="missing-item">?</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNumericalPuzzle = (puzzle: PatternPuzzle) => {
    return (
      <div className="numerical-puzzle">
        <div className="number-sequence">
          {puzzle.sequence.map((num, index) => (
            <span key={index} className="number-item">
              {num}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderLogicalPuzzle = (puzzle: PatternPuzzle) => {
    return (
      <div className="logical-puzzle">
        <div className="logical-sequence">
          {puzzle.sequence.map((item, index) => (
            <div key={index} className="logical-item">
              {item}
            </div>
          ))}
        </div>
        {puzzle.options && (
          <div className="options-grid">
            {puzzle.options.map((option, index) => (
              <button
                key={index}
                className="option-button"
                onClick={() => submitAnswer(option)}
                disabled={selectedAnswer !== null}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSpatialPuzzle = (puzzle: PatternPuzzle) => {
    return (
      <div className="spatial-puzzle">
        <div className="spatial-grid">
          {puzzle.sequence.map((move, index) => (
            <div key={index} className="move-item">
              {move === '?' ? '?' : `${move.direction} ${move.distance}`}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSequencePuzzle = (puzzle: PatternPuzzle) => {
    return (
      <div className="sequence-puzzle">
        <div className="sequence-display">
          {puzzle.sequence.map((item, index) => (
            <span key={index} className="sequence-item">
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="pattern-puzzle-game-overlay">
      <div className="pattern-puzzle-game">
        <div className="game-header">
          <h2>Pattern Puzzles</h2>
          <div className="game-stats">
            <span>Score: {gameState.score}</span>
            <span>Level: {gameState.level}</span>
            <span>Streak: {gameState.streak}</span>
            {gameState.timeRemaining !== undefined && (
              <span>Time: {gameState.timeRemaining}s</span>
            )}
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {gameState.gameState === 'menu' && (
          <div className="game-menu">
            <h3>Choose Puzzle Type</h3>
            <div className="puzzle-types">
              <button onClick={() => startGame('visual')}>Visual Patterns</button>
              <button onClick={() => startGame('numerical')}>Number Sequences</button>
              <button onClick={() => startGame('logical')}>Logic Puzzles</button>
              <button onClick={() => startGame('spatial')}>Spatial Reasoning</button>
              <button onClick={() => startGame('sequence')}>Complex Sequences</button>
            </div>
          </div>
        )}

        {gameState.gameState === 'playing' && gameState.currentPuzzle && (
          <div className="game-play">
            <div className="puzzle-container">
              {renderPuzzle()}
            </div>

            {showHint && gameState.currentPuzzle.hint && (
              <div className="hint-box">
                <p>Hint: {gameState.currentPuzzle.hint}</p>
              </div>
            )}

            <div className="game-controls">
              <button
                className="hint-button"
                onClick={useHint}
                disabled={gameState.hints === 0}
              >
                Hint ({gameState.hints})
              </button>
              <button className="pause-button" onClick={pauseGame}>
                Pause
              </button>
            </div>

            {selectedAnswer !== null && (
              <div className={`answer-feedback ${selectedAnswer === gameState.currentPuzzle.answer ? 'correct' : 'incorrect'}`}>
                {selectedAnswer === gameState.currentPuzzle.answer ? 'Correct!' : 'Try again!'}
              </div>
            )}
          </div>
        )}

        {gameState.gameState === 'paused' && (
          <div className="game-paused">
            <h3>Game Paused</h3>
            <button onClick={resumeGame}>Resume</button>
            <button onClick={onClose}>Exit</button>
          </div>
        )}

        {gameState.gameState === 'completed' && (
          <div className="game-completed">
            <h3>Great Job!</h3>
            <p>Final Score: {gameState.score}</p>
            <p>Level Reached: {gameState.level}</p>
            <button onClick={resetGame}>Play Again</button>
            <button onClick={onClose}>Close</button>
          </div>
        )}

        {gameState.gameState === 'failed' && (
          <div className="game-failed">
            <h3>Time&apos;s Up!</h3>
            <p>Final Score: {gameState.score}</p>
            <button onClick={resetGame}>Try Again</button>
            <button onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatternPuzzleGame;