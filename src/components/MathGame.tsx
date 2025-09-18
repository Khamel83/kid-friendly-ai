import React, { useState, useEffect } from 'react';

interface MathGameProps {
  onComplete: () => void;
  onStickerEarned?: (stickerId: string) => void;
}

interface MathQuestion {
  id: string;
  question: string;
  answer: number;
  options: number[];
  difficulty: 'easy' | 'medium' | 'hard';
  emoji: string;
  funFact: string;
}

const mathQuestions: MathQuestion[] = [
  // Addition
  { id: 'add1', question: '7 + 5 = ?', answer: 12, options: [10, 12, 14, 15], difficulty: 'easy', emoji: '➕', funFact: 'Adding is like putting things together!' },
  { id: 'add2', question: '9 + 8 = ?', answer: 17, options: [15, 16, 17, 18], difficulty: 'easy', emoji: '➕', funFact: 'When you add 9, think 10 then take away 1!' },
  { id: 'add3', question: '25 + 17 = ?', answer: 42, options: [40, 41, 42, 43], difficulty: 'medium', emoji: '➕', funFact: 'Add the ones first, then the tens!' },

  // Subtraction
  { id: 'sub1', question: '15 - 8 = ?', answer: 7, options: [5, 6, 7, 8], difficulty: 'easy', emoji: '➖', funFact: 'Subtracting is like taking things away!' },
  { id: 'sub2', question: '12 - 9 = ?', answer: 3, options: [2, 3, 4, 5], difficulty: 'easy', emoji: '➖', funFact: '12 - 9 is the same as 12 - 10 + 1 = 3!' },
  { id: 'sub3', question: '45 - 18 = ?', answer: 27, options: [25, 26, 27, 28], difficulty: 'medium', emoji: '➖', funFact: 'Sometimes we need to \"borrow\" from the next column!' },

  // Multiplication
  { id: 'mul1', question: '6 × 7 = ?', answer: 42, options: [35, 40, 42, 48], difficulty: 'medium', emoji: '✖️', funFact: '6 × 7 is the same as 6 groups of 7!' },
  { id: 'mul2', question: '8 × 4 = ?', answer: 32, options: [28, 30, 32, 36], difficulty: 'easy', emoji: '✖️', funFact: '8 × 4 is the same as 4 × 8!' },
  { id: 'mul3', question: '7 × 9 = ?', answer: 63, options: [56, 61, 63, 72], difficulty: 'hard', emoji: '✖️', funFact: '7 × 10 = 70, so 7 × 9 = 70 - 7 = 63!' },

  // Word Problems
  { id: 'word1', question: 'Emma has 8 apples. She gives 3 to friends. How many left?', answer: 5, options: [4, 5, 6, 7], difficulty: 'medium', emoji: '🍎', funFact: 'Word problems help us use math in real life!' },
  { id: 'word2', question: 'There are 6 red birds and 7 blue birds. How many total?', answer: 13, options: [11, 12, 13, 14], difficulty: 'medium', emoji: '🐦', funFact: 'The word \"total\" usually means we need to add!' },
];

export default function MathGame({ onComplete, onStickerEarned }: MathGameProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [streak, setStreak] = useState(0);

  // Shuffle questions and get current one
  const [shuffledQuestions, setShuffledQuestions] = useState<MathQuestion[]>([]);

  useEffect(() => {
    resetGame();
  }, []);

  const resetGame = () => {
    const shuffled = [...mathQuestions].sort(() => Math.random() - 0.5);
    setShuffledQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setStreak(0);
  };

  const currentQuestion = shuffledQuestions[currentQuestionIndex];

  const handleAnswer = (answer: number) => {
    setSelectedAnswer(answer);
    setShowFeedback(true);

    const correct = answer === currentQuestion.answer;
    setIsCorrect(correct);

    if (correct) {
      setScore(prev => prev + 10);
      setStreak(prev => prev + 1);

      // Award sticker for streak of 5
      if (streak + 1 >= 5 && onStickerEarned) {
        onStickerEarned('math-streak-master');
      }
    } else {
      setStreak(0);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      // Game completed
      if (onStickerEarned && score > 50) {
        onStickerEarned('math-champion');
      }
      resetGame();
    }
  };

  const closeGame = () => {
    onComplete();
  };

  if (!currentQuestion) return null;

  return (
    <div className="math-game">
      <div className="game-header">
        <h3>🧮 Math Game 🧮</h3>
        <div className="score-info">
          <div className="score">Score: {score}</div>
          {streak > 0 && <div className="streak">🔥 Streak: {streak}</div>}
        </div>
        <button onClick={closeGame} className="back-button">
          ← Back to Buddy
        </button>
      </div>

      <div className="game-content">
        {!showFeedback ? (
          <div className="question-section">
            <div className="question-header">
              <span className="question-emoji">{currentQuestion.emoji}</span>
              <div className="difficulty-badge">
                {currentQuestion.difficulty === 'easy' ? 'Easy' :
                 currentQuestion.difficulty === 'medium' ? 'Medium' : 'Hard'}
              </div>
            </div>

            <div className="question-text">
              <h4>{currentQuestion.question}</h4>
            </div>

            <div className="answer-options">
              <div className="options-grid">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(option)}
                    disabled={showFeedback}
                    className={`option-button ${selectedAnswer === option ? 'selected' : ''}`}
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

            {isCorrect && (
              <div className="fun-fact">
                <p>💡 {currentQuestion.funFact}</p>
              </div>
            )}

            <div className="feedback-message">
              {!isCorrect && (
                <p>The correct answer was: <strong>{currentQuestion.answer}</strong></p>
              )}
            </div>

            <div className="feedback-controls">
              <button onClick={nextQuestion} className="next-button">
                {currentQuestionIndex < shuffledQuestions.length - 1 ? 'Next Question →' : 'Play Again 🔄'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}