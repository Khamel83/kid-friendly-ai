import React, { useState, useEffect } from 'react';
import { AnimalDatabase } from '../utils/animalDatabase';

interface MiniGameProps {
  onComplete: () => void;
}

// Expanded animal list with 30 animals for variety
const animals = [
  {
    name: 'African Elephant',
    emoji: '🐘',
    hints: [
      'I have a very long nose called a trunk',
      'I am the largest land animal',
      'I love to play in water and mud',
      'I have big ears and I never forget'
    ]
  },
  {
    name: 'Bottlenose Dolphin',
    emoji: '🐬',
    hints: [
      'I am a very smart sea animal',
      'I love to jump and play in waves',
      'I talk with clicks and whistles',
      'I sleep with one eye open'
    ]
  },
  {
    name: 'Monarch Butterfly',
    emoji: '🦋',
    hints: [
      'I start as a caterpillar',
      'I have beautiful orange and black wings',
      'I migrate thousands of miles each year',
      'I used to crawl but now I can fly'
    ]
  },
  {
    name: 'Emperor Penguin',
    emoji: '🐧',
    hints: [
      'I wear a tuxedo but I\'m not going to a party',
      'I love to slide on my belly',
      'I live where it\'s very cold',
      'I can\'t fly but I\'m an excellent swimmer'
    ]
  },
  {
    name: 'Lion',
    emoji: '🦁',
    hints: [
      'I am called the king of the jungle',
      'I have a big mane around my head',
      'I live in groups called prides',
      'I can roar really loud'
    ]
  },
  {
    name: 'Giraffe',
    emoji: '🦒',
    hints: [
      'I have a very long neck',
      'I am the tallest land animal',
      'I eat leaves from tall trees',
      'I have a long blue-black tongue'
    ]
  },
  {
    name: 'Giant Panda',
    emoji: '🐼',
    hints: [
      'I am black and white',
      'I love to eat bamboo',
      'I live in China',
      'I sleep a lot - about 10 hours a day'
    ]
  },
  {
    name: 'Koala',
    emoji: '🐨',
    hints: [
      'I live in Australia',
      'I eat eucalyptus leaves',
      'I sleep even more than a panda - up to 22 hours',
      'I have a big nose and fluffy ears'
    ]
  },
  {
    name: 'Cheetah',
    emoji: '🐆',
    hints: [
      'I am the fastest land animal',
      'I can go from 0 to 60 mph in 3 seconds',
      'I have black spots on my fur',
      'I cannot roar like other big cats'
    ]
  },
  {
    name: 'Great Horned Owl',
    emoji: '🦉',
    hints: [
      'I am awake at night',
      'I can turn my head almost all the way around',
      'I can fly silently',
      'I say "hoot hoot"'
    ]
  },
  {
    name: 'Sea Turtle',
    emoji: '🐢',
    hints: [
      'I live in the ocean',
      'I have a hard shell on my back',
      'I return to the same beach where I was born',
      'I can live for over 50 years'
    ]
  },
  {
    name: 'Red Fox',
    emoji: '🦊',
    hints: [
      'I have a big bushy tail',
      'I am clever and tricky',
      'I am often orange-red in color',
      'I hunt small animals'
    ]
  },
  {
    name: 'Zebra',
    emoji: '🦓',
    hints: [
      'I have black and white stripes',
      'I look like a horse with stripes',
      'I live in Africa',
      'No two zebras have the same stripe pattern'
    ]
  },
  {
    name: 'Kangaroo',
    emoji: '🦘',
    hints: [
      'I live in Australia',
      'I have strong back legs',
      'I carry my baby in a pouch',
      'I can hop really high and far'
    ]
  },
  {
    name: 'Raccoon',
    emoji: '🦝',
    hints: [
      'I have a black mask around my eyes',
      'I wash my food before eating',
      'I am active at night',
      'I have nimble fingers like hands'
    ]
  },
  {
    name: 'Eagle',
    emoji: '🦅',
    hints: [
      'I am a powerful bird of prey',
      'I have excellent eyesight',
      'I build my nest high up in trees',
      'I represent freedom and strength'
    ]
  },
  {
    name: 'Frog',
    emoji: '🐸',
    hints: [
      'I say "ribbit ribbit"',
      'I start as a tadpole with a tail',
      'I have strong legs for jumping',
      'I live both in water and on land'
    ]
  },
  {
    name: 'Octopus',
    emoji: '🐙',
    hints: [
      'I have eight arms',
      'I am very intelligent',
      'I can change colors to blend in',
      'I have three hearts'
    ]
  },
  {
    name: 'Polar Bear',
    emoji: '🐻‍❄️',
    hints: [
      'I am white and live in the Arctic',
      'I am an excellent swimmer',
      'I have black skin under my white fur',
      'I am the largest land carnivore'
    ]
  },
  {
    name: 'Wolf',
    emoji: '🐺',
    hints: [
      'I live in packs with my family',
      'I am related to dogs',
      'I howl at the moon',
      'I am a skilled hunter'
    ]
  },
  {
    name: 'Hippopotamus',
    emoji: '🦛',
    hints: [
      'I spend most of my time in water',
      'I have a big mouth and teeth',
      'I may look cute but I am dangerous',
      'I am the third largest land animal'
    ]
  },
  {
    name: 'Flamingo',
    emoji: '🦩',
    hints: [
      'I am pink and stand on one leg',
      'I eat with my head upside down',
      'I live in large groups',
      'My babies are born gray'
    ]
  },
  {
    name: 'Peacock',
    emoji: '🦚',
    hints: [
      'I have beautiful colorful feathers',
      'I spread my tail like a fan',
      'Only males have the fancy feathers',
      'I am known for being proud'
    ]
  },
  {
    name: 'Tiger',
    emoji: '🐅',
    hints: [
      'I have orange fur with black stripes',
      'I am the largest cat species',
      'I am an excellent swimmer',
      'I live alone unlike lions'
    ]
  },
  {
    name: 'Monkey',
    emoji: '🐵',
    hints: [
      'I climb trees very well',
      'I eat bananas',
      'I use my tail for balance',
      'I am playful and intelligent'
    ]
  },
  {
    name: 'Snake',
    emoji: '🐍',
    hints: [
      'I have no legs',
      'I shed my skin as I grow',
      'I smell with my tongue',
      'Some of us are poisonous'
    ]
  },
  {
    name: 'Bat',
    emoji: '🦇',
    hints: [
      'I fly at night',
      'I hang upside down to sleep',
      'I use sound to find my way',
      'I am the only mammal that can truly fly'
    ]
  },
  {
    name: 'Sloth',
    emoji: '🦥',
    hints: [
      'I move very very slowly',
      'I live in trees and hang upside down',
      'I sleep about 15-20 hours a day',
      'Algae grows in my fur'
    ]
  },
  {
    name: 'Armadillo',
    emoji: '🦦',
    hints: [
      'I have a hard shell like armor',
      'I can roll into a ball for protection',
      'I dig burrows to live in',
      'I eat insects and plants'
    ]
  },
  {
    name: 'Narwhal',
    emoji: '🦄',
    hints: [
      'I am called the unicorn of the sea',
      'I have a long tusk like a horn',
      'I live in the Arctic Ocean',
      'I am a type of whale'
    ]
  },
  {
    name: 'Bee',
    emoji: '🐝',
    hints: [
      'I make honey',
      'I buzz around flowers',
      'I live in a hive with a queen',
      'I dance to tell other bees where food is'
    ]
  }
];

export default function MiniGame({ onComplete }: MiniGameProps) {
  const [currentAnimalIndex, setCurrentAnimalIndex] = useState(0);
  const [usedAnimals, setUsedAnimals] = useState<number[]>([]);
  const [hintIndex, setHintIndex] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Get a random animal that hasn't been used yet
  const getRandomAnimal = () => {
    const availableAnimals = animals.map((_, index) => index)
      .filter(index => !usedAnimals.includes(index));

    if (availableAnimals.length === 0) {
      // Reset if all animals have been used
      setUsedAnimals([]);
      return Math.floor(Math.random() * animals.length);
    }

    const randomIndex = Math.floor(Math.random() * availableAnimals.length);
    return availableAnimals[randomIndex];
  };

  const currentGame = animals[currentAnimalIndex];

  // Initialize with a random animal
  useEffect(() => {
    const initialIndex = getRandomAnimal();
    setCurrentAnimalIndex(initialIndex);
    setUsedAnimals([initialIndex]);
  }, []);

  // Generate multiple choice options (correct answer + 3 wrong ones)
  const getOptions = () => {
    const correctAnswer = currentGame.name;
    const wrongAnswers = animals
      .filter(animal => animal.name !== correctAnswer)
      .map(animal => animal.name)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const allOptions = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    return allOptions;
  };

  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    setOptions(getOptions());
    setHintIndex(0);
    setGameState('playing');
    setSelectedAnswer(null);
    setShowFeedback(false);
  }, [currentAnimalIndex]);

  const handleAnswer = (answer: string) => {
    setSelectedAnswer(answer);
    setShowFeedback(true);

    if (answer.toLowerCase() === currentGame.name.toLowerCase()) {
      setGameState('won');
      setScore(prev => prev + (5 - hintIndex)); // More points for fewer hints
    } else {
      setGameState('lost');
    }
  };

  const nextHint = () => {
    if (hintIndex < currentGame.hints.length - 1) {
      setHintIndex(prev => prev + 1);
    }
  };

  const nextAnimal = () => {
    const nextIndex = getRandomAnimal();
    setCurrentAnimalIndex(nextIndex);
    setUsedAnimals(prev => [...prev, nextIndex]);
  };

  const finishGame = () => {
    onComplete();
  };

  return (
    <div className="mini-game">
      <div className="game-header">
        <h3>🐾 Guess the Animal! 🐾</h3>
        <div className="score">Stars: ⭐{score}</div>
        <button onClick={finishGame} className="back-button">
          ← Back to Buddy
        </button>
      </div>

      <div className="game-content">
        <div className="animal-emoji" style={{ fontSize: '4rem' }}>
          {gameState !== 'playing' ? currentGame.emoji : '❓'}
        </div>

        {gameState === 'playing' && (
          <div className="hints-section">
            <p className="hint-label">💡 Clues:</p>
            <div className="hints-list">
              {currentGame.hints.slice(0, hintIndex + 1).map((hint, index) => (
                <div key={index} className="hint-item">
                  {hint}
                </div>
              ))}
            </div>

            {hintIndex < currentGame.hints.length - 1 && (
              <button onClick={nextHint} className="hint-button">
                Need Another Clue?
              </button>
            )}

            <div className="multiple-choice">
              <p className="question-text">What animal am I?</p>
              <div className={`options-grid ${options.length === 4 ? 'grid-2x2' : ''}`}>
                {options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => !showFeedback && handleAnswer(option)}
                    disabled={showFeedback}
                    className={`option-button ${
                      showFeedback && option.toLowerCase() === currentGame.name.toLowerCase()
                        ? 'correct'
                        : showFeedback && selectedAnswer === option
                        ? 'incorrect'
                        : ''
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showFeedback && (
          <div className="feedback-section">
            <h4 className={`feedback-title ${gameState === 'won' ? 'correct' : 'incorrect'}`}>
              {gameState === 'won' ? '🎉 Correct! 🎉' : '❌ Not Quite! ❌'}
            </h4>
            <p className="feedback-animal">
              It's a {currentGame.emoji} {currentGame.name.charAt(0).toUpperCase() + currentGame.name.slice(1)}!
            </p>
            <p className="feedback-message">
              {gameState === 'won'
                ? 'Amazing job! You\'re a super detective! 🕵️‍♂️✨'
                : `Don't worry! The answer was ${currentGame.name}. Try the next one! 🌟`
              }
            </p>

            <div className="feedback-controls">
              <button onClick={nextAnimal} className="next-button">
                Next Animal →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}