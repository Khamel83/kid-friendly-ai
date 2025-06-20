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
    const parts = buffer.toString('binary').split(`--${boundary}`);
    let audioData: Buffer | null = null;
    let filename = '';

    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data')) {
        const match = part.match(/name="file"; filename="([^"]+)"/);
        if (match) {
          filename = match[1];
          const dataStart = part.indexOf('\r\n\r\n') + 4;
          const dataEnd = part.lastIndexOf('\r\n');
          const rawData = part.slice(dataStart, dataEnd);
          audioData = Buffer.from(rawData, 'binary');
          
          // Log the first few bytes of the audio data
          console.log('Raw audio data:', {
            size: audioData.length,
            firstBytes: audioData.slice(0, 8).toString('hex'),
            lastBytes: audioData.slice(-8).toString('hex')
          });
        }
      }
    }

    if (!audioData) {
      throw new Error('No audio data found in request');
    }

    // Validate the WAV header
    if (audioData.length < 44) {
      throw new Error('Invalid WAV file: too small');
    }

    // Check WAV header
    const header = audioData.slice(0, 44);
    const view = new DataView(header.buffer);
    
    // Log the header bytes for debugging
    console.log('WAV header bytes:', {
      riff: view.getUint32(0, true).toString(16),
      wave: view.getUint32(8, true).toString(16),
      format: view.getUint16(20, true),
      channels: view.getUint16(22, true),
      sampleRate: view.getUint32(24, true),
      bitDepth: view.getUint16(34, true)
    });
    
    // Check RIFF header
    if (view.getUint32(0, true) !== 0x46464952) { // "RIFF"
      throw new Error('Invalid WAV file: missing RIFF header');
    }
    
    // Check WAVE format
    if (view.getUint32(8, true) !== 0x45564157) { // "WAVE"
      throw new Error('Invalid WAV file: missing WAVE format');
    }
    
    // Check format type (should be PCM)
    if (view.getUint16(20, true) !== 1) {
      throw new Error('Invalid WAV file: not PCM format');
    }
    
    // Check sample rate (should be 16kHz)
    const sampleRate = view.getUint32(24, true);
    if (sampleRate !== 16000) {
      throw new Error(`Invalid sample rate: ${sampleRate}Hz (expected 16000Hz)`);
    }
    
    // Check number of channels (should be mono)
    const numChannels = view.getUint16(22, true);
    if (numChannels !== 1) {
      throw new Error(`Invalid number of channels: ${numChannels} (expected 1)`);
    }
    
    // Check bit depth (should be 16-bit)
    const bitDepth = view.getUint16(34, true);
    if (bitDepth !== 16) {
      throw new Error(`Invalid bit depth: ${bitDepth} (expected 16)`);
    }

    // Create a temporary file with WAV format
    const file = new File([audioData], filename, { 
      type: 'audio/wav'
    });

    console.log('Created File object:', {
      size: file.size,
      type: file.type,
      name: file.name,
      firstBytes: audioData.slice(0, 8).toString('hex')
    });

    // Send to OpenAI
    const response = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en', // Specify English to improve accuracy
      response_format: 'json',
      temperature: 0.2
    });

    return res.status(200).json({ text: response.text });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to transcribe audio' 
    });
  }
} 