import {
  DISABLED_PARENTAL_REVIEW,
  PARENTAL_REVIEW_MAX_CHARS,
  UNAVAILABLE_PARENTAL_REVIEW,
} from '../types/parentalReview';
import type {
  ParentalReviewFinding,
  ParentalReviewResult,
} from '../types/parentalReview';

const PARENTAL_REVIEW_TIMEOUT_MS = 5000;

const VALID_CATEGORIES = ['safety_topic', 'educational_interest', 'review_flag'];
const VALID_SEVERITIES = ['none', 'low', 'medium', 'high'];
const VALID_SPEAKERS = ['child', 'assistant', 'parent', 'unknown'];

type JsonRecord = Record<string, unknown>;
type Fetcher = typeof fetch;

export function boundConversationSegment(segment: string): string {
  return segment.slice(0, PARENTAL_REVIEW_MAX_CHARS);
}

export function isParentalReviewEnabled(): boolean {
  return process.env.PARENTAL_REVIEW_EXTRACTION_ENABLED === 'true';
}

export async function requestParentalReview(
  conversationSegment: string,
  fetcher: Fetcher = fetch,
): Promise<ParentalReviewResult> {
  if (!isParentalReviewEnabled()) {
    return DISABLED_PARENTAL_REVIEW;
  }

  const serviceUrl = process.env.LANGEXTRACT_SERVICE_URL?.trim();
  const boundedSegment = boundConversationSegment(conversationSegment);
  if (!serviceUrl || !boundedSegment.trim()) {
    return UNAVAILABLE_PARENTAL_REVIEW;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PARENTAL_REVIEW_TIMEOUT_MS);

  try {
    const response = await fetcher(serviceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{
          speaker: 'unknown',
          text: boundedSegment,
        }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return UNAVAILABLE_PARENTAL_REVIEW;
    }

    const normalized = normalizeReviewResponse(await response.json());
    return normalized ?? UNAVAILABLE_PARENTAL_REVIEW;
  } catch {
    return UNAVAILABLE_PARENTAL_REVIEW;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeReviewResponse(value: unknown): ParentalReviewResult | null {
  if (!isRecord(value) || !Array.isArray(value.findings)) {
    return null;
  }

  const findings: ParentalReviewFinding[] = [];
  for (const finding of value.findings) {
    if (!isRecord(finding)) {
      return null;
    }
    const category = firstString(finding.category, finding.label, finding.type, finding.extraction_class);
    const severity = firstString(finding.severity, finding.risk_level, finding.priority);
    const speaker = firstString(finding.speaker, finding.role);
    const explanation = firstString(
      finding.explanation,
      finding.summary,
      finding.text,
      finding.value,
      finding.extraction_text,
    );
    if (
      !category ||
      !VALID_CATEGORIES.includes(category) ||
      !severity ||
      !VALID_SEVERITIES.includes(severity) ||
      !speaker ||
      !VALID_SPEAKERS.includes(speaker) ||
      !explanation
    ) {
      return null;
    }

    const rawSourceSpan = finding.sourceSpan ?? finding.source_span;
    const sourceSpan = normalizeSourceSpan(rawSourceSpan);
    if (rawSourceSpan !== undefined && sourceSpan === null) {
      return null;
    }
    findings.push(sourceSpan
      ? { category, severity, speaker, explanation, sourceSpan }
      : { category, severity, speaker, explanation });
  }

  const sourceExcerpts = normalizeSourceExcerpts(value.sourceExcerpts ?? value.source_excerpts);
  if (sourceExcerpts === null) {
    return null;
  }

  return {
    status: 'success',
    findings,
    sourceExcerpts: Array.from(new Set([
      ...sourceExcerpts,
      ...findings.flatMap(finding => finding.sourceSpan ? [finding.sourceSpan.quote] : []),
    ])),
  };
}

function normalizeSourceExcerpts(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some(excerpt => typeof excerpt !== 'string')) {
    return null;
  }
  return value.map(excerpt => excerpt.trim()).filter(Boolean);
}

function normalizeSourceSpan(value: unknown): ParentalReviewFinding['sourceSpan'] | null {
  if (!isRecord(value)) {
    return null;
  }

  const messageIndex = typeof value.messageIndex === 'number'
    ? value.messageIndex
    : value.message_index;
  const start = value.start;
  const end = value.end;
  const quote = value.quote;
  if (
    typeof messageIndex !== 'number' ||
    !Number.isInteger(messageIndex) ||
    messageIndex < 0 ||
    typeof start !== 'number' ||
    !Number.isInteger(start) ||
    start < 0 ||
    typeof end !== 'number' ||
    !Number.isInteger(end) ||
    end < start ||
    typeof quote !== 'string' ||
    quote.trim().length === 0
  ) {
    return null;
  }

  return { messageIndex, start, end, quote: quote.trim() };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
