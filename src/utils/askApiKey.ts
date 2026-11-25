// The one key /api/ask uses to answer questions. /api/health reads the same
// helper, so health can only report that Buddy can answer when /api/ask can.
// The OpenAI key serves the voice routes only and does not count here.
export function getAskApiKey(): string | undefined {
  const key = process.env.OPENROUTER_API_KEY;
  return key ? key : undefined;
}
