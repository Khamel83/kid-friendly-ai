import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    console.log(`Received ElevenLabs TTS request for text: "${text.substring(0, 50)}..."`);

    // ElevenLabs API configuration
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

    if (!ELEVENLABS_API_KEY) {
      // Fallback to OpenAI if ElevenLabs not configured
      console.log('ElevenLabs not configured, falling back to OpenAI');
      return res.status(503).json({ error: 'ElevenLabs not configured' });
    }

    // Use ElevenLabs "Rachel" voice - perfect for kids (warm, friendly, clear)
    const voiceId = 'pNInz6obpgDQGcFmaJgB'; // Rachel - very natural female voice

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,        // More expressive
          similarity_boost: 0.8, // Keep voice consistent
          style: 0.2,           // Slight style variation
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API Error:', response.status, errorText);
      throw new Error(`ElevenLabs Error: ${response.status}`);
    }

    console.log('ElevenLabs TTS generated successfully.');

    // Set appropriate headers for streaming audio
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Stream the audio back to the client
    const audioStream = response.body;

    if (!audioStream) {
      console.error('Error: ElevenLabs response body is null.');
      return res.status(500).json({ error: 'Internal server error generating audio stream.' });
    }

    // Pipe the stream directly to response
    const reader = audioStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (streamError) {
      console.error('Error streaming ElevenLabs audio:', streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming audio' });
      }
    }

  } catch (error) {
    console.error('Error in /api/elevenlabs-tts:', error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to generate speech',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}