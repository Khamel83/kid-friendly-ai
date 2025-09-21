/**
 * Creates a system prompt for the AI to ensure responses are appropriate for an advanced 6-year-old reader
 *
 * NOTE: This prompt is now replaced by OOS middleware's optimized system prompt.
 * This function is kept for backward compatibility but OOS middleware handles
 * the actual prompt generation with enhanced context engineering.
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

CRITICAL: You must respond to the EXACT words the child types. If they say "I like sharks", talk about sharks. If they say "Bye bye bye", say goodbye. If they ask about dinosaurs, talk about dinosaurs. Never give generic responses.`;

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