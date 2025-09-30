import { useState, useEffect } from 'react';

interface SimpleMathGameProps {
  onClose: () => void;
}

export default function SimpleMathGame({ onClose }: SimpleMathGameProps) {
  const [problem, setProblem] = useState({ num1: 0, num2: 0, operator: '+', answer: 0 });
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showNext, setShowNext] = useState(false);

  const generateProblem = () => {
    const operators = ['+', '-'];
    const operator = operators[Math.floor(Math.random() * operators.length)];

    let num1, num2, answer;

    if (operator === '+') {
      num1 = Math.floor(Math.random() * 20) + 1;
      num2 = Math.floor(Math.random() * 20) + 1;
      answer = num1 + num2;
    } else {
      num1 = Math.floor(Math.random() * 20) + 10;
      num2 = Math.floor(Math.random() * num1) + 1;
      answer = num1 - num2;
    }

    setProblem({ num1, num2, operator, answer });
    setUserAnswer('');
    setFeedback('');
    setShowNext(false);
  };

  useEffect(() => {
    generateProblem();
  }, []);

  const checkAnswer = () => {
    const answer = parseInt(userAnswer);
    if (isNaN(answer)) {
      setFeedback('Please type a number!');
      return;
    }

    if (answer === problem.answer) {
      setFeedback('🎉 Awesome! You got it!');
      setScore(score + 1);
      setShowNext(true);
    } else {
      setFeedback(`Not quite! Try again! 💪`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showNext) {
        generateProblem();
      } else {
        checkAnswer();
      }
    }
  };

  return (
    <div className="game-overlay">
      <div className="game-modal">
        <button className="game-close" onClick={onClose}>✕</button>

        <h2 className="game-title">🧮 Math Practice</h2>
        <div className="game-score">Score: {score}</div>

        <div className="math-problem">
          <div className="math-equation">
            <span className="math-number">{problem.num1}</span>
            <span className="math-operator">{problem.operator}</span>
            <span className="math-number">{problem.num2}</span>
            <span className="math-equals">=</span>
            <input
              type="number"
              className="math-input"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="?"
              autoFocus
            />
          </div>
        </div>

        {feedback && (
          <div className={`math-feedback ${feedback.includes('Awesome') ? 'correct' : 'incorrect'}`}>
            {feedback}
          </div>
        )}

        <div className="game-buttons">
          {showNext ? (
            <button className="game-button primary" onClick={generateProblem}>
              Next Problem ➡️
            </button>
          ) : (
            <button className="game-button primary" onClick={checkAnswer}>
              Check Answer ✓
            </button>
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
          max-width: 500px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          position: relative;
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
          display: flex;
          align-items: center;
          justify-content: center;
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

        .math-problem {
          margin: 40px 0;
        }

        .math-equation {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          font-size: 48px;
          font-weight: bold;
        }

        .math-number {
          color: #3498db;
        }

        .math-operator {
          color: #e74c3c;
          font-size: 56px;
        }

        .math-equals {
          color: #95a5a6;
        }

        .math-input {
          width: 120px;
          height: 80px;
          font-size: 48px;
          text-align: center;
          border: 4px solid #3498db;
          border-radius: 12px;
          padding: 8px;
          font-weight: bold;
        }

        .math-input:focus {
          outline: none;
          border-color: #2980b9;
          box-shadow: 0 0 0 4px rgba(52, 152, 219, 0.2);
        }

        .math-feedback {
          text-align: center;
          font-size: 24px;
          font-weight: bold;
          margin: 24px 0;
          padding: 16px;
          border-radius: 12px;
        }

        .math-feedback.correct {
          background: #d4edda;
          color: #155724;
        }

        .math-feedback.incorrect {
          background: #fff3cd;
          color: #856404;
        }

        .game-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .game-button {
          padding: 16px 32px;
          font-size: 20px;
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

        @media (max-width: 600px) {
          .game-modal {
            padding: 24px;
          }

          .math-equation {
            font-size: 36px;
            gap: 12px;
          }

          .math-input {
            width: 100px;
            height: 60px;
            font-size: 36px;
          }

          .math-operator {
            font-size: 42px;
          }
        }
      `}</style>
    </div>
  );
}
