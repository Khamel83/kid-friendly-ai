import { systemPrompt, cloudModeRestrictions } from './aiPrompt';

const MACMINI_OLLAMA_URL = 'http://macmini.local:11434';
const LOCAL_MODEL = 'gemma4:e4b';
const LOCAL_TIMEOUT = 60000; // 60s for local LLM (slower than cloud)

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onChunk: (content: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

/**
 * Send a chat request either to Mac Mini Ollama (local) or Vercel /api/ask (cloud).
 */
export async function streamChat(
  question: string,
  conversationHistory: { speaker: 'user' | 'ai'; text: string }[],
  mode: 'local' | 'cloud',
  callbacks: StreamCallbacks
): Promise<void> {
  // Keep only recent history (last 6 messages)
  const history = conversationHistory.slice(-6);

  if (mode === 'local') {
    await streamLocal(question, history, callbacks);
  } else {
    await streamCloud(question, history, callbacks);
  }
}

async function streamLocal(
  question: string,
  history: { speaker: 'user' | 'ai'; text: string }[],
  callbacks: StreamCallbacks
): Promise<void> {
  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(msg => ({
      role: (msg.speaker === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: msg.text,
    })),
    { role: 'user', content: question },
  ];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOCAL_TIMEOUT);

    const response = await fetch(`${MACMINI_OLLAMA_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_MODEL,
        messages,
        temperature: 1.0,
        max_tokens: 500,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      callbacks.onError(`Local AI error: ${response.status}`);
      return;
    }

    await parseSSEStream(response, callbacks);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      callbacks.onError('Local AI timed out. Try again!');
    } else {
      callbacks.onError('Could not reach Buddy. Try again!');
    }
  }
}

async function streamCloud(
  question: string,
  history: { speaker: 'user' | 'ai'; text: string }[],
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, conversationHistory: history }),
    });

    if (!response.ok) {
      callbacks.onError(`Cloud AI error: ${response.status}`);
      return;
    }

    await parseSSEStream(response, callbacks);
  } catch (err) {
    callbacks.onError('Something went wrong. Try again!');
  }
}

/**
 * Parse an SSE stream from either Ollama or Vercel /api/ask.
 * Both use the same OpenAI-compatible SSE format.
 */
async function parseSSEStream(
  response: Response,
  callbacks: StreamCallbacks
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response stream');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const data = line.substring(5).trim();
          if (data === '[DONE]') {
            callbacks.onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            // Handle both Ollama format and Vercel /api/ask format
            const content = parsed.choices?.[0]?.delta?.content
              || parsed.content
              || '';
            if (content) {
              callbacks.onChunk(content);
            }
            if (parsed.type === 'done') {
              callbacks.onDone();
              return;
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }
    }
    callbacks.onDone();
  } catch (err) {
    callbacks.onError('Stream interrupted');
  }
}
