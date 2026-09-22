import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../src/pages/api/parental-review';
import { requestParentalReview } from '../../../src/server/parentalReviewClient';
import { parentalControls } from '../../../src/utils/parentalControls';

function makeRequest(body: unknown): NextApiRequest {
  return { method: 'POST', body } as NextApiRequest;
}

function makeResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader: jest.fn((name: string, value: string) => {
      response.headers[name] = value;
      return response;
    }),
    status: jest.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    json: jest.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
  };

  return response as unknown as NextApiResponse & typeof response;
}

describe('parental review API', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.PARENTAL_REVIEW_EXTRACTION_ENABLED;
    delete process.env.LANGEXTRACT_SERVICE_URL;
    global.fetch = jest.fn() as typeof fetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not make an extraction request when disabled', async () => {
    const response = makeResponse();

    await handler(makeRequest({ conversationSegment: 'A private conversation' }), response);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      status: 'disabled',
      findings: [],
      sourceExcerpts: [],
    });
  });

  it('routes only the bounded segment through the private server-side URL', async () => {
    process.env.PARENTAL_REVIEW_EXTRACTION_ENABLED = 'true';
    process.env.LANGEXTRACT_SERVICE_URL = 'http://langextract.internal/extract';
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        findings: [{
          category: 'educational_interest',
          severity: 'low',
          speaker: 'child',
          explanation: 'The child is interested in science.',
          source_span: {
            message_index: 0,
            start: 0,
            end: 19,
            quote: 'We discussed stars.',
          },
        }],
        source_excerpts: [],
      }),
    });
    const response = makeResponse();
    const segment = 'x'.repeat(8000) + 'not sent';

    await handler(makeRequest({ conversationSegment: segment }), response);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://langextract.internal/extract',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messages: [{ speaker: 'unknown', text: 'x'.repeat(8000) }],
        }),
      }),
    );
    expect(JSON.stringify(response.body)).not.toContain('langextract.internal');
    expect(response.body).toEqual({
      status: 'success',
      findings: [{
        category: 'educational_interest',
        severity: 'low',
        speaker: 'child',
        explanation: 'The child is interested in science.',
        sourceSpan: {
          messageIndex: 0,
          start: 0,
          end: 19,
          quote: 'We discussed stars.',
        },
      }],
      sourceExcerpts: ['We discussed stars.'],
    });
  });

  it.each([
    ['non-2xx', async () => ({ ok: false, json: async () => ({}) })],
    ['malformed response', async () => ({ ok: true, json: async () => ({ findings: 'invalid' }) })],
  ])('returns unavailable for %s responses', async (_caseName, makeFetchResponse) => {
    process.env.PARENTAL_REVIEW_EXTRACTION_ENABLED = 'true';
    process.env.LANGEXTRACT_SERVICE_URL = 'http://langextract.internal/extract';
    (global.fetch as jest.Mock).mockResolvedValue(await makeFetchResponse());
    const response = makeResponse();

    await handler(makeRequest({ conversationSegment: 'A conversation' }), response);

    expect(response.body).toEqual({
      status: 'unavailable',
      findings: [],
      sourceExcerpts: [],
    });
  });

  it('returns unavailable when the private service cannot be reached', async () => {
    process.env.PARENTAL_REVIEW_EXTRACTION_ENABLED = 'true';
    process.env.LANGEXTRACT_SERVICE_URL = 'http://langextract.internal/extract';
    (global.fetch as jest.Mock).mockRejectedValue(new Error('connection refused'));
    const response = makeResponse();

    await handler(makeRequest({ conversationSegment: 'A conversation' }), response);

    expect(response.body).toEqual({
      status: 'unavailable',
      findings: [],
      sourceExcerpts: [],
    });
  });
  it('keeps the parental-controls review flow on the browser-safe route', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        findings: [{
          category: 'review_flag',
          severity: 'medium',
          speaker: 'assistant',
          explanation: 'The answer needs a parent review.',
        }],
        sourceExcerpts: ['Please ask a grown-up.'],
      }),
    });

    await expect(parentalControls.requestConversationReview('A conversation')).resolves.toEqual({
      status: 'success',
      findings: [{
        category: 'review_flag',
        severity: 'medium',
        speaker: 'assistant',
        explanation: 'The answer needs a parent review.',
      }],
      sourceExcerpts: ['Please ask a grown-up.'],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/parental-review',
      expect.objectContaining({ method: 'POST' }),
    );
  });


  it('returns unavailable after a timeout without throwing', async () => {
    jest.useFakeTimers();
    process.env.PARENTAL_REVIEW_EXTRACTION_ENABLED = 'true';
    process.env.LANGEXTRACT_SERVICE_URL = 'http://langextract.internal/extract';
    const fetcher = jest.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));

    const reviewPromise = requestParentalReview('A conversation', fetcher);
    jest.advanceTimersByTime(5000);

    await expect(reviewPromise).resolves.toEqual({
      status: 'unavailable',
      findings: [],
      sourceExcerpts: [],
    });
    jest.useRealTimers();
  });
});
