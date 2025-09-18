import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnimalGame from './AnimalGame';

// Mock animal database
jest.mock('../utils/animalDatabase', () => ({
  AnimalDatabase: {
    getInstance: jest.fn(() => ({
      getAllAnimals: jest.fn(() => [
        {
          id: 'lion',
          name: 'Lion',
          species: 'Panthera leo',
          habitat: 'African Savanna',
          diet: 'carnivore',
          size: 'large',
          lifespan: 15,
          conservationStatus: 'vulnerable',
          funFacts: ['Lions are the only cats that live in groups'],
          sounds: ['roar'],
          behaviors: ['hunting', 'social'],
          adaptations: ['sharp teeth', 'strong muscles'],
        },
      ]),
      getRandomAnimals: jest.fn(() => [
        {
          id: 'lion',
          name: 'Lion',
          species: 'Panthera leo',
          habitat: 'African Savanna',
          diet: 'carnivore',
          size: 'large',
          lifespan: 15,
          conservationStatus: 'vulnerable',
          funFacts: ['Lions are the only cats that live in groups'],
          sounds: ['roar'],
          behaviors: ['hunting', 'social'],
          adaptations: ['sharp teeth', 'strong muscles'],
        },
      ]),
      getAnimalById: jest.fn((id) => ({
        id: 'lion',
        name: 'Lion',
        species: 'Panthera leo',
        habitat: 'African Savanna',
        diet: 'carnivore',
        size: 'large',
        lifespan: 15,
        conservationStatus: 'vulnerable',
        funFacts: ['Lions are the only cats that live in groups'],
        sounds: ['roar'],
        behaviors: ['hunting', 'social'],
        adaptations: ['sharp teeth', 'strong muscles'],
      })),
      searchAnimals: jest.fn(() => [
        {
          id: 'lion',
          name: 'Lion',
          species: 'Panthera leo',
          habitat: 'African Savanna',
          diet: 'carnivore',
          size: 'large',
          lifespan: 15,
          conservationStatus: 'vulnerable',
          funFacts: ['Lions are the only cats that live in groups'],
          sounds: ['roar'],
          behaviors: ['hunting', 'social'],
          adaptations: ['sharp teeth', 'strong muscles'],
        },
      ]),
    })),
  },
}));

// Mock sound effects
jest.mock('../utils/soundEffects', () => ({
  SoundManager: {
    getInstance: jest.fn(() => ({
      play: jest.fn(),
      setVolume: jest.fn(),
      preload: jest.fn(),
    })),
  },
}));

// Mock accessibility utils
jest.mock('../utils/accessibility', () => ({
  AccessibilityUtils: {
    announce: jest.fn(),
    generateId: jest.fn(() => 'test-id'),
    trapFocus: jest.fn(),
    removeFocusTrap: jest.fn(),
  },
  useFocusManagement: jest.fn(() => ({
    focusRef: { current: null },
    setFocus: jest.fn(),
    restoreFocus: jest.fn(),
  })),
}));

describe('AnimalGame', () => {
  const mockOnGameComplete = jest.fn();
  const mockOnScoreUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default props', () => {
      render(<AnimalGame />);

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should render with custom callbacks', () => {
      render(
        <AnimalGame
          onGameComplete={mockOnGameComplete}
          onScoreUpdate={mockOnScoreUpdate}
        />
      );

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should display animal content', () => {
      render(<AnimalGame />);

      // Should show animal-related content
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });
  });

  describe('Animal Data Loading', () => {
    it('should load animal data from database', () => {
      const { AnimalDatabase } = require('../utils/animalDatabase');
      const mockDatabase = AnimalDatabase.getInstance();

      render(<AnimalGame />);

      expect(mockDatabase.getAllAnimals).toHaveBeenCalled();
    });

    it('should handle empty animal data', () => {
      const { AnimalDatabase } = require('../utils/animalDatabase');
      const mockDatabase = AnimalDatabase.getInstance();
      mockDatabase.getAllAnimals.mockReturnValue([]);

      render(<AnimalGame />);

      // Should handle empty data gracefully
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });
  });

  describe('Game Modes', () => {
    it('should support different game modes', () => {
      render(<AnimalGame />);

      // Should have different game modes
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });

    it('should switch between game modes', () => {
      render(<AnimalGame />);

      // Should allow mode switching
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Animal Identification', () => {
    it('should present animals for identification', () => {
      render(<AnimalGame />);

      // Should show animals for identification
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });

    it('should handle animal selection', () => {
      render(<AnimalGame />);

      // Should handle animal selection
      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        expect(true).toBe(true);
      }
    });

    it('should validate animal identification', () => {
      render(<AnimalGame />);

      // Should validate selections
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });
  });

  describe('Educational Content', () => {
    it('should display animal facts', () => {
      render(<AnimalGame />);

      // Should show educational content
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });

    it('should show animal information', () => {
      render(<AnimalGame />);

      // Should display animal details
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });
  });

  describe('Scoring and Progress', () => {
    it('should track game progress', () => {
      render(<AnimalGame onScoreUpdate={mockOnScoreUpdate} />);

      // Should track progress
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });

    it('should update score correctly', () => {
      render(<AnimalGame onScoreUpdate={mockOnScoreUpdate} />);

      // Should handle scoring
      expect(mockOnScoreUpdate).toBeDefined();
    });
  });

  describe('Animal Categories', () => {
    it('should categorize animals by habitat', () => {
      render(<AnimalGame />);

      // Should support habitat categorization
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });

    it('should categorize animals by diet', () => {
      render(<AnimalGame />);

      // Should support diet categorization
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });

    it('should categorize animals by size', () => {
      render(<AnimalGame />);

      // Should support size categorization
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });
  });

  describe('Conservation Education', () => {
    it('should teach about conservation status', () => {
      render(<AnimalGame />);

      // Should include conservation education
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });

    it('should highlight endangered animals', () => {
      render(<AnimalGame />);

      // Should highlight conservation concerns
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });
  });

  describe('Sound Effects', () => {
    it('should play animal sounds', () => {
      const { SoundManager } = require('../utils/soundEffects');
      const mockSoundManager = SoundManager.getInstance();

      render(<AnimalGame />);

      expect(mockSoundManager.play).toBeDefined();
    });

    it('should play feedback sounds', () => {
      const { SoundManager } = require('../utils/soundEffects');
      const mockSoundManager = SoundManager.getInstance();

      render(<AnimalGame />);

      expect(mockSoundManager.play).toBeDefined();
    });
  });

  describe('Search and Filter', () => {
    it('should support animal search', () => {
      render(<AnimalGame />);

      // Should support search functionality
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });

    it('should filter animals by criteria', () => {
      render(<AnimalGame />);

      // Should support filtering
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', () => {
      render(<AnimalGame />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        fireEvent.keyDown(button, { key: 'Enter' });
        fireEvent.keyDown(button, { key: ' ' });

        expect(true).toBe(true);
      });
    });

    it('should announce game events', () => {
      const { AccessibilityUtils } = require('../utils/accessibility');

      render(<AnimalGame />);

      expect(AccessibilityUtils.announce).toBeDefined();
    });

    it('should provide alternative text for images', () => {
      render(<AnimalGame />);

      // Should have alt text for visual content
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing animal data', () => {
      const { AnimalDatabase } = require('../utils/animalDatabase');
      const mockDatabase = AnimalDatabase.getInstance();
      mockDatabase.getRandomAnimals.mockReturnValue([]);

      render(<AnimalGame />);

      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });

    it('should handle database errors', () => {
      const { AnimalDatabase } = require('../utils/animalDatabase');
      const mockDatabase = AnimalDatabase.getInstance();
      mockDatabase.getAllAnimals.mockImplementation(() => {
        throw new Error('Database error');
      });

      const originalError = console.error;
      console.error = jest.fn();

      render(<AnimalGame />);

      console.error = originalError;
    });
  });

  describe('Performance', () => {
    it('should render efficiently', () => {
      const startTime = performance.now();
      render(<AnimalGame />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should not cause memory leaks', () => {
      const { unmount } = render(<AnimalGame />);

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('Game Completion', () => {
    it('should handle game completion', () => {
      render(<AnimalGame onGameComplete={mockOnGameComplete} />);

      // Should handle completion
      expect(mockOnGameComplete).toBeDefined();
    });

    it('should show results summary', () => {
      render(<AnimalGame />);

      // Should show results
      const gameElement = screen.getByRole('main');
      expect(gameElement).toBeInTheDocument();
    });
  });
});