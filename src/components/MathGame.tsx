import React, { useState, useEffect, useCallback } from 'react';
import VoiceButton from './VoiceButton';

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
  grade: '2nd' | '3rd';
  category: 'addition' | 'subtraction' | 'multiplication' | 'word-problems';
  emoji: string;
  funFact: string;
  hint?: string;
}

interface GameState {
  currentScreen: 'menu' | 'difficulty' | 'game' | 'complete' | 'streak-celebration';
  score: number;
  streak: number;
  totalQuestions: number;
  correctAnswers: number;
  currentQuestionIndex: number;
  currentQuestion: MathQuestion | null;
  selectedGrade: '2nd' | '3rd' | null;
  selectedCategory: string | null;
  showHint: boolean;
  feedback: { type: 'success' | 'error' | null; message: string } | null;
}

const MathGame: React.FC<MathGameProps> = ({ onComplete, onStickerEarned }) => {
  const [gameState, setGameState] = useState<GameState>({
    currentScreen: 'menu',
    score: 0,
    streak: 0,
    totalQuestions: 10,
    correctAnswers: 0,
    currentQuestionIndex: 0,
    currentQuestion: null,
    selectedGrade: null,
    selectedCategory: null,
    showHint: false,
    feedback: null,
  });

  const [userAnswer, setUserAnswer] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const categories = [
    { id: 'all', name: 'All Math', emoji: '🔢', description: 'Mix of all math problems!' },
    { id: 'addition', name: 'Addition', emoji: '➕', description: 'Adding numbers together!' },
    { id: 'subtraction', name: 'Subtraction', emoji: '➖', description: 'Taking numbers away!' },
    { id: 'multiplication', name: 'Multiplication', emoji: '✖️', description: 'Groups of numbers!' },
    { id: 'word-problems', name: 'Word Problems', emoji: '📖', description: 'Math in stories!' },
  ];

  const grades = [
    { id: '2nd', name: '2nd Grade', emoji: '📚', description: 'Ages 7-8' },
    { id: '3rd', name: '3rd Grade', emoji: '🎓', description: 'Ages 8-9' },
  ];

  const generateMathQuestions = (): MathQuestion[] => {
    const questions: MathQuestion[] = [];

    // 2nd Grade Questions
    const secondGradeQuestions: MathQuestion[] = [
      // Addition (sums up to 20)
      { id: 'add2_1', question: '7 + 5 = ?', answer: 12, options: [10, 12, 14, 15], difficulty: 'easy', grade: '2nd', category: 'addition', emoji: '➕', funFact: 'Adding is like putting things together!', hint: 'Use your fingers to count: 7, 8, 9, 10, 11, 12' },
      { id: 'add2_2', question: '9 + 8 = ?', answer: 17, options: [15, 16, 17, 18], difficulty: 'easy', grade: '2nd', category: 'addition', emoji: '➕', funFact: 'When you add 9, think 10 then take away 1!' },
      { id: 'add2_3', question: '6 + 7 = ?', answer: 13, options: [11, 12, 13, 14], difficulty: 'easy', grade: '2nd', category: 'addition', emoji: '➕', funFact: '6 + 7 is the same as 6 + 6 + 1 = 13!' },

      // Subtraction (within 20)
      { id: 'sub2_1', question: '15 - 8 = ?', answer: 7, options: [5, 6, 7, 8], difficulty: 'easy', grade: '2nd', category: 'subtraction', emoji: '➖', funFact: 'Subtracting is like taking things away!', hint: 'Count back from 15: 14, 13, 12, 11, 10, 9, 8, 7' },
      { id: 'sub2_2', question: '12 - 9 = ?', answer: 3, options: [2, 3, 4, 5], difficulty: 'easy', grade: '2nd', category: 'subtraction', emoji: '➖', funFact: '12 - 9 is the same as 12 - 10 + 1 = 3!' },

      // Word Problems
      { id: 'word2_1', question: 'Emma has 8 apples. She gives 3 to friends. How many left?', answer: 5, options: [4, 5, 6, 7], difficulty: 'medium', grade: '2nd', category: 'word-problems', emoji: '🍎', funFact: 'Word problems help us use math in real life!', hint: 'This is a subtraction problem: 8 - 3 = ?' },
      { id: 'word2_2', question: 'There are 6 red birds and 7 blue birds. How many total?', answer: 13, options: [11, 12, 13, 14], difficulty: 'medium', grade: '2nd', category: 'word-problems', emoji: '🐦', funFact: 'The word "total" usually means we need to add!' },
    ];

    // 3rd Grade Questions
    const thirdGradeQuestions: MathQuestion[] = [
      // Addition (2-3 digits)
      { id: 'add3_1', question: '25 + 17 = ?', answer: 42, options: [40, 41, 42, 43], difficulty: 'medium', grade: '3rd', category: 'addition', emoji: '➕', funFact: 'Add the ones first, then the tens!', hint: '20 + 10 = 30, 5 + 7 = 12, so 30 + 12 = 42' },
      { id: 'add3_2', question: '34 + 28 = ?', answer: 62, options: [60, 61, 62, 63], difficulty: 'medium', grade: '3rd', category: 'addition', emoji: '➕', funFact: 'Sometimes we need to "carry over" to the next column!' },

      // Subtraction (2-3 digits)
      { id: 'sub3_1', question: '45 - 18 = ?', answer: 27, options: [25, 26, 27, 28], difficulty: 'medium', grade: '3rd', category: 'subtraction', emoji: '➖', funFact: 'Sometimes we need to "borrow" from the next column!', hint: '45 - 10 = 35, then 35 - 8 = 27' },

      // Multiplication (basic facts)
      { id: 'mul3_1', question: '6 × 7 = ?', answer: 42, options: [35, 40, 42, 48], difficulty: 'medium', grade: '3rd', category: 'multiplication', emoji: '✖️', funFact: '6 × 7 is the same as 6 groups of 7!', hint: 'Count by 6s: 6, 12, 18, 24, 30, 36, 42' },
      { id: 'mul3_2', question: '8 × 4 = ?', answer: 32, options: [28, 30, 32, 36], difficulty: 'easy', grade: '3rd', category: 'multiplication', emoji: '✖️', funFact: '8 × 4 is the same as 4 × 8!' },
      { id: 'mul3_3', question: '7 × 9 = ?', answer: 63, options: [56, 61, 63, 72], difficulty: 'hard', grade: '3rd', category: 'multiplication', emoji: '✖️', funFact: '7 × 10 = 70, so 7 × 9 = 70 - 7 = 63!' },

      // Word Problems
      { id: 'word3_1', question: 'Tom has 4 bags with 6 apples each. How many apples?', answer: 24, options: [20, 22, 24, 26], difficulty: 'hard', grade: '3rd', category: 'word-problems', emoji: '🍎', funFact: 'When you see "groups of" or "each", think multiplication!', hint: '4 groups of 6 apples = 4 × 6 = ?' },
      { id: 'word3_2', question: 'A book has 15 pages. Sarah read 8 pages. How many left?', answer: 7, options: [5, 6, 7, 8], difficulty: 'medium', grade: '3rd', category: 'word-problems', emoji: '📚', funFact: 'How many left usually means subtraction!' },
      { id: 'word3_3', question: 'Jay has 24 stickers. He gives 6 to each friend. How many friends?', answer: 4, options: [3, 4, 5, 6], difficulty: 'hard', grade: '3rd', category: 'word-problems', emoji: '⭐', funFact: 'This is division: 24 ÷ 6 = 4!' },
    ];

    return [...secondGradeQuestions, ...thirdGradeQuestions];
  };

  const [allQuestions] = useState<MathQuestion[]>(generateMathQuestions());

  const getFilteredQuestions = useCallback(() => {
    let filtered = allQuestions;

    if (gameState.selectedGrade) {
      filtered = filtered.filter(q => q.grade === gameState.selectedGrade);
    }

    if (gameState.selectedCategory && gameState.selectedCategory !== 'all') {
      filtered = filtered.filter(q => q.category === gameState.selectedCategory);
    }

    // Shuffle questions
    return filtered.sort(() => Math.random() - 0.5);
  }, [allQuestions, gameState.selectedGrade, gameState.selectedCategory]);

  const startGame = useCallback((grade: '2nd' | '3rd', category: string = 'all') => {
    const filteredQuestions = getFilteredQuestions();
    const selectedQuestions = filteredQuestions.slice(0, gameState.totalQuestions);

    setGameState(prev => ({
      ...prev,
      currentScreen: 'game',
      selectedGrade: grade,
      selectedCategory: category,
      currentQuestion: selectedQuestions[0],
      currentQuestionIndex: 0,
      score: 0,
      streak: 0,
      correctAnswers: 0,
      showHint: false,
      feedback: null,
    }));

    setUserAnswer('');
  }, [getFilteredQuestions, gameState.totalQuestions]);

  const checkAnswer = useCallback((answer: number) => {
    if (!gameState.currentQuestion || isProcessing) return;

    setIsProcessing(true);
    const isCorrect = answer === gameState.currentQuestion.answer;

    setGameState(prev => {
      const newState = { ...prev };

      if (isCorrect) {
        newState.score += 10 + (prev.streak * 2); // Bonus points for streaks
        newState.streak += 1;
        newState.correctAnswers += 1;
        newState.feedback = { type: 'success', message: 'Correct! Great job! 🎉' };

        // Earn stickers for milestones
        if (prev.correctAnswers === 2 && onStickerEarned) {
          onStickerEarned('diamond_1'); // Math Genius sticker
        }
        if (prev.streak === 4 && onStickerEarned) {
          onStickerEarned('crown_1'); // Question Master sticker
        }
      } else {
        newState.streak = 0;
        newState.feedback = { type: 'error', message: `Not quite. The answer is ${gameState.currentQuestion?.answer}` };
      }

      return newState;
    });

    // Clear feedback and move to next question after delay
    setTimeout(() => {
      setGameState(prev => {
        const nextIndex = prev.currentQuestionIndex + 1;
        const filteredQuestions = getFilteredQuestions();
        const selectedQuestions = filteredQuestions.slice(0, gameState.totalQuestions);

        if (nextIndex >= selectedQuestions.length) {
          // Game complete
          if (prev.correctAnswers >= 8 && onStickerEarned) {
            onStickerEarned('trophy_1'); // Champion sticker for high score
          }
          return {
            ...prev,
            currentScreen: 'complete',
            feedback: null,
          };
        }

        return {
          ...prev,
          currentQuestionIndex: nextIndex,
          currentQuestion: selectedQuestions[nextIndex],
          showHint: false,
          feedback: null,
        };
      });

      setUserAnswer('');
      setIsProcessing(false);
    }, 2000);
  }, [gameState.currentQuestion, gameState.currentQuestionIndex, gameState.totalQuestions, isProcessing, getFilteredQuestions, onStickerEarned]);

  const toggleHint = useCallback(() => {
    setGameState(prev => ({ ...prev, showHint: !prev.showHint }));
  }, []);

  const getGradeEmoji = (grade: string) => {
    return grade === '2nd' ? '📚' : '🎓';
  };

  const getCategoryEmoji = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'addition': '➕',
      'subtraction': '➖',
      'multiplication': '✖️',
      'word-problems': '📖',
    };
    return categoryMap[category] || '🔢';
  };

  const renderMenu = () => (
    <div className="math-menu">
      <div className="menu-header">
        <h2>🧮 Math Adventure!</h2>
        <p>Solve math problems and earn stickers!</p>
      </div>

      <div className="grade-selection">
        <h3>Choose Your Grade</h3>
        <div className="grade-buttons">
          {grades.map(grade => (
            <button
              key={grade.id}
              className="grade-button"
              onClick={() => setGameState(prev => ({ ...prev, currentScreen: 'difficulty', selectedGrade: grade.id as '2nd' | '3rd' }))}
            >
              <span className="grade-emoji">{grade.emoji}</span>
              <span className="grade-name">{grade.name}</span>
              <span className="grade-description">{grade.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDifficultySelection = () => (
    <div className="difficulty-selection">
      <div className="selection-header">
        <h2>{getGradeEmoji(gameState.selectedGrade!)} {gameState.selectedGrade} Grade Math</h2>
        <p>What type of math problems?</p>
      </div>

      <div className="category-buttons">
        {categories.map(category => (
          <button
            key={category.id}
            className="category-button"
            onClick={() => startGame(gameState.selectedGrade!, category.id)}
          >
            <span className="category-emoji">{category.emoji}</span>
            <span className="category-name">{category.name}</span>
            <span className="category-description">{category.description}</span>
          </button>
        ))}
      </div>

      <button
        className="back-button"
        onClick={() => setGameState(prev => ({ ...prev, currentScreen: 'menu' }))}
      >
        ← Back
      </button>
    </div>
  );

  const renderGame = () => {
    if (!gameState.currentQuestion) return null;

    const progress = ((gameState.currentQuestionIndex + 1) / gameState.totalQuestions) * 100;

    return (
      <div className="math-game">
        <div className="game-header">
          <div className="game-info">
            <div className="grade-category">
              <span>{getGradeEmoji(gameState.selectedGrade!)} {gameState.selectedGrade}</span>
              <span>{getCategoryEmoji(gameState.currentQuestion.category)}</span>
            </div>
            <div className="score-info">
              <span>Score: {gameState.score}</span>
              <span>Streak: 🔥{gameState.streak}</span>
            </div>
          </div>
          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{gameState.currentQuestionIndex + 1} / {gameState.totalQuestions}</span>
          </div>
        </div>

        <div className="question-section">
          <div className="question-emoji">{gameState.currentQuestion.emoji}</div>
          <div className="question-text">{gameState.currentQuestion.question}</div>
          <div className="difficulty-badge">
            {gameState.currentQuestion.difficulty} • {gameState.currentQuestion.category}
          </div>
        </div>

        {gameState.showHint && gameState.currentQuestion.hint && (
          <div className="hint-section">
            <div className="hint-text">💡 Hint: {gameState.currentQuestion.hint}</div>
          </div>
        )}

        {gameState.feedback && (
          <div className={`feedback-message ${gameState.feedback.type}`}>
            {gameState.feedback.message}
          </div>
        )}

        <div className="options-grid">
          {gameState.currentQuestion.options.map((option, index) => (
            <button
              key={index}
              className="option-button"
              onClick={() => checkAnswer(option)}
              disabled={isProcessing}
            >
              <span className="option-emoji">{String.fromCharCode(65 + index)}</span>
              <span className="option-text">{option}</span>
            </button>
          ))}
        </div>

        <div className="game-controls">
          <button
            className="hint-button"
            onClick={toggleHint}
            disabled={isProcessing}
          >
            💡 Hint
          </button>

          <button
            className="skip-button"
            onClick={() => checkAnswer(-1)} // Wrong answer to skip
            disabled={isProcessing}
          >
            ⏭️ Skip
          </button>
        </div>

        <div className="fun-fact">
          <p>🧠 {gameState.currentQuestion.funFact}</p>
        </div>
      </div>
    );
  };

  const renderComplete = () => {
    const percentage = Math.round((gameState.correctAnswers / gameState.totalQuestions) * 100);
    let performance = '';

    if (percentage >= 90) performance = 'Amazing! 🌟';
    else if (percentage >= 80) performance = 'Great Job! 🎉';
    else if (percentage >= 70) performance = 'Good Work! 👍';
    else performance = 'Keep Practicing! 💪';

    return (
      <div className="math-complete">
        <div className="complete-content">
          <h2>🎊 Math Adventure Complete!</h2>
          <div className="performance-text">{performance}</div>

          <div className="score-display">
            <div className="score-number">{gameState.score}</div>
            <div className="score-label">Total Score</div>
          </div>

          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number">{gameState.correctAnswers}/{gameState.totalQuestions}</div>
              <div className="stat-label">Correct</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{percentage}%</div>
              <div className="stat-label">Accuracy</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">🔥{Math.max(...Array.from({length: gameState.totalQuestions + 1}, (_, i) => i))}</div>
              <div className="stat-label">Best Streak</div>
            </div>
          </div>

          <div className="complete-buttons">
            <button
              className="play-again-button"
              onClick={() => startGame(gameState.selectedGrade!, gameState.selectedCategory!)}
            >
              🔄 Play Again
            </button>
            <button
              className="new-game-button"
              onClick={() => setGameState(prev => ({ ...prev, currentScreen: 'menu' }))}
            >
              📊 New Game
            </button>
            <button
              className="exit-button"
              onClick={onComplete}
            >
              ← Back to Games
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="math-game-container">
      {gameState.currentScreen === 'menu' && renderMenu()}
      {gameState.currentScreen === 'difficulty' && renderDifficultySelection()}
      {gameState.currentScreen === 'game' && renderGame()}
      {gameState.currentScreen === 'complete' && renderComplete()}
    </div>
  );
};

export default MathGame;