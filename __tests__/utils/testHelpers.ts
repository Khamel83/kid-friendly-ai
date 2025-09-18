import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider as ReduxProvider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Custom render function with providers
function AllTheProviders({ children }: { children: React.ReactNode }) {
  // Mock Redux store if needed
  const store = configureStore({
    reducer: {},
    preloadedState: {},
  });

  return (
    <ReduxProvider store={store}>
      {children}
    </ReduxProvider>
  );
}

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';

// Override render method
export { customRender as render };

// Mock data generators
export const mockAnimal = {
  id: 'test-animal',
  name: 'Test Animal',
  species: 'Animalus testus',
  habitat: 'Test Habitat',
  diet: 'omnivore' as const,
  size: 'medium' as const,
  lifespan: 10,
  conservationStatus: 'least concern' as const,
  funFacts: ['Test fact 1', 'Test fact 2'],
  sounds: ['sound1', 'sound2'],
  behaviors: ['behavior1', 'behavior2'],
  adaptations: ['adaptation1', 'adaptation2'],
};

export const mockMathProblem = {
  id: 'test-problem',
  question: 'What is 2 + 2?',
  answer: 4,
  difficulty: 'easy' as const,
  category: 'addition' as const,
  options: ['3', '4', '5', '6'],
  hint: 'Count your fingers',
  funFact: 'Addition is the most basic math operation',
};

export const mockPatternPuzzle = {
  id: 'test-puzzle',
  type: 'visual' as const,
  difficulty: 'easy' as const,
  sequence: ['circle', 'square', 'triangle', null],
  answer: 'triangle',
  options: ['circle', 'square', 'triangle', 'star'],
  hint: 'Look for the repeating pattern',
  explanation: 'The pattern repeats every 3 shapes',
};

// Test utilities
export const createMockEvent = (type: string, data: any = {}) => ({
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  target: { value: '', ...data },
  currentTarget: { value: '', ...data },
  ...data,
});

export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

export const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

export const mockFetch = (response: any = {}) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue(response),
    text: jest.fn().mockResolvedValue(JSON.stringify(response)),
    blob: jest.fn().mockResolvedValue(new Blob()),
  } as any);
};

export const clearAllMocks = () => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
};