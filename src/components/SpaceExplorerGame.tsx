import { useState } from 'react';

interface SpaceExplorerGameProps {
  onClose: () => void;
}

const planets = [
  {
    name: 'Mercury',
    emoji: '🪨',
    color: '#b5b5b5',
    fact: 'Mercury is the smallest planet and closest to the Sun! A year there is only 88 Earth days.',
    questions: [
      {
        text: 'Mercury is the _____ planet from the Sun.',
        options: ['1st', '2nd', '3rd', '4th'],
        answer: '1st',
      },
      {
        text: 'What is 7 + 8? (fuel units needed to launch!)',
        options: ['13', '14', '15', '16'],
        answer: '15',
      },
    ],
  },
  {
    name: 'Venus',
    emoji: '🌕',
    color: '#e8c56e',
    fact: "Venus is the hottest planet — even hotter than Mercury! It spins backwards compared to most planets.",
    questions: [
      {
        text: 'Venus is sometimes called Earth\'s ___.',
        options: ['Twin', 'Enemy', 'Moon', 'Brother'],
        answer: 'Twin',
      },
      {
        text: 'What is 6 × 4? (fuel units needed!)',
        options: ['20', '22', '24', '26'],
        answer: '24',
      },
    ],
  },
  {
    name: 'Earth',
    emoji: '🌍',
    color: '#4fc3f7',
    fact: 'Earth is the only planet known to have life! It has one moon and is mostly covered in water.',
    questions: [
      {
        text: 'How much of Earth is covered by water?',
        options: ['30%', '50%', '70%', '90%'],
        answer: '70%',
      },
      {
        text: 'What is 12 × 5? (fuel units needed!)',
        options: ['50', '55', '60', '65'],
        answer: '60',
      },
    ],
  },
  {
    name: 'Mars',
    emoji: '🔴',
    color: '#ef5350',
    fact: 'Mars is called the Red Planet! It has the biggest volcano in the solar system — Olympus Mons.',
    questions: [
      {
        text: 'How many moons does Mars have?',
        options: ['0', '1', '2', '4'],
        answer: '2',
      },
      {
        text: 'What is 9 × 9? (fuel units needed!)',
        options: ['72', '81', '88', '90'],
        answer: '81',
      },
    ],
  },
  {
    name: 'Jupiter',
    emoji: '🟠',
    color: '#ff8f00',
    fact: 'Jupiter is the biggest planet! Its Great Red Spot is a storm that has been raging for over 350 years.',
    questions: [
      {
        text: 'Jupiter is the _____ planet from the Sun.',
        options: ['4th', '5th', '6th', '7th'],
        answer: '5th',
      },
      {
        text: 'What is 11 × 11? (fuel units needed!)',
        options: ['111', '121', '131', '141'],
        answer: '121',
      },
    ],
  },
  {
    name: 'Saturn',
    emoji: '🪐',
    color: '#fdd835',
    fact: "Saturn's rings are made of ice and rock! It has 146 known moons — more than any other planet.",
    questions: [
      {
        text: "Saturn's rings are mostly made of ___.",
        options: ['Gas', 'Ice & Rock', 'Lava', 'Dust'],
        answer: 'Ice & Rock',
      },
      {
        text: 'What is 144 ÷ 12? (fuel units needed!)',
        options: ['10', '11', '12', '13'],
        answer: '12',
      },
    ],
  },
  {
    name: 'Uranus',
    emoji: '🩵',
    color: '#80deea',
    fact: "Uranus rotates on its side! It's so tilted that its poles take turns facing the Sun for 42 years each.",
    questions: [
      {
        text: 'Uranus appears what color from space?',
        options: ['Red', 'Yellow', 'Blue-green', 'Purple'],
        answer: 'Blue-green',
      },
      {
        text: 'What is 200 ÷ 4? (fuel units needed!)',
        options: ['40', '50', '60', '70'],
        answer: '50',
      },
    ],
  },
  {
    name: 'Neptune',
    emoji: '💙',
    color: '#3949ab',
    fact: 'Neptune has the strongest winds in the solar system — up to 2,100 km/h! It takes 165 years to orbit the Sun.',
    questions: [
      {
        text: 'Neptune is the _____ planet from the Sun.',
        options: ['6th', '7th', '8th', '9th'],
        answer: '8th',
      },
      {
        text: 'What is 7 × 8? (final fuel boost!)',
        options: ['48', '54', '56', '64'],
        answer: '56',
      },
    ],
  },
];

export default function SpaceExplorerGame({ onClose }: SpaceExplorerGameProps) {
  const [planetIndex, setPlanetIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [fuel, setFuel] = useState(0);
  const [phase, setPhase] = useState<'question' | 'landing' | 'complete'>('question');
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [wrongGuesses, setWrongGuesses] = useState(0);

  const planet = planets[planetIndex];
  const question = planet.questions[questionIndex];
  const totalPlanets = planets.length;
  const fuelTarget = 100;

  const handleAnswer = (option: string) => {
    if (option === question.answer) {
      const fuelGain = 50;
      const newFuel = Math.min(fuel + fuelGain, fuelTarget);
      setFuel(newFuel);
      setScore(s => s + 10);
      setFeedback('✅ Correct! Fuel loaded!');

      setTimeout(() => {
        setFeedback('');
        if (questionIndex + 1 < planet.questions.length) {
          setQuestionIndex(qi => qi + 1);
        } else {
          setFuel(100);
          setPhase('landing');
        }
      }, 900);
    } else {
      setWrongGuesses(w => w + 1);
      setFeedback('❌ Not quite! Try again!');
      setTimeout(() => setFeedback(''), 900);
    }
  };

  const handleNextPlanet = () => {
    if (planetIndex + 1 >= totalPlanets) {
      setPhase('complete');
    } else {
      setPlanetIndex(pi => pi + 1);
      setQuestionIndex(0);
      setFuel(0);
      setPhase('question');
    }
  };

  const handleRestart = () => {
    setPlanetIndex(0);
    setQuestionIndex(0);
    setFuel(0);
    setPhase('question');
    setScore(0);
    setWrongGuesses(0);
    setFeedback('');
  };

  return (
    <div className="overlay">
      <div className="game-box">
        <button className="close-btn" onClick={onClose}>✕</button>

        <div className="stars">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="star" style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              fontSize: Math.random() > 0.5 ? '10px' : '6px',
            }}>⭐</div>
          ))}
        </div>

        <h2 className="title">🚀 Space Explorer</h2>
        <div className="progress-row">
          {planets.map((p, i) => (
            <div key={i} className={`planet-dot ${i < planetIndex ? 'visited' : ''} ${i === planetIndex ? 'current' : ''}`}>
              {i < planetIndex ? '✅' : i === planetIndex ? p.emoji : '⬜'}
            </div>
          ))}
        </div>
        <div className="score-row">Score: ⭐ {score} &nbsp;|&nbsp; Planet: {planetIndex + 1}/{totalPlanets}</div>

        {phase === 'question' && (
          <div className="question-area">
            <div className="planet-header" style={{ background: planet.color }}>
              <div className="planet-emoji">{planet.emoji}</div>
              <div className="planet-name">Heading to {planet.name}</div>
            </div>

            <div className="fuel-bar-wrap">
              <div className="fuel-label">⛽ Fuel: {fuel}%</div>
              <div className="fuel-track">
                <div className="fuel-fill" style={{ width: `${fuel}%`, background: fuel >= 75 ? '#4caf50' : fuel >= 40 ? '#ff9800' : '#f44336' }} />
              </div>
            </div>

            {feedback && <div className="feedback">{feedback}</div>}

            <div className="question-text">{question.text}</div>
            <div className="options-grid">
              {question.options.map(opt => (
                <button key={opt} className="option-btn" onClick={() => handleAnswer(opt)}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'landing' && (
          <div className="landing-area">
            <div className="landed-planet">{planet.emoji}</div>
            <h3 className="landed-title">🎉 Landed on {planet.name}!</h3>
            <div className="planet-fact">🌟 {planet.fact}</div>
            <button className="next-btn" onClick={handleNextPlanet}>
              {planetIndex + 1 >= totalPlanets ? '🏆 Finish Mission!' : `🚀 Next: ${planets[planetIndex + 1].name}`}
            </button>
          </div>
        )}

        {phase === 'complete' && (
          <div className="complete-area">
            <div className="trophy">🏆</div>
            <h3 className="complete-title">Mission Complete!</h3>
            <p className="complete-text">You explored all 8 planets!</p>
            <div className="final-score">⭐ Final Score: {score}</div>
            <div className="buttons-row">
              <button className="next-btn" onClick={handleRestart}>🔄 Play Again</button>
              <button className="close-main-btn" onClick={onClose}>🏠 Home</button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 20, 0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }

        .game-box {
          position: relative;
          background: linear-gradient(135deg, #0a0a2e 0%, #1a1a4e 100%);
          border-radius: 24px;
          padding: 28px 24px;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          color: white;
          box-shadow: 0 0 40px rgba(102, 126, 234, 0.4);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .stars {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          border-radius: 24px;
        }

        .star {
          position: absolute;
          animation: twinkle 2s ease-in-out infinite alternate;
        }

        @keyframes twinkle {
          from { opacity: 0.2; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1.2); }
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
          z-index: 10;
        }

        .close-btn:hover { background: rgba(255,255,255,0.25); }

        .title {
          text-align: center;
          font-size: 28px;
          margin: 0 0 16px;
          text-shadow: 0 0 20px rgba(102,126,234,0.8);
        }

        .progress-row {
          display: flex;
          justify-content: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .planet-dot {
          font-size: 18px;
          transition: transform 0.3s;
        }

        .planet-dot.current {
          transform: scale(1.4);
          filter: drop-shadow(0 0 6px gold);
        }

        .score-row {
          text-align: center;
          font-size: 14px;
          color: rgba(255,255,255,0.7);
          margin-bottom: 20px;
        }

        .planet-header {
          border-radius: 16px;
          padding: 16px;
          text-align: center;
          margin-bottom: 16px;
        }

        .planet-emoji {
          font-size: 48px;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .planet-name {
          font-size: 18px;
          font-weight: bold;
          color: white;
          margin-top: 8px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.5);
        }

        .fuel-bar-wrap { margin-bottom: 16px; }

        .fuel-label {
          font-size: 14px;
          margin-bottom: 6px;
          color: rgba(255,255,255,0.8);
        }

        .fuel-track {
          height: 16px;
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          overflow: hidden;
        }

        .fuel-fill {
          height: 100%;
          border-radius: 8px;
          transition: width 0.5s ease;
        }

        .feedback {
          text-align: center;
          font-size: 20px;
          font-weight: bold;
          padding: 10px;
          border-radius: 10px;
          margin-bottom: 12px;
          background: rgba(255,255,255,0.1);
          animation: popIn 0.2s ease;
        }

        @keyframes popIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .question-text {
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          margin-bottom: 16px;
          line-height: 1.4;
        }

        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .option-btn {
          padding: 14px 8px;
          font-size: 16px;
          font-weight: bold;
          background: rgba(255,255,255,0.12);
          color: white;
          border: 2px solid rgba(255,255,255,0.2);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .option-btn:hover {
          background: rgba(102, 126, 234, 0.5);
          border-color: rgba(102, 126, 234, 0.8);
          transform: translateY(-2px);
        }

        .option-btn:active { transform: translateY(0); }

        .landing-area {
          text-align: center;
          animation: fadeIn 0.4s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .landed-planet {
          font-size: 80px;
          animation: bounce 0.6s ease;
        }

        @keyframes bounce {
          0% { transform: translateY(-20px); }
          60% { transform: translateY(4px); }
          100% { transform: translateY(0); }
        }

        .landed-title {
          font-size: 24px;
          margin: 8px 0;
          color: gold;
        }

        .planet-fact {
          background: rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 16px;
          font-size: 16px;
          line-height: 1.5;
          margin: 16px 0;
          border-left: 4px solid gold;
        }

        .next-btn {
          padding: 16px 28px;
          font-size: 18px;
          font-weight: bold;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          transition: transform 0.15s;
          box-shadow: 0 4px 16px rgba(102,126,234,0.5);
          margin: 4px;
        }

        .next-btn:hover { transform: scale(1.04); }

        .complete-area {
          text-align: center;
          animation: fadeIn 0.4s ease;
        }

        .trophy { font-size: 80px; animation: bounce 0.6s ease; }

        .complete-title {
          font-size: 28px;
          color: gold;
          margin: 8px 0;
        }

        .complete-text {
          font-size: 18px;
          color: rgba(255,255,255,0.8);
          margin-bottom: 12px;
        }

        .final-score {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 20px;
          color: #ffd700;
        }

        .buttons-row {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .close-main-btn {
          padding: 16px 28px;
          font-size: 18px;
          font-weight: bold;
          background: rgba(255,255,255,0.15);
          color: white;
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 14px;
          cursor: pointer;
          transition: transform 0.15s;
          margin: 4px;
        }

        .close-main-btn:hover { transform: scale(1.04); background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
