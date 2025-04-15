import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the raw body data
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Create a FormData-like object
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      throw new Error('No boundary found in content-type header');
    }

    // Parse the multipart form data
    const parts = buffer.toString().split(`--${boundary}`);
    let audioData: Buffer | null = null;
    let filename = '';

    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data')) {
        const match = part.match(/name="file"; filename="([^"]+)"/);
        if (match) {
          filename = match[1];
          const dataStart = part.indexOf('\r\n\r\n') + 4;
          const dataEnd = part.lastIndexOf('\r\n');
          audioData = Buffer.from(part.slice(dataStart, dataEnd));
        }
      }
    }

    if (!audioData) {
      throw new Error('No audio data found in request');
    }

    // Create a temporary file
    const file = new File([audioData], filename, { type: 'audio/webm' });

    // Send to OpenAI
    const response = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });

    return res.status(200).json({ text: response.text });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to transcribe audio' 
    });
  }
} 