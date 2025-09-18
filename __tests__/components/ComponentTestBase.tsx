import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { Provider as ReduxProvider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Mock Redux store for testing
function createMockStore(preloadedState = {}) {
  return configureStore({
    reducer: {
      // Add reducers as needed for testing
    },
    preloadedState,
  });
}

interface TestProvidersProps {
  children: React.ReactNode;
}

function TestProviders({ children }: TestProvidersProps) {
  const store = createMockStore();

  return (
    <ReduxProvider store={store}>
      {children}
    </ReduxProvider>
  );
}

// Custom render function with providers
function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, { wrapper: TestProviders, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Common test utilities
export const waitForNextTick = () => new Promise(resolve => setTimeout(resolve, 0));

export const createMockProps = <T extends object>(overrides: Partial<T> = {}): T => {
  return overrides as T;
};

export const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

export const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Event simulation helpers
export const createMockEvent = (type: string, data: any = {}) => ({
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  target: { value: '', ...data },
  currentTarget: { value: '', ...data },
  ...data,
});

// Component state helpers
export const createMockState = (overrides: any = {}) => ({
  loading: false,
  error: null,
  data: null,
  ...overrides,
});

// Mock data for common test scenarios
export const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  preferences: {
    theme: 'light',
    soundEnabled: true,
    accessibility: {
      reducedMotion: false,
      highContrast: false,
    },
  },
};

export const mockGameState = {
  score: 0,
  level: 1,
  streak: 0,
  hints: 3,
  isPlaying: false,
  isPaused: false,
  isCompleted: false,
};

// API response mocks
export const mockApiResponse = {
  data: {},
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
};

export const mockApiError = {
  response: {
    data: { message: 'Test error message' },
    status: 400,
    statusText: 'Bad Request',
    headers: {},
  },
  message: 'Request failed with status code 400',
  config: {},
};

// Setup and teardown utilities
export const setupTestEnvironment = () => {
  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
  });

  // Mock fetch
  global.fetch = jest.fn() as any;

  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    mockLocalStorage.clear.mockClear();
  });
};

export const cleanupTestEnvironment = () => {
  // Clean up after tests
  jest.clearAllMocks();
};

// Accessibility test helpers
export const testAccessibility = (element: HTMLElement) => {
  // Basic accessibility checks
  it('should have proper alt text for images', () => {
    const images = element.querySelectorAll('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  });

  it('should have proper button labels', () => {
    const buttons = element.querySelectorAll('button');
    buttons.forEach(button => {
      const hasText = button.textContent?.trim().length;
      const hasAriaLabel = button.getAttribute('aria-label');
      const hasAriaLabelledBy = button.getAttribute('aria-labelledby');

      expect(hasText || hasAriaLabel || hasAriaLabelledBy).toBeTruthy();
    });
  });

  it('should have proper form labels', () => {
    const inputs = element.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      const hasLabel = input.getAttribute('aria-label') ||
                      input.getAttribute('aria-labelledby') ||
                      (input.id && document.querySelector(`label[for="${input.id}"]`));

      expect(hasLabel).toBeTruthy();
    });
  });
};