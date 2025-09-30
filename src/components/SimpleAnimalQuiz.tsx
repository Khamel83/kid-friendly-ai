import { useState, useEffect } from 'react';

interface Animal {
  name: string;
  emoji: string;
  fact: string;
  sound: string;
  habitat: string;
}

const animals: Animal[] = [
  { name: 'Lion', emoji: '🦁', fact: 'Lions are the only cats that live in groups called prides!', sound: 'roar', habitat: 'Africa' },
  { name: 'Elephant', emoji: '🐘', fact: 'Elephants are the largest land animals and can weigh up to 6 tons!', sound: 'trumpet', habitat: 'Africa and Asia' },
  { name: 'Penguin', emoji: '🐧', fact: 'Penguins can\'t fly but they\'re amazing swimmers!', sound: 'squawk', habitat: 'Antarctica' },
  { name: 'Dolphin', emoji: '🐬', fact: 'Dolphins are super smart and love to play!', sound: 'click', habitat: 'Ocean' },
  { name: 'Giraffe', emoji: '🦒', fact: 'Giraffes are the tallest animals in the world!', sound: 'hum', habitat: 'Africa' },
  { name: 'Tiger', emoji: '🐯', fact: 'Tigers are the biggest cats and great swimmers!', sound: 'roar', habitat: 'Asia' },
  { name: 'Monkey', emoji: '🐵', fact: 'Monkeys are very clever and love to swing in trees!', sound: 'chatter', habitat: 'Jungle' },
  { name: 'Panda', emoji: '🐼', fact: 'Pandas eat bamboo for up to 14 hours a day!', sound: 'bleat', habitat: 'China' },
];

interface SimpleAnimalQuizProps {
  onClose: () => void;
}

export default function SimpleAnimalQuiz({ onClose }: SimpleAnimalQuizProps) {
  const [currentAnimal, setCurrentAnimal] = useState<Animal | null>(null);
  const [options, setOptions] = useState<Animal[]>([]);
  const [score, setScore] = useState(0);
  const [showFact, setShowFact] = useState(false);
  const [feedback, setFeedback] = useState('');

  const generateQuestion = () => {
    const correct = animals[Math.floor(Math.random() * animals.length)];
    const incorrectOptions = animals
      .filter(a => a.name !== correct.name)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);

    const allOptions = [correct, ...incorrectOptions].sort(() => Math.random() - 0.5);

    setCurrentAnimal(correct);
    setOptions(allOptions);
    setShowFact(false);
    setFeedback('');
  };

  useEffect(() => {
    generateQuestion();
  }, []);

  const handleAnswer = (selected: Animal) => {
    if (!currentAnimal) return;

    if (selected.name === currentAnimal.name) {
      setFeedback('🎉 Perfect! You got it right!');
      setScore(score + 1);
      setShowFact(true);
    } else {
      setFeedback(`Not quite! It's a ${currentAnimal.name}! ${currentAnimal.emoji}`);
      setShowFact(true);
    }
  };

  if (!currentAnimal) return null;

  return (
    <div className="game-overlay">
      <div className="game-modal">
        <button className="game-close" onClick={onClose}>✕</button>

        <h2 className="game-title">🦁 Animal Quiz</h2>
        <div className="game-score">Score: {score}</div>

        {!showFact ? (
          <>
            <div className="animal-hint">
              <div className="hint-text">What animal is this?</div>
              <div className="animal-emoji">{currentAnimal.emoji}</div>
              <div className="hint-clue">Lives in: {currentAnimal.habitat}</div>
              <div className="hint-clue">Says: {currentAnimal.sound}</div>
            </div>

            <div className="animal-options">
              {options.map((animal) => (
                <button
                  key={animal.name}
                  className="animal-option"
                  onClick={() => handleAnswer(animal)}
                >
                  {animal.name}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className={`animal-feedback ${feedback.includes('Perfect') ? 'correct' : 'incorrect'}`}>
              {feedback}
            </div>

            <div className="animal-fact">
              <div className="fact-title">Fun Fact!</div>
              <div className="fact-text">{currentAnimal.fact}</div>
            </div>

            <div className="game-buttons">
              <button className="game-button primary" onClick={generateQuestion}>
                Next Animal ➡️
              </button>
            </div>
          </>
        )}
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

        .animal-hint {
          text-align: center;
          margin: 32px 0;
        }

        .hint-text {
          font-size: 24px;
          font-weight: bold;
          color: #2c3e50;
          margin-bottom: 16px;
        }

        .animal-emoji {
          font-size: 120px;
          margin: 20px 0;
        }

        .hint-clue {
          font-size: 18px;
          color: #7f8c8d;
          margin: 8px 0;
        }

        .animal-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .animal-option {
          padding: 20px;
          font-size: 22px;
          font-weight: bold;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .animal-option:hover {
          transform: scale(1.05);
        }

        .animal-feedback {
          text-align: center;
          font-size: 24px;
          font-weight: bold;
          margin: 24px 0;
          padding: 20px;
          border-radius: 12px;
        }

        .animal-feedback.correct {
          background: #d4edda;
          color: #155724;
        }

        .animal-feedback.incorrect {
          background: #fff3cd;
          color: #856404;
        }

        .animal-fact {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          padding: 24px;
          border-radius: 16px;
          color: white;
          margin: 24px 0;
        }

        .fact-title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 12px;
        }

        .fact-text {
          font-size: 18px;
          line-height: 1.5;
        }

        .game-buttons {
          display: flex;
          justify-content: center;
          margin-top: 24px;
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

          .animal-emoji {
            font-size: 80px;
          }

          .hint-text {
            font-size: 20px;
          }

          .animal-option {
            font-size: 18px;
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}
