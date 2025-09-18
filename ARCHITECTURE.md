# Kid-Friendly AI Buddy - Architecture Documentation

## 🏗️ System Architecture Overview

Kid-Friendly AI Buddy is built using a modern, scalable architecture that prioritizes performance, security, and maintainability. The system follows a component-based architecture with clear separation of concerns.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   UI        │  │   State     │  │   Hooks     │            │
│  │ Components  │  │ Management  │  │ & Utils     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│                    API Layer (Next.js API Routes)               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   /api/ask  │  │   /api/tts  │  │   /api/...  │            │
│  │   (AI Chat) │  │  (Speech)   │  │  (Other)    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│                    External Services                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  OpenRouter │  │  Browser    │  │  Service    │            │
│  │    API      │  │   APIs      │  │   Worker    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│                    Data & Storage                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  IndexedDB  │  │  Local      │  │  Session    │            │
│  │ (Offline)   │  │  Storage    │  │  Storage    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
src/
├── components/                    # React Components
│   ├── CharacterCompanion.tsx    # Animated AI buddy character
│   ├── SpeechControls.tsx        # Voice input/output controls
│   ├── MiniGame.tsx             # Educational mini-games
│   ├── PatternPuzzleGame.tsx     # Pattern matching puzzles
│   ├── AnimalGame.tsx           # Animal learning game
│   ├── SoundControls.tsx        # Audio management
│   ├── OfflineIndicator.tsx     # Connection status display
│   ├── ErrorBoundary.tsx        # Error handling component
│   └── ...                      # Other UI components
├── pages/                        # Next.js Pages
│   ├── api/                     # API Routes
│   │   ├── ask.ts              # AI conversation endpoint
│   │   ├── tts.ts               # Text-to-speech endpoint
│   │   ├── transcribe.ts        # Speech-to-text endpoint
│   │   └── health.ts           # Health check endpoint
│   ├── index.tsx                # Main application page
│   └── _app.tsx                 # Application wrapper
├── utils/                        # Utility Functions
│   ├── aiPrompt.ts              # AI prompt management
│   ├── soundManager.ts          # Audio system management
│   ├── accessibility.ts         # Accessibility utilities
│   ├── offlineManager.ts        # Offline functionality
│   ├── analyticsManager.ts      # Analytics system
│   └── ...                      # Other utilities
├── hooks/                        # Custom React Hooks
│   ├── useSpeechRecognition.ts  # Speech recognition hook
│   ├── useOfflineManager.ts     # Offline management hook
│   ├── useSoundEffects.ts       # Sound effects hook
│   ├── useAnalytics.ts          # Analytics tracking hook
│   └── ...                      # Other hooks
├── types/                        # TypeScript Definitions
│   ├── index.ts                 # Main type definitions
│   ├── api.ts                   # API-related types
│   ├── component.ts             # Component prop types
│   └── ...                      # Other type files
└── styles/                       # CSS Styles
    ├── global.css               # Global styles
    └── components/              # Component-specific styles
```

## 🔄 Component Architecture

### Core Components

#### 1. Main Application (`src/pages/index.tsx`)
- **Purpose**: Root component orchestrating all functionality
- **Key Features**:
  - State management for conversation flow
  - Audio context management
  - Character state coordination
  - Game mode switching
  - Error handling and recovery

#### 2. SpeechControls (`src/components/SpeechControls.tsx`)
- **Purpose**: Voice input/output interface
- **Key Features**:
  - Speech recognition management
  - Text-to-speech integration
  - Language selection
  - Privacy mode toggle
  - Visual feedback for voice activity

#### 3. CharacterCompanion (`src/components/CharacterCompanion.tsx`)
- **Purpose**: Visual representation of AI buddy
- **Key Features**:
  - State-based animations (idle, listening, thinking, speaking, excited)
  - Emotional responses to interactions
  - Visual effects and particles
  - Responsive design

#### 4. Game Components
- **MiniGame**: Base educational game interface
- **PatternPuzzleGame**: Cognitive skill development
- **AnimalGame**: Wildlife education and exploration
- **Shared Features**: Progress tracking, reward systems, accessibility

### Component Relationships

```
index.tsx (Main App)
├── SpeechControls
│   ├── VoiceButton
│   ├── LanguageSelector
│   └── PrivacyToggle
├── CharacterCompanion
│   ├── CharacterAnimation
│   └── VisualEffects
├── GameContainer
│   ├── MiniGame
│   ├── PatternPuzzleGame
│   └── AnimalGame
├── SoundControls
├── OfflineIndicator
└── ErrorBoundary
```

## 🔄 Data Flow Architecture

### State Management Flow

```
User Input → SpeechControls → Audio Processing → API Call → AI Response
                                                                    ↓
State Update → Character Animation → Audio Playback → UI Update → User Feedback
```

### Conversation Flow

1. **Input Phase**:
   - User clicks microphone button
   - Speech recognition activates
   - Audio recorded and processed
   - Text transcribed

2. **Processing Phase**:
   - Text sent to `/api/ask` endpoint
   - OpenRouter API processes request
   - Response streamed back to client

3. **Output Phase**:
   - Response displayed in chat interface
   - Character animates based on content
   - Text sent to `/api/tts` for audio
   - Audio played through Web Audio API

### Game Flow

1. **Game Selection**: User chooses game type
2. **Game Initialization**: Game component loads with proper state
3. **Interaction Loop**: User interacts → Game processes → Feedback provided
4. **Progress Tracking**: Scores and achievements recorded
5. **Completion**: Rewards given, statistics updated

## 🛠️ API Architecture

### API Endpoints

#### `/api/ask` - AI Conversation
- **Method**: POST
- **Purpose**: Process user questions and return AI responses
- **Features**:
  - Server-Sent Events (SSE) for streaming responses
  - Conversation history support
  - Error handling and retry logic
  - Timeout management

```typescript
interface AskRequest {
  question: string;
  conversationHistory?: Array<{
    speaker: 'user' | 'ai';
    text: string;
  }>;
}

interface AskResponse {
  type: 'chunk' | 'done' | 'error';
  content?: string;
  error?: string;
}
```

#### `/api/tts` - Text-to-Speech
- **Method**: POST
- **Purpose**: Convert text to speech audio
- **Features**:
  - Multiple voice options
  - Audio streaming
  - Format optimization
  - Error recovery

```typescript
interface TTSRequest {
  text: string;
  voice?: string;
  language?: string;
}

interface TTSResponse {
  audioData: ArrayBuffer;
  format: 'mp3' | 'wav';
}
```

#### `/api/transcribe` - Speech-to-Text
- **Method**: POST
- **Purpose**: Convert speech audio to text
- **Features**:
  - Multiple audio format support
  - Language detection
  - Noise filtering
  - Confidence scoring

#### `/api/health` - Health Check
- **Method**: GET
- **Purpose**: Monitor system health and performance
- **Features**:
  - Service availability checks
  - Performance metrics
  - Dependency health
  - Error rate monitoring

### External API Integration

#### OpenRouter API
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Model**: `google/gemini-2.5-flash-lite`
- **Authentication**: Bearer token via API key
- **Features**:
  - Streaming responses
  - Conversation history
  - Temperature and token control
  - Fallback models

## 🗄️ Data Architecture

### Client-Side Storage

#### IndexedDB (Offline Storage)
- **Purpose**: Store data for offline functionality
- **Data Types**:
  - Conversation history
  - Game progress
  - User preferences
  - Cached responses
- **Schema**:
  ```typescript
  interface OfflineData {
    conversations: Conversation[];
    gameProgress: GameProgress[];
    preferences: UserPreferences;
    cache: ResponseCache[];
  }
  ```

#### Local Storage
- **Purpose**: Simple key-value storage
- **Data Types**:
  - User preferences
  - UI settings
  - Authentication tokens
  - Feature flags

#### Session Storage
- **Purpose**: Temporary session data
- **Data Types**:
  - Current conversation state
  - Temporary game data
  - Authentication state
  - UI state

### Data Models

#### Conversation Model
```typescript
interface Conversation {
  id: string;
  messages: Message[];
  timestamp: Date;
  language: string;
  session_id: string;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
  audio_url?: string;
  metadata?: {
    sentiment?: string;
    topics?: string[];
    game_related?: boolean;
  };
}
```

#### Game Progress Model
```typescript
interface GameProgress {
  game_id: string;
  user_id: string;
  level: number;
  score: number;
  achievements: Achievement[];
  last_played: Date;
  play_count: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at: Date;
}
```

#### User Preferences Model
```typescript
interface UserPreferences {
  language: string;
  voice_speed: number;
  audio_volume: number;
  theme: 'light' | 'dark' | 'auto';
  privacy_mode: 'local' | 'cloud';
  accessibility: {
    high_contrast: boolean;
    large_text: boolean;
    screen_reader: boolean;
  };
  parental_controls: {
    content_filter: boolean;
    time_limits: boolean;
    daily_limit_minutes?: number;
  };
}
```

## 🔧 Technical Architecture

### Frontend Stack

#### Next.js 14
- **Framework**: React with server-side rendering
- **Features**:
  - API routes for backend functionality
  - Static site generation
  - Image optimization
  - Built-in CSS support

#### TypeScript
- **Type Safety**: Strict type checking enabled
- **Features**:
  - Interface definitions
  - Generic types
  - Decorator support
  - Advanced type inference

#### Tailwind CSS
- **Styling**: Utility-first CSS framework
- **Features**:
  - Responsive design
  - Dark mode support
  - Custom themes
  - Performance optimized

#### React Hooks
- **State Management**: Custom hooks for complex state
- **Built-in Hooks**: useState, useEffect, useContext, useMemo
- **Custom Hooks**:
  - `useSpeechRecognition()`
  - `useOfflineManager()`
  - `useSoundEffects()`
  - `useAnalytics()`

### Audio Architecture

#### Web Audio API
- **Purpose**: High-quality audio processing
- **Components**:
  - AudioContext for audio graph management
  - AudioBufferSourceNode for playback
  - GainNode for volume control
  - AnalyserNode for visualization

#### Audio Processing Pipeline
```
Audio Input → Noise Reduction → Volume Normalization → Format Conversion → Storage
                                                                     ↓
Retrieval → Audio Buffer → Volume Control → Spatial Audio → Output Device
```

### Security Architecture

#### Input Validation
- **Client-side**: React prop validation and form validation
- **Server-side**: Next.js API route validation
- **Sanitization**: XSS prevention and content filtering

#### Authentication & Authorization
- **API Keys**: Secure environment variable management
- **Rate Limiting**: Request throttling and abuse prevention
- **CORS**: Cross-origin resource sharing configuration

#### Data Protection
- **Encryption**: HTTPS for all communications
- **Privacy**: Minimal data collection and anonymization
- **Compliance**: COPPA and GDPR adherence

## 📊 Performance Architecture

### Optimization Strategies

#### Code Splitting
- **Dynamic Imports**: Component-level code splitting
- **Route-based Splitting**: Separate bundles for routes
- **Library Splitting**: Vendor code separation

#### Caching Strategy
- **Service Worker**: Offline functionality and caching
- **Browser Cache**: Static asset caching
- **CDN**: Global content delivery

#### Performance Monitoring
- **Lighthouse**: Performance audits
- **Web Vitals**: Core web metrics tracking
- **Custom Metrics**: Application-specific performance data

### Load Balancing

#### Static Assets
- **CDN Distribution**: Global asset delivery
- **Image Optimization**: Responsive images and formats
- **Font Loading**: Optimal font loading strategies

#### API Requests
- **Request Batching**: Multiple requests combined
- **Debouncing**: Input event optimization
- **Memoization**: Result caching

## 🔄 Integration Patterns

### Component Communication

#### Props and Callbacks
- **Parent-Child**: Direct prop passing
- **Child-Parent**: Callback functions
- **Context API**: Global state sharing

#### Event System
- **Custom Events**: Component communication
- **Global Events**: Cross-component notifications
- **DOM Events**: Browser interaction handling

### Data Flow Patterns

#### Unidirectional Data Flow
- **State Down**: Props passed to children
- **Actions Up**: Events bubble up
- **State Management**: Centralized state stores

#### Side Effect Management
- **useEffect**: Async operations
- **Event Listeners**: DOM interactions
- **Subscriptions**: External data sources

## 🚀 Scalability Architecture

### Horizontal Scaling

#### Frontend Scaling
- **Static Generation**: Pre-rendered pages
- **Edge Computing**: Global deployment
- **CDN Distribution**: Asset delivery

#### Backend Scaling
- **Serverless Functions**: Auto-scaling API routes
- **Database Scaling**: Connection pooling and optimization
- **Cache Layer**: Response caching and optimization

### Vertical Scaling

#### Performance Optimization
- **Bundle Analysis**: Code optimization
- **Memory Management**: Leak prevention
- **CPU Optimization**: Algorithm efficiency

#### Resource Management
- **Lazy Loading**: Component and data loading
- **Image Optimization**: Responsive images
- **Font Optimization**: Loading strategies

## 🛡️ Error Handling Architecture

### Error Boundaries

#### React Error Boundaries
- **Component Isolation**: Prevent cascade failures
- **Graceful Degradation**: Fallback UI components
- **Error Reporting**: Automatic error logging

#### Global Error Handling
- **Window Error Events**: Uncaught exception handling
- **Promise Rejection**: Unhandled promise rejection
- **Resource Errors**: Failed resource loading

### Recovery Strategies

#### Automatic Recovery
- **Retry Logic**: Failed request retry
- **Fallback Data**: Default data when APIs fail
- **Connection Recovery**: Offline mode activation

#### User Communication
- **Error Messages**: Clear, user-friendly error display
- **Recovery Actions**: User-initiated recovery options
- **Help Resources**: Links to support documentation

## 📈 Monitoring & Analytics

### Performance Monitoring

#### Real-time Metrics
- **Response Times**: API and page load times
- **Error Rates**: Application error tracking
- **User Engagement**: Interaction metrics

#### Historical Data
- **Trend Analysis**: Performance over time
- **Usage Patterns**: User behavior analysis
- **Bottleneck Identification**: Performance issue detection

### User Analytics

#### Privacy-Focused Analytics
- **Anonymous Tracking**: No personal identifiers
- **Session Analysis**: User session behavior
- **Feature Usage**: Component and feature usage

#### Business Metrics
- **User Retention**: Return usage analysis
- **Feature Adoption**: New feature usage
- **Performance Goals**: Success metrics tracking

## 🔮 Future Architecture Considerations

### Microservices Architecture
- **Service Separation**: Independent service deployment
- **API Gateway**: Centralized API management
- **Service Discovery**: Dynamic service routing

### Event-Driven Architecture
- **Event Sourcing**: Audit trail and replay capability
- **Message Queues**: Async processing and reliability
- **Event Streaming**: Real-time data processing

### Advanced Features
- **Multi-tenancy**: Multiple user support
- **Internationalization**: Global language support
- **Mobile Apps**: React Native development
- **AI Enhancement**: Advanced AI capabilities

---

This architecture documentation provides a comprehensive overview of the Kid-Friendly AI Buddy system. The architecture is designed to be scalable, maintainable, and secure while providing an excellent user experience for children.