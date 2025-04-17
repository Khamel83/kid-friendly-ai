import { NextApiRequest, NextApiResponse } from 'next';
import { createSystemPrompt, formatUserQuestion } from '../../utils/aiPrompt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question } = req.body;
    
    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question is required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key is not configured' });
    }

    // Prepare the request to OpenRouter
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Kid-Friendly AI Assistant'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat:free',
          messages: [
            { role: 'system', content: createSystemPrompt() },
            { role: 'user', content: formatUserQuestion(question) }
          ],
          temperature: 0.7,
          max_tokens: 300
        }),
        signal: controller.signal // Add AbortSignal
      });

      clearTimeout(timeoutId); // Clear timeout if fetch completes

      const data = await response.json();
      
      if (!response.ok) {
        console.error('API error:', data);
        return res.status(response.status).json({ error: data.error?.message || 'Error from AI provider' });
      }

      // Extract the AI's response text
      const aiResponse = data.choices[0]?.message?.content || 'Sorry, I couldn\'t understand that.';
      
      return res.status(200).json({ response: aiResponse });
    } catch (fetchError) {
      clearTimeout(timeoutId); // Ensure timeout is cleared on error too
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('OpenRouter API call timed out.');
        return res.status(504).json({ error: 'The request to the AI timed out. Please try again.' });
      } else {
        throw fetchError; // Re-throw other fetch errors
      }
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'An error occurred while processing your request' });
  }
} 