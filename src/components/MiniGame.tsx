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
  const [gameState, setGameState] = useState<'playing' | 'won' | 'gaveUp'>('playing');
  const [score, setScore] = useState(0);

  const currentGame = animals[currentAnimal];

  const handleGuess = (guess: string) => {
    if (guess.toLowerCase() === currentGame.name.toLowerCase()) {
      setGameState('won');
      setScore(prev => prev + (5 - hintIndex)); // More points for fewer hints
    }
  };

  const nextHint = () => {
    if (hintIndex < currentGame.hints.length - 1) {
      setHintIndex(prev => prev + 1);
    }
  };

  const giveUp = () => {
    setGameState('gaveUp');
  };

  const nextAnimal = () => {
    setCurrentAnimal(prev => (prev + 1) % animals.length);
    setHintIndex(0);
    setGameState('playing');
  };

  const finishGame = () => {
    onComplete();
  };

  return (
    <div className="mini-game">
      <div className="game-header">
        <h3>🎮 Guess the Animal Game! 🎮</h3>
        <div className="score">Stars: ⭐{score}</div>
      </div>

      <div className="game-content">
        <div className="animal-emoji" style={{ fontSize: '4rem' }}>
          {gameState === 'playing' ? '❓' : currentGame.emoji}
        </div>

        {gameState === 'playing' && (
          <div className="hints-section">
            <p className="hint-label">Here are your clues:</p>
            <div className="hints-list">
              {currentGame.hints.slice(0, hintIndex + 1).map((hint, index) => (
                <div key={index} className="hint-item">
                  💡 {hint}
                </div>
              ))}
            </div>

            <div className="game-controls">
              {hintIndex < currentGame.hints.length - 1 && (
                <button onClick={nextHint} className="game-button hint-button">
                  Need Another Hint? 💭
                </button>
              )}

              <div className="guess-input">
                <input
                  type="text"
                  placeholder="What animal am I? 🤔"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleGuess((e.target as HTMLInputElement).value);
                    }
                  }}
                  className="guess-input-field"
                />
                <button
                  onClick={() => handleGuess((document.querySelector('.guess-input-field') as HTMLInputElement)?.value || '')}
                  className="game-button guess-button"
                >
                  Guess! 🎯
                </button>
              </div>

              <button onClick={giveUp} className="game-button giveup-button">
                Tell Me! 🙈
              </button>
            </div>
          </div>
        )}

        {(gameState === 'won' || gameState === 'gaveUp') && (
          <div className="result-section">
            <h4 className="result-title">
              {gameState === 'won' ? '🎉 You Got It! 🎉' : '🤔 It Was...'}
            </h4>
            <p className="result-animal">
              {currentGame.emoji} {currentGame.name.charAt(0).toUpperCase() + currentGame.name.slice(1)}!
            </p>
            <p className="result-message">
              {gameState === 'won'
                ? 'Amazing job! You\'re a super detective! 🕵️‍♂️✨'
                : 'That\'s okay! You\'ll get it next time! 🌟'
              }
            </p>

            <div className="result-controls">
              <button onClick={nextAnimal} className="game-button next-button">
                Next Animal! 🐾
              </button>
              <button onClick={finishGame} className="game-button finish-button">
                Back to Buddy! 🤖
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}