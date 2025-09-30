import { useState, useEffect } from 'react';

interface Word {
  word: string;
  scrambled: string;
  hint: string;
  category: string;
}

const words: Word[] = [
  { word: 'dragon', scrambled: 'gondar', hint: 'A fire-breathing creature', category: 'Fantasy' },
  { word: 'castle', scrambled: 'stecla', hint: 'Where a king and queen live', category: 'Places' },
  { word: 'rocket', scrambled: 'tekroc', hint: 'Flies to space', category: 'Things' },
  { word: 'rainbow', scrambled: 'wnabiro', hint: 'Colorful arc in the sky', category: 'Nature' },
  { word: 'wizard', scrambled: 'drazwi', hint: 'Someone who does magic', category: 'Fantasy' },
  { word: 'dinosaur', scrambled: 'ransoidu', hint: 'Ancient giant reptile', category: 'Animals' },
  { word: 'treasure', scrambled: 'saureetr', hint: 'Pirates look for this', category: 'Things' },
  { word: 'butterfly', scrambled: 'flybutter', hint: 'Colorful insect with wings', category: 'Animals' },
  { word: 'adventure', scrambled: 'ventudear', hint: 'An exciting journey', category: 'Actions' },
  { word: 'unicorn', scrambled: 'cornuni', hint: 'Magical horse with a horn', category: 'Fantasy' },
];

interface SimpleWordGameProps {
  onClose: () => void;
}

export default function SimpleWordGame({ onClose }: SimpleWordGameProps) {
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [userGuess, setUserGuess] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);

  const generateWord = () => {
    const word = words[Math.floor(Math.random() * words.length)];
    setCurrentWord(word);
    setUserGuess('');
    setFeedback('');
    setShowAnswer(false);
  };

  useEffect(() => {
    generateWord();
  }, []);

  const checkAnswer = () => {
    if (!currentWord) return;

    if (userGuess.toLowerCase() === currentWord.word.toLowerCase()) {
      setFeedback('🎉 Amazing! You unscrambled it!');
      setScore(score + 1);
      setShowAnswer(true);
    } else if (userGuess.length === 0) {
      setFeedback('Type your guess first!');
    } else {
      setFeedback('Not quite! Try again! 💪');
    }
  };

  const showHint = () => {
    setShowAnswer(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showAnswer) {
        generateWord();
      } else {
        checkAnswer();
      }
    }
  };

  if (!currentWord) return null;

  return (
    <div className="game-overlay">
      <div className="game-modal">
        <button className="game-close" onClick={onClose}>✕</button>

        <h2 className="game-title">📝 Word Scramble</h2>
        <div className="game-score">Score: {score}</div>

        <div className="word-game-content">
          <div className="word-category">{currentWord.category}</div>

          <div className="scrambled-word">
            {currentWord.scrambled.split('').map((letter, i) => (
              <span key={i} className="letter-tile">
                {letter.toUpperCase()}
              </span>
            ))}
          </div>

          <div className="word-hint">
            <span className="hint-label">Hint:</span> {currentWord.hint}
          </div>

          {!showAnswer && (
            <>
              <input
                type="text"
                className="word-input"
                value={userGuess}
                onChange={(e) => setUserGuess(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type the word..."
                autoFocus
              />

              {feedback && (
                <div className={`word-feedback ${feedback.includes('Amazing') ? 'correct' : 'incorrect'}`}>
                  {feedback}
                </div>
              )}

              <div className="game-buttons">
                <button className="game-button secondary" onClick={showHint}>
                  Show Answer
                </button>
                <button className="game-button primary" onClick={checkAnswer}>
                  Check ✓
                </button>
              </div>
            </>
          )}

          {showAnswer && (
            <>
              <div className={`word-answer ${feedback.includes('Amazing') ? 'correct' : 'reveal'}`}>
                <div className="answer-label">The word is:</div>
                <div className="answer-word">{currentWord.word.toUpperCase()}</div>
              </div>

              <div className="game-buttons">
                <button className="game-button primary" onClick={generateWord}>
                  Next Word ➡️
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .game-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .game-modal {
          background: white;
          border-radius: 24px;
          padding: 32px;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          position: relative;
          max-height: 90vh;
          overflow-y: auto;
        }

        .game-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: #f0f0f0;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 24px;
          cursor: pointer;
        }

        .game-close:hover {
          background: #e0e0e0;
        }

        .game-title {
          font-size: 32px;
          margin: 0 0 16px 0;
          text-align: center;
          color: #2c3e50;
        }

        .game-score {
          text-align: center;
          font-size: 20px;
          font-weight: bold;
          color: #27ae60;
          margin-bottom: 32px;
        }

        .word-game-content {
          text-align: center;
        }

        .word-category {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: bold;
          margin-bottom: 24px;
        }

        .scrambled-word {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin: 24px 0;
          flex-wrap: wrap;
        }

        .letter-tile {
          background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: bold;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .word-hint {
          font-size: 18px;
          color: #7f8c8d;
          margin: 24px 0;
        }

        .hint-label {
          font-weight: bold;
          color: #2c3e50;
        }

        .word-input {
          width: 100%;
          padding: 16px;
          font-size: 24px;
          text-align: center;
          border: 3px solid #3498db;
          border-radius: 12px;
          margin: 24px 0;
          text-transform: uppercase;
          font-weight: bold;
        }

        .word-input:focus {
          outline: none;
          border-color: #2980b9;
          box-shadow: 0 0 0 4px rgba(52, 152, 219, 0.2);
        }

        .word-feedback {
          text-align: center;
          font-size: 20px;
          font-weight: bold;
          margin: 16px 0;
          padding: 16px;
          border-radius: 12px;
        }

        .word-feedback.correct {
          background: #d4edda;
          color: #155724;
        }

        .word-feedback.incorrect {
          background: #fff3cd;
          color: #856404;
        }

        .word-answer {
          padding: 24px;
          border-radius: 16px;
          margin: 24px 0;
        }

        .word-answer.correct {
          background: #d4edda;
        }

        .word-answer.reveal {
          background: #e8f4f8;
        }

        .answer-label {
          font-size: 18px;
          color: #7f8c8d;
          margin-bottom: 12px;
        }

        .answer-word {
          font-size: 36px;
          font-weight: bold;
          color: #2c3e50;
        }

        .game-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-top: 24px;
        }

        .game-button {
          padding: 16px 32px;
          font-size: 18px;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: bold;
          transition: transform 0.2s;
        }

        .game-button:hover {
          transform: scale(1.05);
        }

        .game-button.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .game-button.secondary {
          background: #95a5a6;
          color: white;
        }

        @media (max-width: 600px) {
          .game-modal {
            padding: 24px;
          }

          .letter-tile {
            width: 40px;
            height: 40px;
            font-size: 22px;
          }

          .word-input {
            font-size: 20px;
          }

          .game-button {
            padding: 12px 24px;
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
}
