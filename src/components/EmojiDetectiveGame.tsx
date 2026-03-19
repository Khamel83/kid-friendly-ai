import { useState, useRef, useEffect } from 'react';

interface EmojiDetectiveGameProps {
  onClose: () => void;
}

interface Puzzle {
  emojis: string;
  answer: string;
  hint: string;
  category: string;
}

const puzzles: Puzzle[] = [
  // Animals
  { emojis: '🌊 🐋', answer: 'whale', hint: 'It lives in the ocean', category: '🐾 Animals' },
  { emojis: '🌿 🦒', answer: 'giraffe', hint: 'Very tall neck', category: '🐾 Animals' },
  { emojis: '🐘 🌍', answer: 'elephant', hint: 'Biggest land animal', category: '🐾 Animals' },
  { emojis: '🦋 🌸', answer: 'butterfly', hint: 'Beautiful wings', category: '🐾 Animals' },
  { emojis: '🌙 🐺', answer: 'wolf', hint: 'Howls at night', category: '🐾 Animals' },
  { emojis: '🐾 🌲', answer: 'bear', hint: 'Loves honey and forests', category: '🐾 Animals' },

  // Food
  { emojis: '🍅 🧀 🍕', answer: 'pizza', hint: 'Baked in an oven', category: '🍔 Food' },
  { emojis: '🍌 🥛 🍦', answer: 'milkshake', hint: 'A cold drink you sip', category: '🍔 Food' },
  { emojis: '🥚 🍳', answer: 'eggs', hint: 'Breakfast favorite', category: '🍔 Food' },
  { emojis: '🍓 🍰', answer: 'cake', hint: 'Birthday treat', category: '🍔 Food' },
  { emojis: '🌽 🧈', answer: 'popcorn', hint: 'Movie time snack', category: '🍔 Food' },
  { emojis: '🍯 🥜', answer: 'peanut butter', hint: 'Spread on bread', category: '🍔 Food' },

  // Movies & Stories
  { emojis: '🦁 👑', answer: 'lion king', hint: 'Disney movie with Simba', category: '🎬 Movies' },
  { emojis: '❄️ ⛄ 👸', answer: 'frozen', hint: 'Let it go!', category: '🎬 Movies' },
  { emojis: '🐟 🌊 🔍', answer: 'finding nemo', hint: 'Just keep swimming', category: '🎬 Movies' },
  { emojis: '🚂 🧙 ⚡', answer: 'harry potter', hint: 'Magic school train', category: '🎬 Movies' },
  { emojis: '🕷️ 🏙️', answer: 'spider-man', hint: 'Swings between buildings', category: '🎬 Movies' },
  { emojis: '🧸 🤠', answer: 'toy story', hint: 'To infinity and beyond', category: '🎬 Movies' },

  // Activities
  { emojis: '🌊 🏄', answer: 'surfing', hint: 'Ride the waves', category: '⚡ Activities' },
  { emojis: '🎸 🎤 🎵', answer: 'singing', hint: 'Use your voice', category: '⚡ Activities' },
  { emojis: '⚽ 🥅', answer: 'soccer', hint: 'Kick the ball in the net', category: '⚡ Activities' },
  { emojis: '🎨 🖌️', answer: 'painting', hint: 'Make art with color', category: '⚡ Activities' },
  { emojis: '📚 💡', answer: 'reading', hint: 'You do this with books', category: '⚡ Activities' },
  { emojis: '🏔️ 🎿', answer: 'skiing', hint: 'Down snowy mountains', category: '⚡ Activities' },

  // Places
  { emojis: '🗼 🇫🇷', answer: 'paris', hint: 'City of lights in France', category: '🌍 Places' },
  { emojis: '🏖️ ☀️ 🌴', answer: 'beach', hint: 'Sand and waves', category: '🌍 Places' },
  { emojis: '🏔️ ❄️', answer: 'mountain', hint: 'Very tall, snow on top', category: '🌍 Places' },
  { emojis: '🌵 ☀️ 🦎', answer: 'desert', hint: 'Hot and dry', category: '🌍 Places' },
  { emojis: '🌳 🦜 🐆', answer: 'jungle', hint: 'Dense forest with wild animals', category: '🌍 Places' },
  { emojis: '🚀 🌙 ⭐', answer: 'space', hint: 'The final frontier', category: '🌍 Places' },
];

function normalize(str: string) {
  return str.toLowerCase().replace(/[-\s]+/g, ' ').trim();
}

export default function EmojiDetectiveGame({ onClose }: EmojiDetectiveGameProps) {
  const [shuffled] = useState(() => [...puzzles].sort(() => Math.random() - 0.5));
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | 'hint' | null>(null);
  const [phase, setPhase] = useState<'playing' | 'complete' | 'gameover'>('playing');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const puzzle = shuffled[index];

  useEffect(() => {
    inputRef.current?.focus();
  }, [index]);

  const showFeedback = (type: 'correct' | 'wrong' | 'hint', duration = 1200) => {
    setFeedback(type);
    setTimeout(() => setFeedback(null), duration);
  };

  const handleGuess = () => {
    const guess = normalize(input);
    const answer = normalize(puzzle.answer);

    if (guess === answer) {
      const points = hintUsed ? 5 : 10;
      setScore(s => s + points);
      showFeedback('correct');
      setInput('');
      setHintUsed(false);

      setTimeout(() => {
        if (index + 1 >= shuffled.length) {
          setPhase('complete');
        } else {
          setIndex(i => i + 1);
        }
      }, 1000);
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      showFeedback('wrong');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setInput('');

      if (newLives <= 0) {
        setTimeout(() => setPhase('gameover'), 1000);
      }
    }
  };

  const handleHint = () => {
    if (!hintUsed) {
      setHintUsed(true);
      showFeedback('hint', 2000);
    }
  };

  const handleRestart = () => {
    setIndex(0);
    setInput('');
    setLives(3);
    setScore(0);
    setHintUsed(false);
    setFeedback(null);
    setPhase('playing');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleGuess();
  };

  const livesDisplay = Array.from({ length: 3 }).map((_, i) =>
    i < lives ? '❤️' : '🖤'
  );

  return (
    <div className="overlay">
      <div className="game-box">
        <button className="close-btn" onClick={onClose}>✕</button>

        <h2 className="title">🔍 Emoji Detective</h2>

        {phase === 'playing' && (
          <>
            <div className="status-bar">
              <span className="lives">{livesDisplay.join(' ')}</span>
              <span className="score">⭐ {score}</span>
              <span className="progress">{index + 1}/{shuffled.length}</span>
            </div>

            <div className="category-badge">{puzzle.category}</div>

            <div className={`emoji-display ${shake ? 'shake' : ''}`}>
              {puzzle.emojis}
            </div>

            {feedback === 'correct' && (
              <div className="feedback correct">✅ Correct! +{hintUsed ? 5 : 10} points!</div>
            )}
            {feedback === 'wrong' && (
              <div className="feedback wrong">❌ Not quite! Try again!</div>
            )}
            {feedback === 'hint' && (
              <div className="feedback hint">💡 Hint: {puzzle.hint}</div>
            )}
            {!feedback && hintUsed && (
              <div className="hint-active">💡 {puzzle.hint}</div>
            )}

            <div className="input-row">
              <input
                ref={inputRef}
                className="guess-input"
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer..."
                autoComplete="off"
                autoCapitalize="off"
              />
            </div>

            <div className="button-row">
              <button className="guess-btn" onClick={handleGuess} disabled={!input.trim()}>
                🔍 Guess!
              </button>
              <button className="hint-btn" onClick={handleHint} disabled={hintUsed}>
                💡 {hintUsed ? 'Hint used' : 'Hint'}
              </button>
            </div>

            <div className="tip">Type what the emojis represent and press Guess!</div>
          </>
        )}

        {phase === 'gameover' && (
          <div className="end-area">
            <div className="end-icon">💔</div>
            <h3 className="end-title">Out of lives!</h3>
            <p className="end-text">The answer was: <strong>{puzzle.answer}</strong></p>
            <div className="final-score">⭐ Score: {score}</div>
            <div className="buttons-row">
              <button className="action-btn" onClick={handleRestart}>🔄 Try Again</button>
              <button className="secondary-btn" onClick={onClose}>🏠 Home</button>
            </div>
          </div>
        )}

        {phase === 'complete' && (
          <div className="end-area">
            <div className="end-icon">🏆</div>
            <h3 className="end-title">Case Closed!</h3>
            <p className="end-text">You solved all the emoji mysteries!</p>
            <div className="final-score">⭐ Final Score: {score}</div>
            <div className="buttons-row">
              <button className="action-btn" onClick={handleRestart}>🔄 Play Again</button>
              <button className="secondary-btn" onClick={onClose}>🏠 Home</button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }

        .game-box {
          position: relative;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 24px;
          padding: 28px 24px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          color: white;
          box-shadow: 0 0 40px rgba(240, 147, 251, 0.3);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(255,255,255,0.15);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 16px;
          cursor: pointer;
        }

        .close-btn:hover { background: rgba(255,255,255,0.25); }

        .title {
          text-align: center;
          font-size: 28px;
          margin: 0 0 16px;
          text-shadow: 0 0 20px rgba(240,147,251,0.6);
        }

        .status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          font-size: 16px;
        }

        .lives { font-size: 20px; }
        .score { font-weight: bold; color: gold; }
        .progress { color: rgba(255,255,255,0.6); font-size: 14px; }

        .category-badge {
          display: inline-block;
          background: rgba(240,147,251,0.2);
          border: 1px solid rgba(240,147,251,0.4);
          border-radius: 20px;
          padding: 4px 14px;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .emoji-display {
          font-size: 52px;
          text-align: center;
          padding: 20px;
          background: rgba(255,255,255,0.06);
          border-radius: 20px;
          margin-bottom: 16px;
          letter-spacing: 8px;
          min-height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid rgba(255,255,255,0.1);
        }

        .emoji-display.shake {
          animation: shake 0.4s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }

        .feedback {
          text-align: center;
          font-size: 18px;
          font-weight: bold;
          padding: 10px 16px;
          border-radius: 12px;
          margin-bottom: 14px;
          animation: popIn 0.2s ease;
        }

        @keyframes popIn {
          from { transform: scale(0.85); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .feedback.correct { background: rgba(76, 175, 80, 0.25); border: 1px solid #4caf50; }
        .feedback.wrong { background: rgba(244, 67, 54, 0.25); border: 1px solid #f44336; }
        .feedback.hint { background: rgba(255, 193, 7, 0.2); border: 1px solid #ffc107; color: #ffd54f; }

        .hint-active {
          text-align: center;
          font-size: 15px;
          color: #ffd54f;
          background: rgba(255, 193, 7, 0.1);
          border-radius: 10px;
          padding: 8px 14px;
          margin-bottom: 12px;
        }

        .input-row {
          margin-bottom: 14px;
        }

        .guess-input {
          width: 100%;
          padding: 14px 16px;
          font-size: 18px;
          border-radius: 14px;
          border: 2px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.08);
          color: white;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        .guess-input::placeholder { color: rgba(255,255,255,0.35); }
        .guess-input:focus { border-color: rgba(240,147,251,0.6); }

        .button-row {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
        }

        .guess-btn {
          flex: 2;
          padding: 14px;
          font-size: 18px;
          font-weight: bold;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          transition: transform 0.15s, opacity 0.15s;
          box-shadow: 0 4px 16px rgba(240,93,108,0.4);
        }

        .guess-btn:hover:not(:disabled) { transform: translateY(-2px); }
        .guess-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .hint-btn {
          flex: 1;
          padding: 14px;
          font-size: 15px;
          background: rgba(255, 193, 7, 0.15);
          color: #ffd54f;
          border: 2px solid rgba(255, 193, 7, 0.3);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .hint-btn:hover:not(:disabled) { background: rgba(255, 193, 7, 0.25); }
        .hint-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .tip {
          text-align: center;
          font-size: 13px;
          color: rgba(255,255,255,0.4);
        }

        .end-area {
          text-align: center;
          padding: 16px 0;
          animation: fadeIn 0.4s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .end-icon { font-size: 72px; margin-bottom: 8px; }

        .end-title {
          font-size: 26px;
          margin: 0 0 8px;
          color: gold;
        }

        .end-text {
          font-size: 16px;
          color: rgba(255,255,255,0.8);
          margin-bottom: 16px;
        }

        .final-score {
          font-size: 24px;
          font-weight: bold;
          color: gold;
          margin-bottom: 24px;
        }

        .buttons-row {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 14px 24px;
          font-size: 17px;
          font-weight: bold;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          transition: transform 0.15s;
          box-shadow: 0 4px 16px rgba(240,93,108,0.4);
        }

        .action-btn:hover { transform: scale(1.04); }

        .secondary-btn {
          padding: 14px 24px;
          font-size: 17px;
          background: rgba(255,255,255,0.12);
          color: white;
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 14px;
          cursor: pointer;
          transition: transform 0.15s;
        }

        .secondary-btn:hover { transform: scale(1.04); background: rgba(255,255,255,0.18); }
      `}</style>
    </div>
  );
}
