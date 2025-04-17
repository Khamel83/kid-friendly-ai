import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure OPENAI_API_KEY is set in your environment variables
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    console.log(`Received TTS request for text: "${text.substring(0, 50)}..."`);

    // Use OpenAI's TTS API
    const mp3 = await openai.audio.speech.create({
      model: "tts-1", // Standard quality model
      // model: "tts-1-hd", // Higher quality, slightly more expensive
      voice: "shimmer", // Choose a friendly voice (alloy, echo, fable, onyx, nova, shimmer)
      input: text,
      response_format: "mp3", // Other options: opus, aac, flac
      speed: 0.95 // Adjust speed slightly if needed (0.25 to 4.0)
    });

    console.log('TTS stream generated successfully.');

    // Set appropriate headers for streaming audio
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Stream the audio back to the client
    const readableStream = mp3.body;

    if (!readableStream) {
        console.error('Error: TTS response body is null.');
        return res.status(500).json({ error: 'Internal server error generating audio stream.' });
    }
    
    // Use the stream reader
    const reader = readableStream.getReader();
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.log('TTS stream finished sending.');
                break; // Exit the loop when the stream is finished
            }
            if (value) {
                res.write(value); // Write the chunk to the response
            }
        }
    } catch (streamError) {
        console.error('Error reading or writing TTS stream:', streamError);
        if (!res.headersSent) {
             // Attempt to send an error status only if nothing has been sent yet
            res.status(500).json({ error: 'Error streaming audio' });
        }
    } finally {
        // Ensure the response is always ended
        if (!res.writableEnded) {
            res.end();
        }
        // Release the lock on the reader
        reader.releaseLock(); 
    }

  } catch (error) {
    console.error('Error in /api/tts:', error);
    // Check if the error is from OpenAI API
    if (error instanceof OpenAI.APIError) {
         console.error('OpenAI API Error:', { status: error.status, message: error.message });
         return res.status(error.status || 500).json({ error: `OpenAI Error: ${error.message}` });
    }
    return res.status(500).json({ error: 'Failed to generate speech' });
  }
} 