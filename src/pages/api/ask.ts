import { NextApiRequest, NextApiResponse } from 'next';
import { systemPrompt, formatUserQuestion } from '../../utils/aiPrompt';
// Removed OpenAI import as it's no longer used here for chat
// import OpenAI from 'openai'; 

// Define a type for the messages in the conversation history
interface HistoryMessage {
  speaker: 'user' | 'ai';
  text: string;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- Read question AND history from body ---
    const { question, conversationHistory } = req.body as { question: string; conversationHistory?: HistoryMessage[] };
    // --- End Read question AND history ---

    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question is required' });
    }

    // --- Use OpenRouter API Key --- 
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OpenRouter API key is not configured');
      return res.status(500).json({ error: 'API key is not configured' });
    }
    // --- End Use OpenRouter API Key --- 

    console.log(`Sending streaming request to OpenRouter for question: "${question.substring(0, 50)}..." with history length: ${conversationHistory?.length ?? 0}`);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 

    let timeoutId: NodeJS.Timeout | undefined;
    
    // --- Main try block for fetch and stream processing ---
    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 15000); 

        // --- Format LLM messages with history ---
        const llmMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
          { role: 'system', content: systemPrompt }
        ];

        if (conversationHistory && conversationHistory.length > 0) {
          conversationHistory.forEach(msg => {
            llmMessages.push({
              role: msg.speaker === 'ai' ? 'assistant' : 'user',
              content: msg.speaker === 'user' ? formatUserQuestion(msg.text) : msg.text
            });
          });
        }

        // Add the current user question last
        llmMessages.push({ role: 'user', content: formatUserQuestion(question) });
        // --- End Format LLM messages ---

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
              'X-Title': 'Kid-Friendly AI Assistant'
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite',
              messages: llmMessages,
              temperature: 0.8,
              max_tokens: 500,
              stream: false,
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        timeoutId = undefined; 

        if (!response.ok) {
            // Handle non-OK initial response (e.g., 401, 429)
            let errorMsg = `OpenRouter Error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error?.message || errorMsg;
            } catch (e) { /* Ignore JSON parse error */ }
            console.error(errorMsg);
            // Send error as JSON
            if (!res.headersSent) {
                res.status(response.status).json({ error: errorMsg });
            }
            return; // Stop processing
        }

        if (!response.body) {
            throw new Error('OpenRouter response body is null');
        }

        // Get the complete response from OpenRouter
        const data = await response.json();
        const aiResponse = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

        // Send simple JSON response
        res.status(200).json({ response: aiResponse });
        console.log('Sent JSON response from /api/ask (OpenRouter)');

    // --- This is the catch block for the *inner* try (fetch/stream) ---
    } catch (innerError) {
      if (timeoutId) {
         clearTimeout(timeoutId);
      }
      // Re-throw the error to be caught by the outer catch block
      throw innerError; 
    }
    // --- End of inner try-catch ---
    
    
  // --- This is the catch block for the *outer* try (setup + inner block) ---
  } catch (error) {
    console.error('Error in /api/ask handler (OpenRouter):', error);
    let errorMessage = 'An error occurred while processing your request';

    if (error instanceof Error && error.name === 'AbortError') {
      errorMessage = 'The request to the AI provider timed out.';
      console.error('OpenRouter API call timed out.');
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }
    
    // Send error as JSON
    if (!res.headersSent) {
        res.status(500).json({ error: errorMessage });
    }
  }
  // --- End of outer try-catch ---
} 