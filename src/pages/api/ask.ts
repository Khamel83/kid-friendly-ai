import { NextApiRequest, NextApiResponse } from 'next';
import { createSystemPrompt, formatUserQuestion } from '../../utils/aiPrompt';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set
});

// Helper function to send SSE data
function sendSse(res: NextApiResponse, id: string | number, data: object) {
  res.write(`id: ${id}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- Allow GET for EventSource --- 
  if (req.method !== 'POST' && req.method !== 'GET') { 
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // --- End Allow GET --- 

  try {
    // --- Get question from query param for GET, fallback to body for POST ---
    const question = (req.method === 'GET' ? req.query.question : req.body.question) as string;
    // --- End Get question --- 
    
    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY; // Check if OpenAI key exists
    if (!apiKey) {
      console.error('OpenAI API key is not configured');
      return res.status(500).json({ error: 'API key is not configured' });
    }

    console.log(`Sending streaming request to OpenAI for question: "${question.substring(0, 50)}..."`);
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Flush headers immediately

    const stream = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: createSystemPrompt() },
        { role: "user", content: formatUserQuestion(question) },
      ],
      temperature: 0.7,
      max_tokens: 300, 
      stream: true, // <<< Enable streaming
    });
    
    let messageId = 0;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
          // Send each content chunk as an SSE event
          sendSse(res, messageId++, { type: 'chunk', content });
      }
      // Check for finish reason if needed (e.g., length, stop)
      if (chunk.choices[0]?.finish_reason) {
           console.log('OpenAI stream finished. Reason:', chunk.choices[0]?.finish_reason);
           break; // Stop processing if OpenAI signals completion
      }
    }
    
    // Signal the end of the stream
    sendSse(res, messageId, { type: 'done' });
    res.end(); // End the response stream
    console.log('Finished sending SSE stream from /api/ask');

  } catch (error) {
    console.error('Error in /api/ask streaming:', error);
    let errorMessage = 'An error occurred while processing your request';
    let statusCode = 500;

    if (error instanceof OpenAI.APIError) {
      errorMessage = `OpenAI Error: ${error.message}`;
      statusCode = error.status || 500;
      console.error('OpenAI API Error details:', { status: error.status, message: error.message });
    } else if (error instanceof Error) {
        errorMessage = error.message; 
    }
    
    // If headers haven't been sent, try to send JSON error
    if (!res.headersSent) {
        res.status(statusCode).json({ error: errorMessage });
    } else {
        // If headers were sent, we can't change status code,
        // just try to send an error event and end.
        try {
            sendSse(res, 'error', { type: 'error', content: errorMessage });
        } catch (sseError) {
             console.error("Failed to send SSE error event:", sseError);
        }
        res.end();
    }
  }
} 