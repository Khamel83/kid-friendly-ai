import React, { useState, useEffect } from 'react';

interface MiniGameProps {
  onComplete: () => void;
}

const animals = [
  {
    name: 'elephant',
    emoji: '🐘',
    hints: [
      'I have a very long nose called a trunk',
      'I am the largest land animal',
      'I love to play in water and mud',
      'I have big ears and I never forget'
    ]
  },
  {
    name: 'dolphin',
    emoji: '🐬',
    hints: [
      'I am a very smart sea animal',
      'I love to jump and play in waves',
      'I talk with clicks and whistles',
      'I sleep with one eye open'
    ]
  },
  {
    name: 'butterfly',
    emoji: '🦋',
    hints: [
      'I start as a caterpillar',
      'I have beautiful colorful wings',
      'I love to fly from flower to flower',
      'I used to crawl but now I can fly'
    ]
  },
  {
    name: 'penguin',
    emoji: '🐧',
    hints: [
      'I wear a tuxedo but I\'m not going to a party',
      'I love to slide on my belly',
      'I live where it\'s very cold',
      'I can\'t fly but I\'m an excellent swimmer'
    ]
  }
];

export default function MiniGame({ onComplete }: MiniGameProps) {
  const [currentAnimal, setCurrentAnimal] = useState(0);
  const [hintIndex, setHintIndex] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const currentGame = animals[currentAnimal];

  // Generate multiple choice options (correct answer + 3 wrong ones)
  const getOptions = () => {
    const correctAnswer = currentGame.name;
    const wrongAnswers = animals
      .filter(animal => animal.name !== correctAnswer)
      .map(animal => animal.name)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const allOptions = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    return allOptions;
  };

  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    setOptions(getOptions());
    setHintIndex(0);
    setGameState('playing');
    setSelectedAnswer(null);
    setShowFeedback(false);
  }, [currentAnimal]);

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    setShowFeedback(true);

    if (answer.toLowerCase() === currentGame.name.toLowerCase()) {
      setGameState('won');
      setScore(prev => prev + (5 - hintIndex)); // More points for fewer hints
    } else {
      setGameState('lost');
    }
  };

  const nextHint = () => {
    if (hintIndex < currentGame.hints.length - 1) {
      setHintIndex(prev => prev + 1);
    }
  };

  const nextAnimal = () => {
    setCurrentAnimal(prev => (prev + 1) % animals.length);
  };

  const finishGame = () => {
    onComplete();
  };

  return (
    <div className="mini-game">
      <div className="game-header">
        <h3>🐾 Guess the Animal! 🐾</h3>
        <div className="score">Stars: ⭐{score}</div>
        <button onClick={finishGame} className="back-button">
          ← Back to Buddy
        </button>
      </div>

      <div className="game-content">
        <div className="animal-emoji" style={{ fontSize: '4rem' }}>
          {gameState !== 'playing' ? currentGame.emoji : '❓'}
        </div>

        {gameState === 'playing' && (
          <div className="hints-section">
            <p className="hint-label">💡 Clues:</p>
            <div className="hints-list">
              {currentGame.hints.slice(0, hintIndex + 1).map((hint, index) => (
                <div key={index} className="hint-item">
                  {hint}
                </div>
              ))}
            </div>

            {hintIndex < currentGame.hints.length - 1 && (
              <button onClick={nextHint} className="hint-button">
                Need Another Clue?
              </button>
            )}

            <div className="multiple-choice">
              <p className="question-text">What animal am I?</p>
              <div className="options-grid">
                {options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => !showFeedback && handleAnswer(option)}
                    disabled={showFeedback}
                    className={`option-button ${
                      showFeedback && option.toLowerCase() === currentGame.name.toLowerCase()
                        ? 'correct'
                        : showFeedback && selectedAnswer === option
                        ? 'incorrect'
                        : ''
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showFeedback && (
          <div className="feedback-section">
            <h4 className={`feedback-title ${gameState === 'won' ? 'correct' : 'incorrect'}`}>
              {gameState === 'won' ? '🎉 Correct! 🎉' : '❌ Not Quite! ❌'}
            </h4>
            <p className="feedback-animal">
              It's a {currentGame.emoji} {currentGame.name.charAt(0).toUpperCase() + currentGame.name.slice(1)}!
            </p>
            <p className="feedback-message">
              {gameState === 'won'
                ? 'Amazing job! You\'re a super detective! 🕵️‍♂️✨'
                : `Don't worry! The answer was ${currentGame.name}. Try the next one! 🌟`
              }
            </p>

            <div className="feedback-controls">
              <button onClick={nextAnimal} className="next-button">
                Next Animal →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}