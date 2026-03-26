import { useState, useMemo } from 'react';

interface EmojiDetectiveGameProps {
  onClose: () => void;
}

interface Puzzle {
  emojis: string;
  answer: string;
  category: string;
}

const allPuzzles: Puzzle[] = [
  // Animals
  { emojis: '🌊 🐋', answer: 'Whale', category: '🐾 Animals' },
  { emojis: '🌿 🦒', answer: 'Giraffe', category: '🐾 Animals' },
  { emojis: '🐘 🌍', answer: 'Elephant', category: '🐾 Animals' },
  { emojis: '🦋 🌸', answer: 'Butterfly', category: '🐾 Animals' },
  { emojis: '🌙 🐺', answer: 'Wolf', category: '🐾 Animals' },
  { emojis: '🍯 🐻', answer: 'Bear', category: '🐾 Animals' },
  { emojis: '🌳 🐒', answer: 'Monkey', category: '🐾 Animals' },
  { emojis: '🌊 🦈', answer: 'Shark', category: '🐾 Animals' },
  { emojis: '🦁 👑', answer: 'Lion', category: '🐾 Animals' },
  { emojis: '🐢 🌊', answer: 'Turtle', category: '🐾 Animals' },
  { emojis: '🐧 ❄️', answer: 'Penguin', category: '🐾 Animals' },
  { emojis: '🦊 🌲', answer: 'Fox', category: '🐾 Animals' },
  { emojis: '🦓 🌿', answer: 'Zebra', category: '🐾 Animals' },
  { emojis: '🐸 🌧️', answer: 'Frog', category: '🐾 Animals' },
  { emojis: '🕷️ 🕸️', answer: 'Spider', category: '🐾 Animals' },

  // Food
  { emojis: '🍅 🧀 🍕', answer: 'Pizza', category: '🍔 Food' },
  { emojis: '🍌 🥛 🍦', answer: 'Milkshake', category: '🍔 Food' },
  { emojis: '🥚 🍳', answer: 'Eggs', category: '🍔 Food' },
  { emojis: '🍓 🎂', answer: 'Cake', category: '🍔 Food' },
  { emojis: '🌽 🔥', answer: 'Popcorn', category: '🍔 Food' },
  { emojis: '🍯 🥜', answer: 'Peanut Butter', category: '🍔 Food' },
  { emojis: '🍫 🥛', answer: 'Hot Chocolate', category: '🍔 Food' },
  { emojis: '🍞 🧈', answer: 'Toast', category: '🍔 Food' },
  { emojis: '🍎 🥧', answer: 'Apple Pie', category: '🍔 Food' },
  { emojis: '🥕 🫕', answer: 'Soup', category: '🍔 Food' },
  { emojis: '🍦 🍫', answer: 'Ice Cream', category: '🍔 Food' },
  { emojis: '🥞 🍁', answer: 'Pancakes', category: '🍔 Food' },

  // Movies & Stories
  { emojis: '❄️ ⛄ 👸', answer: 'Frozen', category: '🎬 Movies' },
  { emojis: '🐟 🌊 🔍', answer: 'Finding Nemo', category: '🎬 Movies' },
  { emojis: '🚂 🧙 ⚡', answer: 'Harry Potter', category: '🎬 Movies' },
  { emojis: '🧸 🤠', answer: 'Toy Story', category: '🎬 Movies' },
  { emojis: '🦁 👑', answer: 'Lion King', category: '🎬 Movies' },
  { emojis: '🕷️ 🏙️', answer: 'Spider-Man', category: '🎬 Movies' },
  { emojis: '🐠 🌊 🔵', answer: 'Moana', category: '🎬 Movies' },
  { emojis: '🐭 🍽️ 👨‍🍳', answer: 'Ratatouille', category: '🎬 Movies' },
  { emojis: '👻 🏚️', answer: 'Ghostbusters', category: '🎬 Movies' },
  { emojis: '🦸 🌩️ ⚡', answer: 'Thor', category: '🎬 Movies' },
  { emojis: '🧁 🎩 🐛', answer: 'Alice in Wonderland', category: '🎬 Movies' },
  { emojis: '🦌 🌲 🍄', answer: 'Bambi', category: '🎬 Movies' },

  // Activities
  { emojis: '🌊 🏄', answer: 'Surfing', category: '⚡ Activities' },
  { emojis: '⚽ 🥅', answer: 'Soccer', category: '⚡ Activities' },
  { emojis: '🎨 🖌️', answer: 'Painting', category: '⚡ Activities' },
  { emojis: '📚 💡', answer: 'Reading', category: '⚡ Activities' },
  { emojis: '🏔️ 🎿', answer: 'Skiing', category: '⚡ Activities' },
  { emojis: '🎸 🎤', answer: 'Singing', category: '⚡ Activities' },
  { emojis: '🏊 🌊', answer: 'Swimming', category: '⚡ Activities' },
  { emojis: '🚴 🏆', answer: 'Cycling', category: '⚡ Activities' },
  { emojis: '🎃 🍬', answer: 'Halloween', category: '⚡ Activities' },
  { emojis: '🎂 🎉', answer: 'Birthday', category: '⚡ Activities' },
  { emojis: '⛺ 🌲 🔥', answer: 'Camping', category: '⚡ Activities' },
  { emojis: '🌙 ⭐ 😴', answer: 'Sleeping', category: '⚡ Activities' },

  // Places
  { emojis: '🗼 🇫🇷', answer: 'Paris', category: '🌍 Places' },
  { emojis: '🏖️ ☀️ 🌴', answer: 'Beach', category: '🌍 Places' },
  { emojis: '🏔️ ❄️', answer: 'Mountain', category: '🌍 Places' },
  { emojis: '🌵 ☀️ 🦎', answer: 'Desert', category: '🌍 Places' },
  { emojis: '🌳 🦜 🐆', answer: 'Jungle', category: '🌍 Places' },
  { emojis: '🚀 🌙 ⭐', answer: 'Space', category: '🌍 Places' },
  { emojis: '🏰 👸 🗡️', answer: 'Castle', category: '🌍 Places' },
  { emojis: '🌊 🐟 🤿', answer: 'Ocean', category: '🌍 Places' },
  { emojis: '🌾 🐄 🚜', answer: 'Farm', category: '🌍 Places' },
  { emojis: '🎡 🎢 🎠', answer: 'Carnival', category: '🌍 Places' },
];

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function pickOptions(correct: string, all: Puzzle[]): string[] {
  const wrong = shuffle(all.filter(p => p.answer !== correct))
    .slice(0, 5)
    .map(p => p.answer);
  return shuffle([...wrong, correct]);
}

export default function EmojiDetectiveGame({ onClose }: EmojiDetectiveGameProps) {
  const [gameKey, setGameKey] = useState(0);

  const puzzlesWithOptions = useMemo(() => {
    return shuffle(allPuzzles).map(p => ({
      ...p,
      options: pickOptions(p.answer, allPuzzles),
    }));
  }, [gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [phase, setPhase] = useState<'playing' | 'complete'>('playing');
  const [shake, setShake] = useState(false);
  const [wrongAnswer, setWrongAnswer] = useState('');

  const puzzle = puzzlesWithOptions[index];

  const handleGuess = (option: string) => {
    if (option === puzzle.answer) {
      setScore(s => s + 10);
      setFeedback('correct');
      setTimeout(() => {
        setFeedback(null);
        if (index + 1 >= puzzlesWithOptions.length) {
          setPhase('complete');
        } else {
          setIndex(i => i + 1);
        }
      }, 1000);
    } else {
      setWrongAnswer(option);
      setFeedback('wrong');
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setFeedback(null);
        setWrongAnswer('');
      }, 900);
    }
  };

  const handleRestart = () => {
    setGameKey(k => k + 1);
    setIndex(0);
    setScore(0);
    setFeedback(null);
    setPhase('playing');
    setShake(false);
    setWrongAnswer('');
  };

  return (
    <div className="overlay">
      <div className="game-box">
        <button className="close-btn" onClick={onClose}>✕</button>

        <h2 className="title">🔍 Emoji Detective</h2>
        <p className="subtitle">Look at the emojis and pick what they mean!</p>

        {phase === 'playing' && (
          <>
            <div className="status-bar">
              <span className="category">{puzzle.category}</span>
              <span className="score">⭐ {score}</span>
              <span className="progress">{index + 1}/{puzzlesWithOptions.length}</span>
            </div>

            <div className={`emoji-display ${shake ? 'shake' : ''}`}>
              {puzzle.emojis}
            </div>

            {feedback === 'correct' && (
              <div className="feedback correct">✅ Yes! That's right!</div>
            )}
            {feedback === 'wrong' && (
              <div className="feedback wrong">❌ Nope! Try again!</div>
            )}
            {!feedback && <div className="feedback-placeholder" />}

            <div className="options-grid">
              {puzzle.options.map(opt => (
                <button
                  key={opt}
                  className={`option-btn ${opt === wrongAnswer ? 'wrong-pick' : ''}`}
                  onClick={() => handleGuess(opt)}
                  disabled={feedback !== null}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
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
          max-width: 500px;
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
          margin: 0 0 4px;
          text-shadow: 0 0 20px rgba(240,147,251,0.6);
        }

        .subtitle {
          text-align: center;
          font-size: 15px;
          color: rgba(255,255,255,0.6);
          margin: 0 0 16px;
        }

        .status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          font-size: 14px;
        }

        .category {
          background: rgba(240,147,251,0.2);
          border: 1px solid rgba(240,147,251,0.4);
          border-radius: 20px;
          padding: 3px 12px;
          font-size: 13px;
        }

        .score { font-weight: bold; color: gold; font-size: 16px; }
        .progress { color: rgba(255,255,255,0.5); }

        .emoji-display {
          font-size: 52px;
          text-align: center;
          padding: 20px;
          background: rgba(255,255,255,0.06);
          border-radius: 20px;
          margin-bottom: 12px;
          letter-spacing: 8px;
          min-height: 96px;
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
          padding: 8px 16px;
          border-radius: 12px;
          margin-bottom: 12px;
          animation: popIn 0.2s ease;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .feedback-placeholder {
          min-height: 40px;
          margin-bottom: 12px;
        }

        @keyframes popIn {
          from { transform: scale(0.85); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .feedback.correct { background: rgba(76, 175, 80, 0.25); border: 1px solid #4caf50; }
        .feedback.wrong { background: rgba(244, 67, 54, 0.25); border: 1px solid #f44336; }

        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .option-btn {
          padding: 12px 8px;
          font-size: 15px;
          font-weight: bold;
          background: rgba(255,255,255,0.1);
          color: white;
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.15s;
          line-height: 1.3;
        }

        .option-btn:hover:not(:disabled) {
          background: rgba(240, 147, 251, 0.3);
          border-color: rgba(240, 147, 251, 0.6);
          transform: translateY(-2px);
        }

        .option-btn:disabled { cursor: not-allowed; opacity: 0.7; }

        .option-btn.wrong-pick {
          background: rgba(244, 67, 54, 0.3);
          border-color: #f44336;
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
