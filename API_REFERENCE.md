# Kid-Friendly AI Buddy - API Reference

This document provides comprehensive documentation for all API endpoints in the Kid-Friendly AI Buddy application.

## 📋 Overview

The Kid-Friendly AI Buddy exposes several API endpoints for:
- AI conversation processing
- Text-to-speech conversion
- Speech-to-text transcription
- Health monitoring
- Analytics tracking

All endpoints are built using Next.js API Routes and follow RESTful conventions.

## 🔐 Authentication

### API Key Authentication
All API endpoints require authentication using the OpenRouter API key.

**Header**: `Authorization: Bearer <OPENROUTER_API_KEY>`

### Environment Variables
```env
OPENROUTER_API_KEY=your_api_key_here
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 📊 API Endpoints

### 1. AI Conversation Endpoint

#### POST `/api/ask`

Process user questions and return AI responses via Server-Sent Events (SSE).

**Description**:
- Processes user questions with conversation history
- Returns streaming responses from OpenRouter API
- Supports multiple languages and age-appropriate content
- Includes error handling and timeout management

**Request Body**:
```typescript
interface AskRequest {
  question: string;                    // User's question (required)
  conversationHistory?: HistoryMessage[]; // Optional conversation history
}

interface HistoryMessage {
  speaker: 'user' | 'ai';             // Message speaker
  text: string;                        // Message content
}
```

**Response Format**: Server-Sent Events (SSE)

**Event Types**:
```typescript
interface ChunkEvent {
  id: string | number;
  data: {
    type: 'chunk';
    content: string;                   // Partial response content
  };
}

interface DoneEvent {
  id: string | number;
  data: {
    type: 'done';                      // Stream completed
  };
}

interface ErrorEvent {
  id: string | number;
  data: {
    type: 'error';
    content: string;                   // Error message
  };
}
```

**Example Request**:
```javascript
const response = await fetch('/api/ask', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    question: "What's the weather like today?",
    conversationHistory: [
      { speaker: 'user', text: "Hello!" },
      { speaker: 'ai', text: "Hi there! How can I help you?" }
    ]
  })
});

// Handle SSE stream
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Process SSE events
}
```

**Response Codes**:
- `200 OK`: Successful streaming response
- `400 Bad Request`: Missing or invalid question
- `401 Unauthorized`: Invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

**Rate Limiting**:
- 100 requests per 15 minutes per IP
- Burst protection with exponential backoff

---

### 2. Text-to-Speech Endpoint

#### POST `/api/tts`

Convert text to speech audio using synthesized voices.

**Description**:
- Converts text to natural-sounding speech
- Supports multiple languages and voice options
- Returns optimized audio files
- Includes caching for repeated requests

**Request Body**:
```typescript
interface TTSRequest {
  text: string;                        // Text to convert (required)
  voice?: string;                      // Voice identifier (optional)
  language?: string;                   // Language code (optional)
  speed?: number;                      // Speech rate 0.5-2.0 (optional)
}
```

**Response Body**:
```typescript
interface TTSResponse {
  audioData: ArrayBuffer;             // Audio buffer
  format: 'mp3' | 'wav';              // Audio format
  duration: number;                    // Duration in seconds
  sampleRate: number;                 // Audio sample rate
}
```

**Example Request**:
```javascript
const response = await fetch('/api/tts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: "Hello! I'm your AI buddy!",
    voice: "default",
    language: "en-US",
    speed: 1.0
  })
});

const audioData = await response.arrayBuffer();
const audioContext = new AudioContext();
const audioBuffer = await audioContext.decodeAudioData(audioData);
```

**Query Parameters**:
- `?voice=default` - Specify voice
- `?language=en-US` - Specify language
- `?speed=1.0` - Adjust speech speed

**Response Codes**:
- `200 OK`: Successful audio generation
- `400 Bad Request`: Missing or invalid text
- `413 Payload Too Large`: Text too long
- `500 Internal Server Error`: TTS service error

**Supported Languages**:
- `en-US` - English (US)
- `es-ES` - Spanish (Spain)
- `fr-FR` - French (France)
- `de-DE` - German (Germany)
- `zh-CN` - Chinese (Simplified)

---

### 3. Speech-to-Text Endpoint

#### POST `/api/transcribe`

Convert speech audio to text using speech recognition.

**Description**:
- Transcribes audio files to text
- Supports multiple audio formats
- Includes noise reduction and filtering
- Returns confidence scores and timing information

**Request Body**:
```typescript
interface TranscribeRequest {
  audioData: ArrayBuffer;             // Audio buffer (required)
  format: 'wav' | 'mp3' | 'webm';     // Audio format
  language?: string;                   // Language code (optional)
  enablePunctuation?: boolean;        // Enable punctuation (optional)
}
```

**Response Body**:
```typescript
interface TranscribeResponse {
  text: string;                        // Transcribed text
  confidence: number;                  // Confidence score 0-1
  segments: Array<{
    text: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
  languageDetected: string;            // Detected language
  processingTime: number;              // Processing time in ms
}
```

**Example Request**:
```javascript
// Get audio from microphone
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mediaRecorder = new MediaRecorder(stream);
const audioChunks = [];

mediaRecorder.ondataavailable = (event) => {
  audioChunks.push(event.data);
};

mediaRecorder.start();
// ... stop recording after some time
mediaRecorder.stop();

const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
const audioData = await audioBlob.arrayBuffer();

const response = await fetch('/api/transcribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    audioData: Array.from(new Uint8Array(audioData)),
    format: 'wav',
    language: 'en-US',
    enablePunctuation: true
  })
});

const result = await response.json();
console.log('Transcribed text:', result.text);
```

**Response Codes**:
- `200 OK`: Successful transcription
- `400 Bad Request`: Invalid audio data
- `415 Unsupported Media Type`: Unsupported audio format
- `500 Internal Server Error`: Transcription service error

---

### 4. Health Check Endpoint

#### GET `/api/health`

Monitor system health and performance metrics.

**Description**:
- Provides system health status
- Returns performance metrics
- Checks external service availability
- Includes uptime and version information

**Response Body**:
```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'up' | 'down' | 'degraded';
    openRouter: 'up' | 'down' | 'degraded';
    cache: 'up' | 'down' | 'degraded';
  };
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    responseTime: number;
    activeConnections: number;
  };
  checks: {
    database: boolean;
    openRouter: boolean;
    cache: boolean;
  };
}
```

**Example Request**:
```javascript
const response = await fetch('/api/health');
const health = await response.json();

if (health.status === 'healthy') {
  console.log('All systems operational');
} else {
  console.warn('System issues detected:', health.services);
}
```

**Response Codes**:
- `200 OK`: Health check successful
- `503 Service Unavailable**: Service unavailable

---

### 5. Analytics Endpoint

#### POST `/api/analytics`

Track usage analytics and user interactions (privacy-focused).

**Description**:
- Tracks anonymous usage analytics
- Respects user privacy settings
- Provides usage insights
- Supports custom events

**Request Body**:
```typescript
interface AnalyticsRequest {
  eventType: string;                   // Event type (required)
  eventData?: Record<string, unknown>; // Event data (optional)
  userId?: string;                     // Anonymous user ID (optional)
  sessionId: string;                   // Session ID (required)
  timestamp: number;                   // Event timestamp (optional)
}
```

**Response Body**:
```typescript
interface AnalyticsResponse {
  success: boolean;
  eventId: string;
  processed: boolean;
}
```

**Example Request**:
```javascript
const response = await fetch('/api/analytics', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    eventType: 'game_completed',
    eventData: {
      gameId: 'pattern-puzzle',
      duration: 120,
      score: 85
    },
    sessionId: 'session_123',
    timestamp: Date.now()
  })
});

const result = await response.json();
```

**Event Types**:
- `conversation_started` - User started conversation
- `game_started` - User started a game
- `game_completed` - User completed a game
- `achievement_unlocked` - User earned achievement
- `error_occurred` - Application error occurred

**Response Codes**:
- `200 OK`: Analytics event recorded
- `400 Bad Request`: Invalid event data
- `403 Forbidden`: Analytics disabled

---

## 🔧 Common Error Responses

### Standard Error Format
```typescript
interface ErrorResponse {
  error: string;                       // Error message
  code: string;                        // Error code
  details?: Record<string, unknown>;   // Additional error details
  timestamp: string;                   // Error timestamp
  requestId: string;                  // Request ID for debugging
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Invalid request format |
| `MISSING_PARAMETER` | 400 | Required parameter missing |
| `INVALID_API_KEY` | 401 | Invalid or missing API key |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVICE_UNAVAILABLE` | 503 | External service unavailable |
| `INTERNAL_ERROR` | 500 | Internal server error |

### Error Response Example
```json
{
  "error": "API key is required",
  "code": "INVALID_API_KEY",
  "details": {
    "service": "OpenRouter",
    "required": true
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_123456789"
}
```

## 🔄 Rate Limiting

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
Retry-After: 60
```

### Rate Limit Response
```typescript
interface RateLimitResponse {
  error: string;
  code: 'RATE_LIMITED';
  retryAfter: number;                  // Seconds to wait
  limit: number;                       // Request limit
  remaining: number;                   // Remaining requests
  resetTime: string;                   // Reset timestamp
}
```

## 🛡️ Security Considerations

### Input Validation
All inputs are validated and sanitized:
- SQL injection prevention
- XSS protection
- Command injection prevention
- Content length limits

### Data Privacy
- No personal data collection
- Anonymous analytics only
- Optional user privacy settings
- GDPR and COPPA compliant

### CORS Configuration
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
        ],
      },
    ];
  },
};
```

## 🧪 Testing APIs

### Testing with curl

**Test Conversation API**:
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"Hello, how are you?"}'
```

**Test TTS API**:
```bash
curl -X POST http://localhost:3000/api/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from the API!"}' \
  --output response.mp3
```

**Test Health Check**:
```bash
curl http://localhost:3000/api/health
```

### Testing with JavaScript

```javascript
// API Client Helper
class KidFriendlyAIClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async ask(question, conversationHistory = []) {
    const response = await fetch(`${this.baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, conversationHistory })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return this.handleStream(response);
  }

  async handleStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));
          if (data.type === 'chunk') {
            fullResponse += data.content;
          } else if (data.type === 'error') {
            throw new Error(data.content);
          }
        }
      }
    }

    return fullResponse;
  }
}

// Usage
const client = new KidFriendlyAIClient();
const response = await client.ask("What's your favorite color?");
console.log(response);
```

## 📚 SDK Documentation

### React Hooks

#### useConversation Hook
```typescript
const useConversation = () => {
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (message: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: message,
          conversationHistory: conversation
        })
      });

      // Handle streaming response
      const aiResponse = await handleStreamResponse(response);

      setConversation(prev => [
        ...prev,
        { type: 'user', text: message },
        { type: 'ai', text: aiResponse }
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return { conversation, sendMessage, isLoading, error };
};
```

#### useTTS Hook
```typescript
const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const speak = async (text: string, options = {}) => {
    setIsSpeaking(true);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, ...options })
      });

      const audioData = await response.arrayBuffer();

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (err) {
      console.error('TTS Error:', err);
      setIsSpeaking(false);
    }
  };

  return { speak, isSpeaking };
};
```

## 🔄 Webhooks

### Event Webhooks (Future Feature)

The system will support webhooks for real-time event notifications:

```typescript
interface WebhookEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature: string;  // HMAC signature
}
```

**Supported Events**:
- `conversation.completed`
- `game.completed`
- `user.achievement`
- `system.error`

---

This API reference provides comprehensive documentation for all endpoints in the Kid-Friendly AI Buddy application. For additional support or questions, please refer to the project repository or contact the development team.