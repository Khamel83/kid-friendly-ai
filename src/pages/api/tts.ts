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
    
    // Cast to any to handle potential type mismatch between Node stream and Web stream in different envs
    const nodeStream = readableStream as any;

    // Check for pipe method again
    if (typeof nodeStream.pipe === 'function') {
        nodeStream.pipe(res); // Pipe directly to the response
         
        // Handle stream finish/error
        nodeStream.on('end', () => {
            console.log('TTS stream finished sending via pipe.');
            // res.end() is usually called automatically by pipe on end
        });
        nodeStream.on('error', (err: Error) => {
            console.error('Error piping TTS stream:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error generating audio stream' });
            } else if (!res.writableEnded){
                res.end(); // End the response if headers already sent but stream not ended
            }
        });
   } else {
       console.error('Error: mp3.body does not have a pipe method. Cannot stream.');
       return res.status(500).json({ error: 'Internal server error generating audio stream.' });
   }

  } catch (error) {
    console.error('Error in /api/tts:', error);
    // Check if the error is from OpenAI API
    if (error instanceof OpenAI.APIError) {
         // Log more details from the OpenAI error object
         console.error('OpenAI API Error Details:', {
             status: error.status,
             message: error.message,
             code: error.code,
             type: error.type,
             // param: error.param, // param might not always exist
             headers: JSON.stringify(error.headers) // Stringify headers for logging
         });
         return res.status(error.status || 500).json({ error: `OpenAI Error: ${error.message}` });
    } else if (error instanceof Error) {
        // Log stack trace for generic errors
        console.error('Generic Error Stack Trace in /api/tts:', error.stack);
    }
    return res.status(500).json({ error: 'Failed to generate speech' });
  }
} 