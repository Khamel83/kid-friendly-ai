import React, { useState, useEffect } from 'react';

interface PatternPuzzleGameProps {
  isOpen: boolean;
  onClose: () => void;
  onStickerEarned?: (stickerId: string) => void;
}

interface Puzzle {
  id: string;
  question: string;
  pattern: any[];
  options: string[];
  correctAnswer: number;
  type: 'visual' | 'numbers' | 'shapes';
}

const simplePuzzles: Puzzle[] = [
  {
    id: '1',
    question: 'What comes next in this pattern?',
    pattern: ['🔵', '🔴', '🔵', '🔴'],
    options: ['🔵', '🔴', '🟢', '🟡'],
    correctAnswer: 0,
    type: 'visual'
  },
  {
    id: '2',
    question: 'Complete the number pattern:',
    pattern: ['2', '4', '6', '8'],
    options: ['9', '10', '11', '12'],
    correctAnswer: 1,
    type: 'numbers'
  },
  {
    id: '3',
    question: 'What shape comes next?',
    pattern: ['⭐', '⭐', '💫', '⭐', '⭐', '💫'],
    options: ['⭐', '💫', '🌟', '✨'],
    correctAnswer: 0,
    type: 'shapes'
  },
  {
    id: '4',
    question: 'What comes next in this sequence?',
    pattern: ['🍎', '🍌', '🍎', '🍌'],
    options: ['🍇', '🍎', '🍌', '🍓'],
    correctAnswer: 1,
    type: 'visual'
  },
  {
    id: '5',
    question: 'Complete the pattern:',
    pattern: ['1', '3', '5', '7'],
    options: ['8', '9', '10', '11'],
    correctAnswer: 1,
    type: 'numbers'
  }
];

export default function PatternPuzzleGame({ isOpen, onClose, onStickerEarned }: PatternPuzzleGameProps) {
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const currentPuzzle = simplePuzzles[currentPuzzleIndex];

  useEffect(() => {
    if (isOpen) {
      resetGame();
    }
  }, [isOpen]);

  const resetGame = () => {
    setCurrentPuzzleIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
  };

  const handleAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    setShowFeedback(true);

    const correct = answerIndex === currentPuzzle.correctAnswer;
    setIsCorrect(correct);

    if (correct) {
      setScore(prev => prev + 10);
    }
  };

  const nextPuzzle = () => {
    if (currentPuzzleIndex < simplePuzzles.length - 1) {
      setCurrentPuzzleIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      // Game completed
      if (onStickerEarned) {
        onStickerEarned('pattern-puzzle-master');
      }
      resetGame();
    }
  };

  const closeGame = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="pattern-puzzle-game">
      <div className="game-header">
        <h3>🧩 Pattern Puzzles 🧩</h3>
        <div className="score">Score: {score}</div>
        <button onClick={closeGame} className="back-button">
          ← Back to Buddy
        </button>
      </div>

      <div className="game-content">
        {!showFeedback ? (
          <div className="puzzle-section">
            <div className="puzzle-question">
              <h4>{currentPuzzle.question}</h4>
            </div>

            <div className="pattern-display">
              {currentPuzzle.pattern.map((item, index) => (
                <span key={index} className="pattern-item">
                  {item}
                </span>
              ))}
              <span className="pattern-item question-mark">❓</span>
            </div>

            <div className="puzzle-options">
              <p>What comes next?</p>
              <div className="options-grid">
                {currentPuzzle.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    disabled={showFeedback}
                    className={`option-button ${selectedAnswer === index ? 'selected' : ''}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="feedback-section">
            <h4 className={`feedback-title ${isCorrect ? 'correct' : 'incorrect'}`}>
              {isCorrect ? '🎉 Correct! 🎉' : '❌ Not Quite! ❌'}
            </h4>
            <p className="feedback-message">
              {isCorrect
                ? 'Great job! You spotted the pattern! 🧠✨'
                : `The correct answer was: ${currentPuzzle.options[currentPuzzle.correctAnswer]}`
              }
            </p>
            <div className="feedback-controls">
              <button onClick={nextPuzzle} className="next-button">
                {currentPuzzleIndex < simplePuzzles.length - 1 ? 'Next Puzzle →' : 'Play Again 🔄'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}