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
    const formData = await new Promise<FormData>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: 'audio/webm' }), 'audio.webm');
        formData.append('model', 'whisper-1');
        resolve(formData);
      });
      req.on('error', reject);
    });

    const response = await openai.audio.transcriptions.create({
      file: formData.get('file') as File,
      model: 'whisper-1',
    });

    return res.status(200).json({ text: response.text });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return res.status(500).json({ error: 'Failed to transcribe audio' });
  }
} 