import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Animal, AnimalQuestion, AnimalGameState, AnimalGameConfig } from '../types/animalGame';
import { AnimalDatabase } from '../utils/animalDatabase';
import { AnimalQuestionGenerator } from '../utils/animalQuestionGenerator';
import { SoundManager } from '../utils/soundEffects';
import { AccessibilityUtils } from '../utils/accessibility';

interface AnimalGameProps {
  isOpen: boolean;
  onClose: () => void;
  onStickerEarned?: (stickerId: string) => void;
}

const AnimalGame: React.FC<AnimalGameProps> = ({ isOpen, onClose, onStickerEarned }) => {
  const [gameState, setGameState] = useState<AnimalGameState>({
    currentQuestion: null,
    gameState: 'menu',
    score: 0,
    level: 1,
    streak: 0,
    hints: 3,
    animalsDiscovered: [],
    achievements: [],
    timeRemaining: undefined,
    userProgress: []
  });

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentAnimal, setCurrentAnimal] = useState<Animal | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [multimediaEnabled, setMultimediaEnabled] = useState(true);
  const [learningMode, setLearningMode] = useState(false);

  const config: AnimalGameConfig = {
    maxHints: 3,
    timePerQuestion: 60,
    scoreMultiplier: 10,
    adaptiveDifficulty: true,
    soundEnabled: true,
    multimediaEnabled: true,
    educationalMode: true
  };

  const animalDatabase = AnimalDatabase.getInstance();
  const questionGenerator = AnimalQuestionGenerator.getInstance();
  const soundManager = SoundManager.getInstance();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to get emoji for animal names
  const getAnimalEmoji = (animalName: string): string => {
    const emojiMap: { [key: string]: string } = {
      'Lion': '🦁',
      'African Elephant': '🐘',
      'Bottlenose Dolphin': '🐬',
      'Emperor Penguin': '🐧',
      'Giraffe': '🦒',
      'Giant Panda': '🐼',
      'Koala': '🐨',
      'Cheetah': '🐆',
      'Great Horned Owl': '🦉',
      'Sea Turtle': '🐢',
      'Red Fox': '🦊',
      'Zebra': '🦓',
      'Red Kangaroo': '🦘',
      'Raccoon': '🦝',
      'Bald Eagle': '🦅',
      'Poison Dart Frog': '🐸',
      'Giant Pacific Octopus': '🐙',
      'Polar Bear': '🐻‍❄️',
      'Gray Wolf': '🐺',
      'Hippopotamus': '🦛',
      'American Flamingo': '🦩',
      'Indian Peafowl': '🦚',
      'Bengal Tiger': '🐅',
      'Capuchin Monkey': '🐵',
      'King Cobra': '🐍',
      'Fruit Bat': '🦇',
      'Three-toed Sloth': '🦥',
      'Nine-banded Armadillo': '🦦',
      'Narwhal': '🦄',
      'Honey Bee': '🐝'
    };
    return emojiMap[animalName] || '🐾';
  };

  useEffect(() => {
    if (isOpen) {
      resetGame();
    }
  }, [isOpen]);

  useEffect(() => {
    if (gameState.timeRemaining && gameState.timeRemaining > 0 && gameState.gameState === 'playing') {
      timerRef.current = setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining! - 1
        }));
      }, 1000);
    } else if (gameState.timeRemaining === 0) {
      endGame(false);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gameState.timeRemaining, gameState.gameState]);

  const startGame = useCallback((gameType: 'quiz' | 'learning' = 'quiz') => {
    setLearningMode(gameType === 'learning');

    if (gameType === 'learning') {
      // Show animal selection screen instead of random animal
      setGameState(prev => ({
        ...prev,
        gameState: 'animal-selection'
      }));
    } else {
      generateNewQuestion();
      setGameState(prev => ({
        ...prev,
        gameState: 'playing',
        timeRemaining: config.timePerQuestion
      }));
    }

    if (soundEnabled) {
      soundManager.play('start');
    }
  }, [animalDatabase, soundManager, soundEnabled, config.timePerQuestion]);

  const resetGame = useCallback(() => {
    setGameState({
      currentQuestion: null,
      gameState: 'menu',
      score: 0,
      level: 1,
      streak: 0,
      hints: config.maxHints,
      animalsDiscovered: [],
      achievements: [],
      timeRemaining: undefined,
      userProgress: []
    });
    setSelectedAnswer(null);
    setShowHint(false);
    setShowExplanation(false);
    setCurrentAnimal(null);
  }, [config.maxHints]);

  const generateNewQuestion = useCallback(() => {
    try {
      const difficulty = gameState.level <= 3 ? 'easy' :
                        gameState.level <= 6 ? 'medium' :
                        gameState.level <= 9 ? 'hard' : 'expert';

      const questionTypes: AnimalQuestion['type'][] = ['identification', 'habitat', 'diet', 'behavior', 'adaptation', 'conservation', 'fun-fact'];
      const randomType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

      const availableAnimals = animalDatabase.getAllAnimals();
      const randomAnimal = availableAnimals[Math.floor(Math.random() * availableAnimals.length)];

      console.log('Generating question for:', randomAnimal.name, randomType, difficulty);

      // Simple fallback question generation if the complex one fails
      let question;
      try {
        question = questionGenerator.generateQuestion(randomAnimal, randomType, difficulty);
      } catch (error) {
        console.warn('Question generator failed, using fallback:', error);
        // Create a simple identification question as fallback
        question = {
          id: `fallback-${randomAnimal.id}-${Date.now()}`,
          type: 'identification',
          difficulty: 'easy',
          question: `What animal is this?`,
          options: [randomAnimal.name, 'Lion', 'Elephant', 'Tiger'].sort(() => Math.random() - 0.5),
          correctAnswer: randomAnimal.name,
          explanation: `This is a ${randomAnimal.name}!`,
          animal: randomAnimal
        };
      }

      setGameState(prev => ({
        ...prev,
        currentQuestion: question,
        timeRemaining: config.timePerQuestion,
        hints: Math.min(prev.hints + 1, config.maxHints)
      }));

      setSelectedAnswer(null);
      setShowHint(false);
      setShowExplanation(false);

      // Add to discovered animals if new
      if (!gameState.animalsDiscovered.includes(randomAnimal.id)) {
        setGameState(prev => ({
          ...prev,
          animalsDiscovered: [...prev.animalsDiscovered, randomAnimal.id]
        }));
      }
    } catch (error) {
      console.error('Failed to generate question:', error);
      // Show error message to user
      setErrorMessage('Could not generate question. Please try again.');
      setGameState(prev => ({ ...prev, gameState: 'menu' }));
    }
  }, [gameState.level, gameState.animalsDiscovered, animalDatabase, questionGenerator, config]);

  const submitAnswer = useCallback((answer: string) => {
    if (!gameState.currentQuestion || gameState.gameState !== 'playing') return;

    setSelectedAnswer(answer);
    const isCorrect = answer === gameState.currentQuestion.correctAnswer;

    setGameState(prev => ({
      ...prev,
      userProgress: [...prev.userProgress, {
        questionId: prev.currentQuestion!.id,
        correct: isCorrect,
        timeTaken: config.timePerQuestion - prev.timeRemaining!,
        hintsUsed: config.maxHints - prev.hints
      }]
    }));

    if (isCorrect) {
      handleCorrectAnswer();
    } else {
      handleIncorrectAnswer();
    }
  }, [gameState.currentQuestion, gameState.gameState, config]);

  const handleCorrectAnswer = useCallback(() => {
    const baseScore = 100;
    const streakBonus = gameState.streak * 10;
    const timeBonus = gameState.timeRemaining! * 2;
    const totalScore = baseScore + streakBonus + timeBonus;

    setGameState(prev => ({
      ...prev,
      score: prev.score + totalScore,
      streak: prev.streak + 1,
      level: prev.level + (prev.streak + 1) % 3 === 0 ? 1 : 0
    }));

    if (soundEnabled) {
      soundManager.play('success');
    }

    // Award stickers for milestones
    if (gameState.streak >= 3 && onStickerEarned) {
      onStickerEarned(`animal-streak-${Date.now()}`);
    }

    setShowExplanation(true);

    setTimeout(() => {
      generateNewQuestion();
    }, 3000);
  }, [gameState.streak, gameState.timeRemaining, soundEnabled, onStickerEarned, generateNewQuestion]);

  const handleIncorrectAnswer = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      streak: 0
    }));

    if (soundEnabled) {
      soundManager.play('error');
    }

    setShowExplanation(true);

    setTimeout(() => {
      generateNewQuestion();
    }, 3000);
  }, [soundEnabled, generateNewQuestion]);

  const useHint = useCallback(() => {
    if (gameState.hints > 0 && gameState.currentQuestion) {
      setGameState(prev => ({
        ...prev,
        hints: prev.hints - 1
      }));
      setShowHint(true);

      if (soundEnabled) {
        soundManager.play('start');
      }
    }
  }, [gameState.hints, gameState.currentQuestion, soundEnabled]);

  const pauseGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      gameState: 'paused'
    }));
  }, []);

  const resumeGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      gameState: 'playing'
    }));
  }, []);

  const endGame = useCallback((completed: boolean = true) => {
    setGameState(prev => ({
      ...prev,
      gameState: completed ? 'completed' : 'failed'
    }));

    if (soundEnabled) {
      soundManager.play(completed ? 'success' : 'error');
    }
  }, [soundEnabled]);

  const exploreAnimal = useCallback((animal: Animal) => {
    setCurrentAnimal(animal);
    setGameState(prev => ({
      ...prev,
      gameState: 'learning',
      currentAnimal: animal
    }));

    if (!gameState.animalsDiscovered.includes(animal.id)) {
      setGameState(prev => ({
        ...prev,
        animalsDiscovered: [...prev.animalsDiscovered, animal.id]
      }));
    }
  }, [gameState.animalsDiscovered]);

  const renderAnimalCard = useCallback((animal: Animal) => {
    return (
      <div className="animal-card">
        <div className="animal-header">
          <h3>{getAnimalEmoji(animal.name)} {animal.name}</h3>
          <span className={`conservation-status ${animal.conservationStatus.replace(' ', '-')}`}>
            {animal.conservationStatus}
          </span>
        </div>

        <div className="animal-info">
          <div className="info-row">
            <span className="label">Species:</span>
            <span>{animal.species}</span>
          </div>
          <div className="info-row">
            <span className="label">Habitat:</span>
            <span>{animal.habitat}</span>
          </div>
          <div className="info-row">
            <span className="label">Diet:</span>
            <span>{animal.diet}</span>
          </div>
          <div className="info-row">
            <span className="label">Size:</span>
            <span>{animal.size}</span>
          </div>
          <div className="info-row">
            <span className="label">Lifespan:</span>
            <span>{animal.lifespan} years</span>
          </div>
        </div>

        <div className="animal-section">
          <h4>Fun Facts</h4>
          <ul className="fun-facts">
            {animal.funFacts.map((fact, index) => (
              <li key={index}>{fact}</li>
            ))}
          </ul>
        </div>

        <div className="animal-section">
          <h4>Behaviors</h4>
          <div className="behaviors">
            {animal.behaviors.map((behavior, index) => (
              <span key={index} className="behavior-tag">{behavior}</span>
            ))}
          </div>
        </div>

        <div className="animal-section">
          <h4>Adaptations</h4>
          <div className="adaptations">
            {animal.adaptations.map((adaptation, index) => (
              <span key={index} className="adaptation-tag">{adaptation}</span>
            ))}
          </div>
        </div>

        <div className="animal-section">
          <h4>Sounds</h4>
          <div className="sounds">
            {animal.sounds.map((sound, index) => (
              <span key={index} className="sound-tag">{sound}</span>
            ))}
          </div>
        </div>

        <button className="explore-button" onClick={() => {
          // Show more detailed information or open a learning modal
          alert(`More about ${animal.name}:\n\n${animal.funFacts.join('\n')}\n\nDid you know? ${animal.name}s can be found in ${animal.habitat} and they eat ${animal.diet}!`);
        }}>
          Learn More
        </button>
      </div>
    );
  }, [exploreAnimal]);

  const renderQuestion = useCallback(() => {
    if (!gameState.currentQuestion) return null;

    const question = gameState.currentQuestion;

    return (
      <div className="question-container">
        <div className="question-header">
          <span className="question-type">{question.type}</span>
          <span className="question-difficulty">{question.difficulty}</span>
          {gameState.timeRemaining !== undefined && (
            <span className="timer">{gameState.timeRemaining}s</span>
          )}
        </div>

        <div className="question-text">
          <h3>{question.question}</h3>
        </div>

        {question.multimedia && multimediaEnabled && (
          <div className="question-multimedia">
            {question.multimedia.type === 'image' && (
              <img
                src={question.multimedia.url}
                alt={question.multimedia.altText || question.animal.name}
                className="question-image"
              />
            )}
          </div>
        )}

        {question.options && (
          <div className={`answer-options ${question.options.length === 4 ? 'grid-2x2' : ''}`}>
            {question.options.map((option, index) => (
              <button
                key={index}
                className={`option-button ${
                  selectedAnswer === option ?
                    (option === question.correctAnswer ? 'correct' : 'incorrect') :
                    ''
                }`}
                onClick={() => submitAnswer(option)}
                disabled={selectedAnswer !== null}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {showHint && question.animal && (
          <div className="hint-box">
            <p>💡 Hint: This question is about the {question.animal.name}!</p>
          </div>
        )}

        {showExplanation && (
          <div className="explanation-box">
            <p><strong>Explanation:</strong> {question.explanation}</p>
            {question.animal && (
              <button
                className="learn-more-button"
                onClick={() => exploreAnimal(question.animal)}
              >
                Learn about {question.animal.name}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }, [gameState.currentQuestion, gameState.timeRemaining, selectedAnswer, showHint, showExplanation, multimediaEnabled, submitAnswer, exploreAnimal]);

  if (!isOpen) return null;

  return (
    <div className="animal-game-overlay">
      <div className="animal-game">
        <div className="game-header">
          <h2>Animal Adventure</h2>
          <div className="game-stats">
            <span>Score: {gameState.score}</span>
            <span>Level: {gameState.level}</span>
            <span>Streak: {gameState.streak}</span>
            <span>Discovered: {gameState.animalsDiscovered.length}</span>
          </div>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {gameState.gameState === 'menu' && (
          <div className="game-menu">
            <h3>Choose Your Adventure</h3>
            <div className="menu-options">
              <button onClick={() => startGame('quiz')} className="menu-button">
                🧩 Animal Quiz
                <br />
                <small>Test your knowledge with fun questions!</small>
              </button>
              <button onClick={() => startGame('learning')} className="menu-button">
                📚 Learn About Animals
                <br />
                <small>Choose any animal to explore and learn</small>
              </button>
              <button onClick={() => exploreAnimal(animalDatabase.getRandomAnimals(1)[0])} className="menu-button">
                🎲 Random Animal
                <br />
                <small>Discover a surprise animal friend!</small>
              </button>
            </div>

            <div className="discovered-animals">
              <h4>Animals Discovered ({gameState.animalsDiscovered.length})</h4>
              <div className="discovery-grid">
                {gameState.animalsDiscovered.map(animalId => {
                  const animal = animalDatabase.getAnimalById(animalId);
                  return animal ? (
                    <div key={animalId} className="discovered-animal">
                      {getAnimalEmoji(animal.name)} {animal.name}
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          </div>
        )}

        {gameState.gameState === 'playing' && gameState.currentQuestion && (
          <div className="game-playing">
            {renderQuestion()}

            <div className="game-controls">
              <button
                className="hint-button"
                onClick={useHint}
                disabled={gameState.hints === 0 || selectedAnswer !== null}
              >
                💡 Hint ({gameState.hints})
              </button>
              <button className="pause-button" onClick={pauseGame}>
                ⏸️ Pause
              </button>
            </div>
          </div>
        )}

        {gameState.gameState === 'animal-selection' && (
          <div className="animal-selection">
            <div className="selection-header">
              <h3>Choose an Animal to Learn About</h3>
              <button
                className="back-button"
                onClick={() => setGameState(prev => ({ ...prev, gameState: 'menu' }))}
              >
                ← Back to Menu
              </button>
            </div>
            <div className="animal-grid">
              {animalDatabase.getAllAnimals().map((animal) => (
                <button
                  key={animal.id}
                  className="animal-card-button"
                  onClick={() => exploreAnimal(animal)}
                >
                  <div className="animal-card-emoji">{getAnimalEmoji(animal.name)}</div>
                  <div className="animal-card-name">{animal.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {gameState.gameState === 'learning' && currentAnimal && (
          <div className="game-learning">
            <div className="learning-header">
              <h3>Learning about {currentAnimal.name}</h3>
              <div className="learning-actions">
                <button
                  className="new-animal-button"
                  onClick={() => exploreAnimal(animalDatabase.getRandomAnimals(1)[0])}
                >
                  🎲 Another Random Animal
                </button>
                <button
                  className="choose-animal-button"
                  onClick={() => setGameState(prev => ({ ...prev, gameState: 'animal-selection' }))}
                >
                  📁 Choose Different Animal
                </button>
              </div>
            </div>
            {renderAnimalCard(currentAnimal)}
          </div>
        )}

        {gameState.gameState === 'paused' && (
          <div className="game-paused">
            <h3>Game Paused</h3>
            <button onClick={resumeGame}>Resume</button>
            <button onClick={onClose}>Exit</button>
          </div>
        )}

        {gameState.gameState === 'completed' && (
          <div className="game-completed">
            <h3>Amazing Job!</h3>
            <p>Final Score: {gameState.score}</p>
            <p>Animals Discovered: {gameState.animalsDiscovered.length}</p>
            <p>Level Reached: {gameState.level}</p>
            <button onClick={resetGame}>Play Again</button>
            <button onClick={onClose}>Close</button>
          </div>
        )}

        {gameState.gameState === 'failed' && (
          <div className="game-failed">
            <h3>Time&apos;s Up!</h3>
            <p>Final Score: {gameState.score}</p>
            <p>Animals Discovered: {gameState.animalsDiscovered.length}</p>
            <button onClick={resetGame}>Try Again</button>
            <button onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimalGame;