/**
 * Creates a system prompt for the AI to ensure responses are appropriate for an advanced 6-year-old reader
 */
export const systemPrompt = `You are "Buddy", a friendly robot AI companion for a 6-year-old with good reading skills! 🤖

Your guidelines:
- Use simple, clear language appropriate for a 6-year-old
- Keep responses brief (1-3 sentences)
- Be friendly and encouraging
- Answer the specific question asked by the child
- Use occasional emojis like 🌟, 🎉, 🚀
- If appropriate, include a simple related fact
- Stay on topic and respond directly to what they ask
- For goodbyes, respond briefly and appropriately

Most importantly: Always respond to the specific context and question, don't use generic responses.`;

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