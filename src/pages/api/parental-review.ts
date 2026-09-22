import { NextApiRequest, NextApiResponse } from 'next';

type ReviewMessage = {
  id: string;
  role: 'user' | 'ai';
  text: string;
};

type Finding = {
  messageId: string;
  start: number;
  end: number;
  quote: string;
};

const MAX_MESSAGES = 6;
const DEFAULT_OLLAMA_URL = 'http://macmini.local:11434';
const DEFAULT_MODEL = 'gemma4:e4b';
const REQUEST_TIMEOUT_MS = 90_000;

function isReviewMessage(value: unknown): value is ReviewMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ReviewMessage>;
  return typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'ai') &&
    typeof message.text === 'string';
}

function isFinding(value: unknown): value is Finding {
  if (!value || typeof value !== 'object') return false;
  const finding = value as Partial<Finding>;
  return typeof finding.messageId === 'string' &&
    Number.isInteger(finding.start) && Number.isInteger(finding.end) &&
    typeof finding.quote === 'string';
}

function getFindings(value: unknown): unknown[] | null {
  if (!value || typeof value !== 'object' || !('findings' in value) ||
      !Array.isArray(value.findings)) return null;
  return value.findings;
}

function normalizeFindings(value: unknown, messages: ReviewMessage[]): Finding[] | null {
  const rawFindings = getFindings(value);
  if (!rawFindings) return null;
  const findings = rawFindings.filter(isFinding);
  if (findings.length !== rawFindings.length) return null;

  const byId = new Map(messages.map((message) => [message.id, message]));
  if (findings.some((finding) => {
    const message = byId.get(finding.messageId);
    return !message || finding.start < 0 || finding.end < finding.start ||
      finding.end > message.text.length || message.text.slice(finding.start, finding.end) !== finding.quote;
  })) return null;
  return findings;
}

function extractContent(body: unknown): unknown {
  if (!body || typeof body !== 'object' || !('choices' in body) ||
      !Array.isArray(body.choices) || body.choices.length === 0) return null;
  const firstChoice = body.choices[0];
  if (!firstChoice || typeof firstChoice !== 'object' || !('message' in firstChoice) ||
      !firstChoice.message || typeof firstChoice.message !== 'object' ||
      !('content' in firstChoice.message)) return null;
  const content = firstChoice.message.content;
  if (typeof content !== 'string') return content;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (process.env.PARENTAL_REVIEW_EXTRACTION_ENABLED !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  const body = req.body;
  const messagesValue = body && typeof body === 'object' && 'messages' in body ? body.messages : undefined;
  const languageValue = body && typeof body === 'object' && 'language' in body ? body.language : undefined;
  if (!Array.isArray(messagesValue) || messagesValue.length === 0 || messagesValue.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'Invalid conversation' });
  }
  const messages = messagesValue.filter(isReviewMessage);
  if (messages.length !== messagesValue.length) {
    return res.status(400).json({ error: 'Invalid conversation' });
  }
  const language = typeof languageValue === 'string' ? languageValue : 'en-US';
  const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL).replace(/\/$/, '');
  const model = process.env.PARENTAL_REVIEW_MODEL || DEFAULT_MODEL;
  const prompt = [
    'Review the supplied conversation for content a parent should see.',
    'Return JSON only: {"findings":[{"messageId":"string","start":0,"end":0,"quote":"string"}]}.',
    'Use UTF-16 JavaScript string offsets and exact quotes from the referenced message.',
    'Return an empty findings array when no review is needed.',
  ].join(' ');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify({ language, messages }) },
        ],
        temperature: 0,
        stream: false,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return res.status(502).json({ error: 'Review service unavailable' });
    const modelBody = await response.json();
    const findings = normalizeFindings(extractContent(modelBody), messages);
    if (!findings) return res.status(502).json({ error: 'Review service returned invalid data' });
    return res.status(200).json({ findings });
  } catch {
    return res.status(502).json({ error: 'Review service unavailable' });
  } finally {
    clearTimeout(timeout);
  }
}

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };
