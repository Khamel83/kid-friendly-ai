import { NextApiRequest, NextApiResponse } from 'next';
import { createSystemPrompt, formatUserQuestion } from '../../utils/aiPrompt';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question } = req.body;
    
    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question is required' });
    }

    const apiKey = process.env.OPENAI_API_KEY; // Check if OpenAI key exists
    if (!apiKey) {
      console.error('OpenAI API key is not configured');
      return res.status(500).json({ error: 'API key is not configured' });
    }

    console.log(`Sending request to OpenAI for question: "${question.substring(0, 50)}..."`);
    
    // Use OpenAI API directly
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use a standard OpenAI model
      messages: [
        { role: "system", content: createSystemPrompt() },
        { role: "user", content: formatUserQuestion(question) },
      ],
      temperature: 0.7,
      max_tokens: 300, // Keep max tokens reasonable
      // Add timeout (optional, library default is 10 mins, but Vercel limits are shorter)
      // timeout: 15000, // 15 seconds
    });
    
    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse) {
        console.error('OpenAI response missing content:', completion);
        throw new Error('AI response was empty.');
    }
    
    console.log('Received response from OpenAI.');
    return res.status(200).json({ response: aiResponse });

  } catch (error) {
    console.error('Error in /api/ask:', error);
    let errorMessage = 'An error occurred while processing your request';
    let statusCode = 500;

    if (error instanceof OpenAI.APIError) {
      errorMessage = `OpenAI Error: ${error.message}`;
      statusCode = error.status || 500;
      console.error('OpenAI API Error details:', { status: error.status, message: error.message });
    } else if (error instanceof Error) {
        errorMessage = error.message; 
    }
    
    return res.status(statusCode).json({ error: errorMessage });
  }
} 