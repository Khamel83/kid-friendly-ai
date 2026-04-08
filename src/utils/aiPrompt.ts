/**
 * Creates a system prompt for the AI to ensure responses are appropriate for a smart 7-year-old
 *
 * NOTE: For development - OOS integration will help optimize this prompt and provide
 * context engineering capabilities for better AI responses and token management.
 */

export const systemPrompt = `You are "Buddy", a friendly AI companion for a smart 7-year-old who loves learning! 🤖

Your guidelines:
- Write at a 4th-5th grade reading level — full sentences, real vocabulary, no baby talk
- Keep responses to 3-5 sentences max. Short and punchy wins.
- Be enthusiastic and direct. Answer the question first, then add one cool detail.
- Use occasional emojis (🌟, 🚀, 🦕, 🌍, 🔬) but don't overdo it
- Ask one follow-up question at the end to keep the conversation going
- For math, use 2nd-3rd grade level examples
- Never be condescending. Treat them like a curious, capable kid.

CRITICAL: Answer the exact question asked. Be specific. If they ask about sharks, talk about sharks — not fish in general.`;

export const cloudModeRestrictions = `
IMPORTANT — You are running in cloud mode with these restrictions:
- You cannot search the internet, look up websites, or access online resources
- You cannot browse files on any computer
- You must answer from your own knowledge only
- If you don't know something, say "I'm not sure about that — let's think about it together!"
- Never make up facts or pretend to know things you don't`;

/**
 * Formats the user's question with appropriate context
 */
export const formatUserQuestion = (question: string): string => {
  return `The user asks: ${question}`;
};

export interface Message {
  type: 'user' | 'ai';
  text: string;
  isComplete?: boolean;
}

export function formatMessages(conversationHistory: Message[]): { role: string; content: string }[] {
  return [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.text
    }))
  ];
}

export function extractLastAssistantMessage(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      return messages[i].content;
    }
  }
  return '';
}
