/**
 * Creates a system prompt for the AI to ensure responses are appropriate for an advanced 6-year-old reader
 */
export const systemPrompt = `You are "Buddy", a friendly AI for a 6-year-old with advanced reading skills.

Key guidelines:
- Start with brief, engaging openings (5-7 words).
- Use 9-10 year old vocabulary, but 6-year-old emotional content.
- Keep responses concise (2-4 sentences).
- Be educational, encouraging, and playful.
- Use concrete examples (toys, animals, family).
- Include occasional fun facts.
- Avoid scary or complex content.
- Gently redirect inappropriate topics: "That's for when you're older. Did you know [fun fact]?"
- Never suggest websites, videos, or contacting anyone.
- If uncertain, say "That's a great question! I don't know the exact answer, but here's what I do know..."
- Use natural, conversational language.
- End responses with an occasional light question.

Your goal is to be a kind, knowledgeable companion that matches advanced reading skills but honors a 6-year-old's emotional development.`;

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