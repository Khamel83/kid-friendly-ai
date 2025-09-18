# Kid-Friendly AI Buddy - Developer Guide

## 🚀 Getting Started as a Developer

This guide provides comprehensive information for developers contributing to the Kid-Friendly AI Buddy project. It covers development environment setup, coding standards, testing practices, and deployment workflows.

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.0 or higher
- **npm**: 8.0 or higher
- **Git**: Latest version
- **IDE**: VS Code (recommended) or similar
- **Browser**: Chrome for debugging

### Required Knowledge
- **React**: Functional components and hooks
- **TypeScript**: Type definitions and interfaces
- **Next.js**: Framework concepts and API routes
- **Tailwind CSS**: Utility-first styling
- **Git**: Version control and collaboration

## 🛠️ Development Environment Setup

### 1. Repository Setup

```bash
# Clone the repository
git clone https://github.com/Khamel83/kid-friendly-ai.git
cd kid-friendly-ai

# Add upstream remote (for contributors)
git remote add upstream https://github.com/Khamel83/kid-friendly-ai.git

# Create your feature branch
git checkout -b feature/your-feature-name
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Environment Configuration

```bash
# Create environment file
cp .env.example .env.local

# Edit environment variables
nano .env.local
```

Required environment variables:
```env
# API Configuration
OPENROUTER_API_KEY=your_openrouter_api_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional Configuration
NEXT_PUBLIC_ANALYTICS_ENABLED=false
NEXT_PUBLIC_DEBUG_MODE=false
```

### 4. Development Server

```bash
# Start development server
npm run dev

# Open browser to http://localhost:3000
```

### 5. IDE Setup (VS Code)

#### Recommended Extensions
```bash
# Install VS Code extensions
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-json
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-playwright.playwright
```

#### VS Code Settings
Create `.vscode/settings.json`:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

## 📁 Project Structure Deep Dive

### Directory Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Basic UI elements
│   ├── features/        # Feature-specific components
│   └── layout/          # Layout components
├── pages/              # Next.js pages
│   ├── api/            # API routes
│   └── _app.tsx        # App configuration
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── styles/             # Styles and themes
└── constants/          # Application constants
```

### Component Organization

#### Atomic Design Principles
- **Atoms**: Basic HTML elements with styling
- **Molecules**: Simple component combinations
- **Organisms**: Complex component assemblies
- **Templates**: Page layouts
- **Pages**: Complete page implementations

#### Component Naming Conventions
- **PascalCase**: Component files (`CharacterCompanion.tsx`)
- **kebab-case**: CSS classes (`character-companion`)
- **camelCase**: Functions and variables (`handleClick`)
- **SCREAMING_SNAKE_CASE**: Constants (`MAX_RETRIES`)

## 🔧 Development Workflow

### 1. Branch Strategy

```bash
# Feature branches
git checkout -b feature/add-new-game
git checkout -b feature/improve-accessibility

# Bugfix branches
git checkout -b fix/audio-bug

# Release branches
git checkout -b release/v1.0.0
```

### 2. Commit Convention

Use Conventional Commits format:
```bash
# Features
git commit -m "feat: add pattern puzzle game"

# Bug fixes
git commit -m "fix: resolve audio playback issue"

# Documentation
git commit -m "docs: update API documentation"

# Style changes
git commit -m "style: format code with Prettier"

# Refactoring
git commit -m "refactor: improve component structure"

# Performance
git commit -m "perf: optimize bundle size"

# Tests
git commit -m "test: add unit tests for audio system"

# Build changes
git commit -m "build: update Next.js version"
```

### 3. Development Process

```bash
# 1. Pull latest changes
git pull upstream main

# 2. Create feature branch
git checkout -b feature/your-feature

# 3. Make changes and test
# ... development work ...

# 4. Run linting and tests
npm run lint
npm run test
npm run type-check

# 5. Commit changes
git add .
git commit -m "feat: add your feature"

# 6. Push to your fork
git push origin feature/your-feature

# 7. Create pull request
# (via GitHub web interface)
```

## 🎨 Coding Standards

### TypeScript Standards

#### Type Definitions
```typescript
// Good practice
interface UserPreferences {
  language: string;
  theme: 'light' | 'dark' | 'auto';
  accessibility: AccessibilityOptions;
}

// Avoid using 'any'
const processData = (data: unknown): ProcessedData => {
  if (typeof data === 'object' && data !== null) {
    return transformData(data as Record<string, unknown>);
  }
  throw new Error('Invalid data format');
};
```

#### React Component Patterns
```typescript
// Functional component with TypeScript
interface CharacterCompanionProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'excited';
  size?: number;
  className?: string;
}

export const CharacterCompanion: React.FC<CharacterCompanionProps> = ({
  state,
  size = 100,
  className = ''
}) => {
  // Component logic
  return <div className={`character-companion ${className}`}>{/* ... */}</div>;
};
```

#### Custom Hooks
```typescript
// Custom hook with proper typing
interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
}

export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn => {
  // Hook implementation
};
```

### React Best Practices

#### Component Structure
```typescript
// Good: Component with clear separation of concerns
const ChatInterface: React.FC = () => {
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Effects
  useEffect(() => {
    loadInitialMessages();
  }, []);

  // Event handlers
  const handleSendMessage = useCallback((text: string) => {
    // Send message logic
  }, []);

  // Memoized values
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.timestamp - b.timestamp);
  }, [messages]);

  // Render
  return (
    <div className="chat-interface">
      {sortedMessages.map(message => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
};
```

#### Performance Optimization
```typescript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo<{ data: LargeData }>(({ data }) => {
  return <div>{/* Expensive rendering */}</div>;
});

// Use useMemo for expensive calculations
const filteredData = useMemo(() => {
  return largeDataSet.filter(item => item.isActive);
}, [largeDataSet]);

// Use useCallback for stable function references
const handleClick = useCallback(() => {
  // Event handling logic
}, [dependencies]);
```

### CSS and Styling

#### Tailwind CSS Guidelines
```typescript
// Good: Using Tailwind classes
<button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
  Click me
</button>

// Avoid: Inline styles
<button style={{ padding: '1rem', backgroundColor: 'blue' }}>
  Click me
</button>
```

#### Component-Specific Styles
```css
/* CharacterCompanion.module.css */
.characterCompanion {
  @apply relative transition-all duration-300;
}

.characterCompanion--listening {
  @apply animate-pulse;
}

.characterCompanion__body {
  @apply bg-blue-500 rounded-full;
}
```

## 🧪 Testing Guidelines

### Testing Strategy

#### Unit Testing
```typescript
// Component testing with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { CharacterCompanion } from '../CharacterCompanion';

describe('CharacterComponent', () => {
  it('renders with default props', () => {
    render(<CharacterCompanion state="idle" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('applies correct state class', () => {
    render(<CharacterCompanion state="listening" />);
    expect(screen.getByRole('img')).toHaveClass('listening');
  });
});
```

#### Hook Testing
```typescript
// Custom hook testing
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

describe('useSpeechRecognition', () => {
  it('starts and stops listening', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.startListening();
    });

    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.stopListening();
    });

    expect(result.current.isListening).toBe(false);
  });
});
```

#### Integration Testing
```typescript
// API route testing
import { createMocks } from 'node-mocks-http';
import handler from '../pages/api/ask';

describe('/api/ask', () => {
  it('returns 400 for missing question', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {},
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Question is required'
    });
  });
});
```

### Testing Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- CharacterCompanion.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="renders"
```

## 🔍 Debugging Techniques

### Chrome DevTools

#### React Developer Tools
1. Install React Developer Tools extension
2. Inspect component hierarchy
3. Monitor component state and props
4. Profile component performance

#### Performance Profiling
```typescript
// Performance monitoring
const startPerformanceTrace = (name: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.time(name);
  }
};

const endPerformanceTrace = (name: string) => {
  if (process.env.NODE_ENV === 'development') {
    console.timeEnd(name);
  }
};

// Usage
startPerformanceTrace('AI Response Processing');
// ... processing logic ...
endPerformanceTrace('AI Response Processing');
```

### Console Debugging

#### Structured Logging
```typescript
// Debug logging utility
const logger = {
  debug: (message: string, data?: unknown) => {
    if (process.env.NEXT_PUBLIC_DEBUG_MODE === 'true') {
      console.debug(`[DEBUG] ${message}`, data);
    }
  },

  error: (message: string, error?: Error) => {
    console.error(`[ERROR] ${message}`, error);
  },

  info: (message: string, data?: unknown) => {
    console.info(`[INFO] ${message}`, data);
  }
};

// Usage
logger.debug('Processing user input', { text: userInput });
logger.error('Failed to process audio', new Error('Audio API error'));
```

## ⚡ Performance Optimization

### Code Splitting

#### Dynamic Imports
```typescript
// Lazy load components
const MiniGame = React.lazy(() => import('../components/MiniGame'));
const PatternPuzzleGame = React.lazy(() => import('../components/PatternPuzzleGame'));

// Usage with Suspense
const GameContainer = () => (
  <Suspense fallback={<div>Loading game...</div>}>
    <MiniGame />
  </Suspense>
);
```

#### Bundle Analysis
```bash
# Analyze bundle size
npm run bundle-analyzer
```

### Image Optimization

```typescript
import Image from 'next/image';

// Good: Next.js Image component
<CharacterImage
  src="/character.png"
  alt="AI Buddy character"
  width={200}
  height={200}
  priority
/>

// Avoid: Regular img tag
<img src="/character.png" alt="AI Buddy character" width="200" height="200" />
```

## 🔒 Security Best Practices

### Input Validation

```typescript
// Validate user input
const validateUserInput = (input: string): string => {
  // Remove HTML tags
  const sanitized = input.replace(/<[^>]*>/g, '');

  // Limit length
  if (sanitized.length > 1000) {
    throw new Error('Input too long');
  }

  // Check for inappropriate content
  if (containsInappropriateContent(sanitized)) {
    throw new Error('Inappropriate content detected');
  }

  return sanitized;
};
```

### API Security

```typescript
// Rate limiting middleware
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
};

// Apply to API routes
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check rate limit
  const clientIP = req.socket.remoteAddress;
  if (isRateLimited(clientIP)) {
    return res.status(429).json({ error: rateLimit.message });
  }

  // API logic
}
```

## ♿ Accessibility Guidelines

### ARIA Attributes

```typescript
// Good accessibility practice
<button
  aria-label="Start voice recording"
  aria-pressed={isRecording}
  role="button"
  onClick={handleRecord}
>
  {isRecording ? 'Stop' : 'Start'}
</button>

// Screen reader friendly announcements
const announceToScreenReader = (message: string) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};
```

### Keyboard Navigation

```typescript
// Keyboard event handling
const handleKeyDown = (event: React.KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleAction();
  }

  if (event.key === 'Escape') {
    handleCancel();
  }
};

// Focus management
const trapFocus = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};
```

## 🚀 Deployment Workflow

### Build Process

```bash
# Development build
npm run build

# Production build with optimizations
npm run build:production

# Export static files
npm run export
```

### Environment-Specific Builds

```typescript
// next.config.js
const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  env: {
    CUSTOM_KEY: isProduction
      ? process.env.PRODUCTION_KEY
      : process.env.DEVELOPMENT_KEY,
  },
  // Other Next.js config
};
```

## 🐛 Troubleshooting Common Issues

### Development Issues

#### TypeScript Errors
```bash
# Clear TypeScript cache
rm -rf .next/types
npm run type-check

# Update TypeScript types
npm install --save-dev @types/node@latest
```

#### Build Failures
```bash
# Clear Next.js cache
rm -rf .next
npm run build

# Check for memory issues
node --max-old-space-size=4096 node_modules/.bin/next build
```

#### Hot Reload Issues
```bash
# Restart development server
# Check for syntax errors in modified files
# Verify all imports are correct
```

### Runtime Issues

#### Audio Problems
```typescript
// Audio context troubleshooting
const initAudioContext = async () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();

    // Handle user interaction requirement
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    return audioContext;
  } catch (error) {
    console.error('Failed to initialize AudioContext:', error);
    return null;
  }
};
```

#### Memory Leaks
```typescript
// Proper cleanup in useEffect
useEffect(() => {
  const timer = setInterval(() => {
    // Periodic task
  }, 1000);

  return () => {
    clearInterval(timer);
    // Cleanup other resources
  };
}, []);
```

## 📚 Resources and References

### Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://reactjs.org/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Tools and Utilities
- [VS Code](https://code.visualstudio.com/)
- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools)
- [React Developer Tools](https://react-devtools-tutorial.now.sh/)
- [Postman](https://www.postman.com/) (for API testing)

### Community
- [Next.js GitHub](https://github.com/vercel/next.js)
- [React GitHub](https://github.com/facebook/react)
- [Stack Overflow](https://stackoverflow.com/)
- [Discord Communities](https://discord.gg/nextjs)

---

This developer guide provides the foundation for contributing to the Kid-Friendly AI Buddy project. For specific questions or issues, please refer to the project's GitHub repository or contact the development team.