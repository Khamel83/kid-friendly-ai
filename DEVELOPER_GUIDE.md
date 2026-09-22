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
## 🍎 Apple/Container Development Workflow

### Overview

**Important:** This workflow is an **optional development and validation path** designed for Apple silicon Macs. It is **not** a replacement for the Docker Compose multi-service stack (which includes Redis and Nginx) or Linux/systemd production deployments. This workflow provides a lightweight way to validate the application in a containerized environment on macOS.

### Prerequisites

- **Hardware:** Apple silicon Mac (M1, M2, M3, M4, or later)
- **OS:** macOS 26 or newer (verified minimum version)
- **Docker Desktop:** Latest version with support for Apple silicon
- **CLI Tools:** Standard Unix tools (curl, bash)

### Installation and Service Setup

#### 1. Obtain the Signed Apple/Container Release

The Kid-Friendly AI project provides signed, pre-built container images optimized for Apple silicon. These are available through the project's GitHub releases:

```bash
# Download the latest signed Apple/container release
# Navigate to: https://github.com/Khamel83/kid-friendly-ai/releases
# Look for releases tagged with "apple-container" or the latest release with Apple/container support

# Install or pull the pre-built image from the container registry
docker pull ghcr.io/Khamel83/kid-friendly-ai:latest-arm64
```

#### 2. Start the Application Service

There are two ways to run the application: as a one-off container or as a launchd service for persistent operation.

**Option A: Interactive Container (Development)**

```bash
# Set up environment variables from your .env.local
export OPENROUTER_API_KEY=your_key_here
export OPENAI_API_KEY=your_key_here
export NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Run the application container
docker run -it \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOSTNAME=0.0.0.0 \
  -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
  ghcr.io/Khamel83/kid-friendly-ai:latest-arm64
```

**Option B: System Service (Persistent)**

To run the application as a macOS system service using launchd, create a service definition file:

```bash
# Create launchd service directory
mkdir -p "$HOME/Library/LaunchAgents"

# Create the service definition
cat > "$HOME/Library/LaunchAgents/com.khamel.buddy-app.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.khamel.buddy-app</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/docker</string>
    <string>run</string>
    <string>--rm</string>
    <string>-p</string>
    <string>3000:3000</string>
    <string>-e</string>
    <string>NODE_ENV=production</string>
    <string>-e</string>
    <string>PORT=3000</string>
    <string>-e</string>
    <string>HOSTNAME=0.0.0.0</string>
    <string>-e</string>
    <string>OPENROUTER_API_KEY</string>
    <string>-e</string>
    <string>OPENAI_API_KEY</string>
    <string>-e</string>
    <string>NEXT_PUBLIC_SITE_URL=http://localhost:3000</string>
    <string>ghcr.io/Khamel83/kid-friendly-ai:latest-arm64</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <!-- Load from your environment, not embedded in the file -->
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>/var/log/buddy-app-error.log</string>
  <key>StandardOutPath</key>
  <string>/var/log/buddy-app.log</string>
</dict>
</plist>
EOF

# Load the service
launchctl load "$HOME/Library/LaunchAgents/com.khamel.buddy-app.plist"

# Verify it's running
launchctl list | grep com.khamel.buddy-app
```

**Note:** Environment variables must be sourced from your development environment (e.g., `~/.zshrc` or `~/.bash_profile`). Do **not** embed API keys directly in the plist file or commit them to the repository.

### Building the Application Image

To build the `runner` target image locally:

```bash
# Build the runner target for Apple silicon
docker build \
  --platform linux/arm64 \
  --target runner \
  -t kid-friendly-ai:apple-local \
  .
```

### Smoke Test: Focused Application Validation

After starting the application, run the focused smoke test to verify core functionality:

```bash
# 1. Check application port (port 3000)
curl -s http://localhost:3000 | head -20

# 2. Health check endpoint (/api/health)
# The health endpoint returns application status without requiring AI credentials
curl -s http://localhost:3000/api/health | jq '.status'

# Expected response: "healthy"

# 3. AI-independent route check
# Verify the main UI route loads (no AI call required for initial render)
curl -s -H "Accept: application/json" http://localhost:3000/ | head -10

# 4. Full smoke test script
cat > /tmp/smoke-test.sh << 'TESTEOF'
#!/bin/bash
set -e

BASE_URL="http://localhost:3000"

echo "🔍 Running focused smoke test..."

# Test 1: Port connectivity
echo -n "✓ Port 3000 connectivity... "
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|404"; then
  echo "OK"
else
  echo "FAILED"
  exit 1
fi

# Test 2: Health endpoint
echo -n "✓ Health endpoint (/api/health)... "
HEALTH=$(curl -s "$BASE_URL/api/health" | jq '.status' 2>/dev/null || echo "null")
if [ "$HEALTH" == '"healthy"' ]; then
  echo "OK (status: healthy)"
else
  echo "FAILED (status: $HEALTH)"
  exit 1
fi

# Test 3: AI-independent route
echo -n "✓ AI-independent route check... "
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" | grep -q "200"; then
  echo "OK"
else
  echo "FAILED"
  exit 1
fi

echo ""
echo "✅ All smoke tests passed!"
TESTEOF

chmod +x /tmp/smoke-test.sh
/tmp/smoke-test.sh
```

### Environment Variable Handling

Environment variables are loaded from your shell environment, not from committed files:

```bash
# ✅ CORRECT: Load from shell environment
export OPENROUTER_API_KEY=$(cat ~/.config/openrouter-key)
export OPENAI_API_KEY=$(cat ~/.config/openai-key)

docker run -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
           -e OPENAI_API_KEY=$OPENAI_API_KEY \
           ...

# ❌ WRONG: Never embed keys in scripts or config files
docker run -e OPENROUTER_API_KEY=sk-... \
           -e OPENAI_API_KEY=sk-... \
           ...
```

**Best Practice:** Store API keys in secure locations:
- `~/.config/<service>-key` (for development)
- System keychain integration
- macOS Keychain via `security` command

### Known Limitations

This workflow has known limitations to be aware of:

1. **Single-Service Only:** This workflow runs only the Next.js application container. The full Docker Compose lifecycle (including Redis for caching, Nginx for reverse proxy, Prometheus/Grafana for monitoring) is **not** covered.

2. **No Redis Integration:** Caching features that depend on Redis are not available in this workflow. The application will operate with in-memory caching only.

3. **No Nginx Reverse Proxy:** The application runs directly on port 3000. SSL termination and rate limiting via Nginx are not available.

4. **Development/Validation Only:** This workflow is intended for local development and validation on Apple silicon. It is **not** a replacement for the Linux/systemd production deployment path for server environments.

5. **No Monitoring Stack:** Prometheus and Grafana monitoring are not included in this workflow.

### Stopping and Troubleshooting

```bash
# Stop the service
launchctl unload "$HOME/Library/LaunchAgents/com.khamel.buddy-app.plist"

# View logs
tail -f /var/log/buddy-app.log
tail -f /var/log/buddy-app-error.log

# Verify container is running
docker ps | grep kid-friendly-ai

# Check application health
curl -s http://localhost:3000/api/health | jq .

# Stop running container directly
docker stop $(docker ps -q -f ancestor=ghcr.io/Khamel83/kid-friendly-ai:latest-arm64)
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