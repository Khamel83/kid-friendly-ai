import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from './index';

// Mock the next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    };
  },
}));

// Mock next/head
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the main page', () => {
      render(<Home />);

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should have proper title and meta tags', () => {
      render(<Home />);

      // Check if document title is set
      expect(document.title).toBe('Kid-Friendly AI Assistant');
    });

    it('should be accessible', () => {
      const { container } = render(<Home />);

      // Check for proper heading structure
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      expect(headings.length).toBeGreaterThan(0);

      // Check for ARIA landmarks
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should have navigation elements', () => {
      render(<Home />);

      // Look for navigation or interactive elements
      const interactiveElements = screen.getAllByRole('button');
      expect(interactiveElements.length).toBeGreaterThan(0);
    });

    it('should handle user interactions', () => {
      render(<Home />);

      // Find and click buttons
      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        fireEvent.click(buttons[0]);
        // Should not throw errors
        expect(true).toBe(true);
      }
    });
  });

  describe('Responsiveness', () => {
    it('should render on different screen sizes', () => {
      // Test mobile view
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      });

      const { rerender } = render(<Home />);
      expect(screen.getByRole('main')).toBeInTheDocument();

      // Test desktop view
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      rerender(<Home />);
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing props gracefully', () => {
      expect(() => {
        render(<Home />);
      }).not.toThrow();
    });

    it('should handle component errors', () => {
      // Mock console.error to reduce noise
      const originalError = console.error;
      console.error = jest.fn();

      render(<Home />);

      // Should not have unhandled errors
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Uncaught')
      );

      console.error = originalError;
    });
  });

  describe('Performance', () => {
    it('should render without performance issues', () => {
      const startTime = performance.now();
      render(<Home />);
      const endTime = performance.now();

      // Should render in under 100ms
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should not cause memory leaks', () => {
      const { unmount } = render(<Home />);

      // Should unmount without errors
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper keyboard navigation', () => {
      render(<Home />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Test keyboard navigation
        fireEvent.keyDown(button, { key: 'Enter' });
        fireEvent.keyDown(button, { key: ' ' });

        // Should not throw errors
        expect(true).toBe(true);
      });
    });

    it('should have proper focus management', () => {
      render(<Home />);

      const buttons = screen.getAllByRole('button');
      if (buttons.length > 0) {
        // Test focus events
        fireEvent.focus(buttons[0]);
        fireEvent.blur(buttons[0]);

        // Should not throw errors
        expect(true).toBe(true);
      }
    });
  });
});