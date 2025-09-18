import React from 'react';
import { render, screen, fireEvent, waitFor } from '../__tests__/components/ComponentTestBase';
import VoiceButton from './VoiceButton';

// Mock the actual Web Speech API
const mockSpeechRecognition = {
  continuous: false,
  interimResults: false,
  lang: '',
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  onresult: null as any,
  onerror: null as any,
  onend: null as any,
  onstart: null as any,
};

const mockSpeechGrammarList = {
  addFromString: jest.fn(),
};

const mockSpeechRecognitionConstructor = jest.fn(() => mockSpeechRecognition);

Object.defineProperty(window, 'SpeechRecognition', {
  value: mockSpeechRecognitionConstructor,
  writable: true,
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  value: mockSpeechRecognitionConstructor,
  writable: true,
});

Object.defineProperty(window, 'SpeechGrammarList', {
  value: jest.fn(() => mockSpeechGrammarList),
  writable: true,
});

describe('VoiceButton', () => {
  const mockOnTranscription = jest.fn();
  const mockOnError = jest.fn();
  const mockOnStateChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeechRecognition.start.mockClear();
    mockSpeechRecognition.stop.mockClear();
    mockSpeechRecognition.abort.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default props', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button', { name: /hold to speak/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Hold to speak');
    });

    it('should render with custom accessibility label', () => {
      render(
        <VoiceButton
          onTranscription={mockOnTranscription}
          accessibilityLabel="Custom voice command button"
        />
      );

      const button = screen.getByRole('button', { name: /custom voice command button/i });
      expect(button).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <VoiceButton
          onTranscription={mockOnTranscription}
          disabled={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should show loading state when isLoading is true', () => {
      render(
        <VoiceButton
          onTranscription={mockOnTranscription}
          isLoading={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('loading');
      expect(button).toBeDisabled();
    });
  });

  describe('Speech Recognition Initialization', () => {
    it('should initialize speech recognition on mount', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      expect(mockSpeechRecognitionConstructor).toHaveBeenCalled();
      expect(mockSpeechRecognition.continuous).toBe(false);
      expect(mockSpeechRecognition.interimResults).toBe(true);
      expect(mockSpeechRecognition.lang).toBe('en-US');
    });

    it('should set up event handlers', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      expect(mockSpeechRecognition.onresult).toBeDefined();
      expect(mockSpeechRecognition.onerror).toBeDefined();
      expect(mockSpeechRecognition.onend).toBeDefined();
      expect(mockSpeechRecognition.onstart).toBeDefined();
    });

    it('should handle speech recognition not available', () => {
      // Temporarily remove SpeechRecognition
      const originalSpeechRecognition = window.SpeechRecognition;
      (window as any).SpeechRecognition = undefined;
      (window as any).webkitSpeechRecognition = undefined;

      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Speech recognition not supported',
        })
      );

      // Restore SpeechRecognition
      window.SpeechRecognition = originalSpeechRecognition;
    });
  });

  describe('Mouse Interactions', () => {
    it('should start recognition on mouse down', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);

      expect(mockSpeechRecognition.start).toHaveBeenCalled();
      expect(mockOnStateChange).toHaveBeenCalledWith('listening');
    });

    it('should stop recognition on mouse up', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);

      expect(mockSpeechRecognition.stop).toHaveBeenCalled();
    });

    it('should stop recognition on mouse leave', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);
      fireEvent.mouseLeave(button);

      expect(mockSpeechRecognition.stop).toHaveBeenCalled();
    });
  });

  describe('Touch Interactions', () => {
    it('should start recognition on touch start', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.touchStart(button);

      expect(mockSpeechRecognition.start).toHaveBeenCalled();
    });

    it('should stop recognition on touch end', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);

      expect(mockSpeechRecognition.stop).toHaveBeenCalled();
    });
  });

  describe('Keyboard Interactions', () => {
    it('should start recognition on space key down', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: ' ' });

      expect(mockSpeechRecognition.start).toHaveBeenCalled();
    });

    it('should stop recognition on space key up', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: ' ' });
      fireEvent.keyUp(button, { key: ' ' });

      expect(mockSpeechRecognition.stop).toHaveBeenCalled();
    });

    it('should start recognition on Enter key down', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });

      expect(mockSpeechRecognition.start).toHaveBeenCalled();
    });
  });

  describe('Speech Recognition Events', () => {
    it('should handle speech recognition start event', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);

      // Simulate speech recognition start event
      if (mockSpeechRecognition.onstart) {
        mockSpeechRecognition.onstart();
      }

      expect(mockOnStateChange).toHaveBeenCalledWith('listening');
    });

    it('should handle speech recognition end event', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);

      // Simulate speech recognition end event
      if (mockSpeechRecognition.onend) {
        mockSpeechRecognition.onend();
      }

      expect(mockOnStateChange).toHaveBeenCalledWith('inactive');
    });

    it('should handle speech recognition result event', async () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);

      // Mock result event
      const mockResult = {
        results: [
          {
            0: {
              transcript: 'Hello world',
              confidence: 0.9,
            },
            isFinal: true,
          },
        ],
      };

      // Simulate speech recognition result event
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult(mockResult);
      }

      await waitFor(() => {
        expect(mockOnTranscription).toHaveBeenCalledWith('Hello world', true);
      });
    });

    it('should handle interim results', async () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);

      // Mock interim result event
      const mockResult = {
        results: [
          {
            0: {
              transcript: 'Hello',
              confidence: 0.8,
            },
            isFinal: false,
          },
        ],
      };

      // Simulate speech recognition result event
      if (mockSpeechRecognition.onresult) {
        mockSpeechRecognition.onresult(mockResult);
      }

      await waitFor(() => {
        expect(mockOnTranscription).toHaveBeenCalledWith('Hello', false);
      });
    });

    it('should handle speech recognition error event', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);

      // Mock error event
      const mockError = {
        error: 'no-speech',
        message: 'No speech was detected',
      };

      // Simulate speech recognition error event
      if (mockSpeechRecognition.onerror) {
        mockSpeechRecognition.onerror(mockError);
      }

      expect(mockOnError).toHaveBeenCalledWith(mockError);
      expect(mockOnStateChange).toHaveBeenCalledWith('inactive');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Hold to speak');
      expect(button).toHaveAttribute('role', 'button');
    });

    it('should update ARIA attributes when listening', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);

      // Simulate speech recognition start event
      if (mockSpeechRecognition.onstart) {
        mockSpeechRecognition.onstart();
      }

      expect(button).toHaveAttribute('aria-label', 'Listening... release to stop');
    });

    it('should be keyboard accessible', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');

      // Test keyboard navigation
      fireEvent.keyDown(button, { key: 'Tab' });
      fireEvent.keyDown(button, { key: 'Enter' });

      expect(mockSpeechRecognition.start).toHaveBeenCalled();
    });

    it('should have proper focus management', () => {
      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');

      // Test focus events
      fireEvent.focus(button);
      fireEvent.blur(button);

      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should abort recognition on unmount', () => {
      const { unmount } = render(
        <VoiceButton onTranscription={mockOnTranscription} />
      );

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);

      unmount();

      expect(mockSpeechRecognition.abort).toHaveBeenCalled();
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = render(
        <VoiceButton onTranscription={mockOnTranscription} />
      );

      unmount();

      // Should not throw errors when trying to interact after unmount
      expect(() => {
        if (mockSpeechRecognition.onresult) {
          mockSpeechRecognition.onresult({ results: [] });
        }
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle recognition start failure', () => {
      mockSpeechRecognition.start.mockImplementation(() => {
        throw new Error('Recognition start failed');
      });

      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Recognition start failed',
        })
      );
    });

    it('should handle recognition stop failure', () => {
      mockSpeechRecognition.stop.mockImplementation(() => {
        throw new Error('Recognition stop failed');
      });

      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');
      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);

      // Should not throw unhandled error
      expect(true).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should debounce rapid start/stop calls', () => {
      jest.useFakeTimers();

      render(<VoiceButton onTranscription={mockOnTranscription} />);

      const button = screen.getByRole('button');

      // Rapid mouse down/up
      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);
      fireEvent.mouseDown(button);
      fireEvent.mouseUp(button);

      jest.advanceTimersByTime(100);

      expect(mockSpeechRecognition.start).toHaveBeenCalledTimes(1);
      expect(mockSpeechRecognition.stop).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });
});