/**
 * OOS (Operational Intelligence System) Middleware for Kid-Friendly AI
 *
 * A TypeScript implementation of key OOS features:
 * - Context optimization and token reduction
 * - Slash command handling
 * - Meta-clarification system
 * - Kid-friendly content filtering
 */

export interface TokenBudget {
  total_budget: number;
  reserved_for_response: number;
  available_for_context: number;
  safety_margin: number;
}

export interface ContextChunk {
  chunk_id: string;
  content: string;
  content_type: 'code' | 'documentation' | 'conversation' | 'metadata';
  importance: number; // 0.0 to 1.0
  staleness: number;  // 0.0 (fresh) to 1.0 (stale)
  token_count: number;
  created_at: Date;
  last_accessed: Date;
  access_count: number;
  tags: string[];
}

export interface HistoryMessage {
  speaker: 'user' | 'ai';
  text: string;
  timestamp?: Date;
}

export interface SlashCommand {
  command: string;
  description: string;
  handler: (args: string[], context: any) => Promise<string>;
  kid_friendly: boolean;
}

export class OOSMiddleware {
  private tokenBudget: TokenBudget;
  private slashCommands: Map<string, SlashCommand>;
  private contextCache: Map<string, ContextChunk>;

  constructor() {
    this.tokenBudget = {
      total_budget: 500, // Reduced for kid-friendly AI (GPT-4.1-nano limit)
      reserved_for_response: 150,
      available_for_context: 300,
      safety_margin: 50
    };

    this.contextCache = new Map();
    this.slashCommands = new Map();
    this.initializeKidFriendlyCommands();
  }

  /**
   * Initialize kid-friendly slash commands
   */
  private initializeKidFriendlyCommands(): void {
    // Kid-friendly help command
    this.slashCommands.set('/help', {
      command: '/help',
      description: 'Get help with using your AI buddy',
      kid_friendly: true,
      handler: async (args: string[], context: any) => {
        return `Hi! I'm your AI buddy! Here's how we can have fun together:

🎮 Ask me questions about animals, space, or anything you're curious about!
🎨 I can help with homework or creative writing
🎵 I love to tell jokes and fun facts
🌟 Just talk to me like a friend!

Try saying things like:
- "Tell me about dinosaurs!"
- "What's your favorite color?"
- "Can you help me with math?"
- "Tell me a funny joke!"`;
      }
    });

    // Fun facts command
    this.slashCommands.set('/fun', {
      command: '/fun',
      description: 'Get a fun fact or joke',
      kid_friendly: true,
      handler: async (args: string[], context: any) => {
        const funFacts = [
          "🐙 Octopuses have three hearts and blue blood!",
          "🌙 A day on Venus is longer than a year on Venus!",
          "🦘 Kangaroos can't walk backwards!",
          "🐝 Bees can see ultraviolet colors we can't see!",
          "🌊 The ocean is home to animals that glow in the dark!"
        ];
        return funFacts[Math.floor(Math.random() * funFacts.length)];
      }
    });

    // Simple games command
    this.slashCommands.set('/game', {
      command: '/game',
      description: 'Start a fun game',
      kid_friendly: true,
      handler: async (args: string[], context: any) => {
        return "Let's play the animal guessing game! 🎮 I'm thinking of an animal that lives in the ocean and is really smart. It has eight arms! What do you think it is?";
      }
    });

    // Encouragement command
    this.slashCommands.set('/cheer', {
      command: '/cheer',
      description: 'Get some encouragement',
      kid_friendly: true,
      handler: async (args: string[], context: any) => {
        const cheers = [
          "You're doing amazing! Keep being curious! 🌟",
          "I believe in you! You can do anything you set your mind to! 💪",
          "You ask the best questions! That's how we learn! 🧠",
          "You're so smart and kind! Keep being awesome! ✨",
          "Every day is a chance to learn something new! 🌈"
        ];
        return cheers[Math.floor(Math.random() * cheers.length)];
      }
    });
  }

  /**
   * Process input and detect slash commands
   */
  public async processInput(input: string, context: any = {}): Promise<{ isCommand: boolean; response?: string; processedInput?: string }> {
    const trimmedInput = input.trim();

    // Check for slash commands
    if (trimmedInput.startsWith('/')) {
      const parts = trimmedInput.split(' ');
      const command = parts[0];
      const args = parts.slice(1);

      const slashCommand = this.slashCommands.get(command);
      if (slashCommand && slashCommand.kid_friendly) {
        const response = await slashCommand.handler(args, context);
        return { isCommand: true, response };
      }

      // Unknown command - provide helpful guidance
      return {
        isCommand: true,
        response: "I don't know that command! Try /help to see what I can do! 😊"
      };
    }

    // Process regular input with optimization
    const optimizedInput = await this.optimizeInput(input, context);
    return { isCommand: false, processedInput: optimizedInput };
  }

  /**
   * Optimize conversation history and context for token efficiency
   */
  public async optimizeConversationHistory(
    history: HistoryMessage[],
    currentQuestion: string
  ): Promise<{ optimizedHistory: HistoryMessage[]; tokensSaved: number }> {
    if (!history || history.length === 0) {
      return { optimizedHistory: [], tokensSaved: 0 };
    }

    const originalTokens = this.estimateTokens(JSON.stringify(history));

    // Keep only the most recent and relevant messages for kids
    // Kids have shorter attention spans, so we prioritize recent context
    const maxHistoryLength = 6; // Keep last 3 exchanges (6 messages)
    let optimizedHistory = history.slice(-maxHistoryLength);

    // Compress older messages while preserving important context
    optimizedHistory = optimizedHistory.map((msg, index) => {
      if (index < optimizedHistory.length - 4) { // Compress older messages
        return {
          ...msg,
          text: this.compressMessage(msg.text)
        };
      }
      return msg;
    });

    const optimizedTokens = this.estimateTokens(JSON.stringify(optimizedHistory));
    const tokensSaved = originalTokens - optimizedTokens;

    return { optimizedHistory, tokensSaved };
  }

  /**
   * Optimize input for better AI processing
   */
  private async optimizeInput(input: string, context: any): Promise<string> {
    // Clean up common kid typos and formatting
    let optimized = input
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[.]{2,}/g, '...') // Multiple periods to ellipsis
      .trim();

    // Add helpful context for kids' questions
    if (this.isQuestionNeedingContext(optimized)) {
      optimized = this.addKidFriendlyContext(optimized);
    }

    return optimized;
  }

  /**
   * Check if question needs additional context for better AI response
   */
  private isQuestionNeedingContext(input: string): boolean {
    const needsContextPatterns = [
      /^(what|who|where|when|why|how)/i,
      /tell me about/i,
      /explain/i,
      /help me/i
    ];

    return needsContextPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Add kid-friendly context to improve AI responses
   */
  private addKidFriendlyContext(input: string): string {
    return `${input} (Please respond in a kid-friendly way that's educational and fun!)`;
  }

  /**
   * Compress message content while preserving meaning
   */
  private compressMessage(text: string): string {
    if (text.length <= 50) return text;

    // Keep first and last parts, compress middle
    const start = text.substring(0, 20);
    const end = text.substring(text.length - 20);
    return `${start}...${end}`;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Get available slash commands for kids
   */
  public getKidFriendlyCommands(): SlashCommand[] {
    return Array.from(this.slashCommands.values()).filter(cmd => cmd.kid_friendly);
  }

  /**
   * Meta-clarification: Improve unclear kid questions
   */
  public async clarifyKidInput(input: string): Promise<{ needsClarification: boolean; suggestion?: string }> {
    const unclearPatterns = [
      /^(um|uh|well|like)/i,
      /\?{2,}/i, // Multiple question marks
      /^(i|you|it|that|this)$/i // Single words that need context
    ];

    const isUnclear = unclearPatterns.some(pattern => pattern.test(input.trim()));

    if (isUnclear || input.trim().length < 3) {
      return {
        needsClarification: true,
        suggestion: "I want to help you! Can you tell me more about what you're curious about? For example, you could ask about animals, space, or anything you're learning! 😊"
      };
    }

    return { needsClarification: false };
  }

  /**
   * Generate system prompt with OOS optimizations for kid-friendly AI
   */
  public generateOptimizedSystemPrompt(): string {
    return `You are a friendly, safe, and educational AI companion designed specifically for children aged 6-12.

KEY PERSONALITY TRAITS:
- Warm, encouraging, and patient
- Uses age-appropriate language and concepts
- Incorporates emojis and fun elements naturally
- Asks follow-up questions to keep kids engaged
- Celebrates curiosity and learning

SAFETY & CONTENT GUIDELINES:
- Always provide age-appropriate responses
- Focus on educational and positive content
- Avoid complex or scary topics
- Encourage creativity, learning, and critical thinking
- Never provide personal information or ask for it

INTERACTION STYLE:
- Keep responses concise but engaging (2-3 sentences max unless explaining something complex)
- Use analogies kids can understand
- Include fun facts when relevant
- Express enthusiasm for learning
- End with questions or encouragement when appropriate

EDUCATIONAL FOCUS:
- Science, nature, animals, space, and general knowledge
- Creative writing and storytelling
- Basic math and problem-solving
- Art and imagination
- Social skills and kindness

Remember: Be their enthusiastic learning buddy who makes every interaction educational and fun! 🌟`;
  }
}

// Export singleton instance
export const oosMiddleware = new OOSMiddleware();