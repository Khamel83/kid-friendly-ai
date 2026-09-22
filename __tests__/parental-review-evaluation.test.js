const {
  FIXTURES,
  MAX_MESSAGES,
  buildRequest,
  validateFindings,
} = require('../scripts/parental-review-evaluation');

describe('parental-review evaluation contract', () => {
  test('keeps every fixture within endpoint request limit and covers required classes', () => {
    expect(FIXTURES).toHaveLength(5);
    expect(FIXTURES.map((fixture) => fixture.id)).toEqual([
      'age-appropriate',
      'unsafe',
      'ambiguous',
      'multilingual',
      'repeated-occurrence',
    ]);
    expect(Math.max(...FIXTURES.map((fixture) => fixture.messages.length))).toBeLessThanOrEqual(MAX_MESSAGES);
  });

  test('rejects a quote that does not match its message span', () => {
    const fixture = FIXTURES[0];
    const failures = validateFindings(fixture, {
      findings: [{ messageId: 'age-1', start: 0, end: 4, quote: 'nope' }],
    });
    expect(failures.offset).toBe(0);
    expect(failures.quote).toBe(1);
  });

  test('reports out-of-bounds spans separately from quote mismatches', () => {
    const failures = validateFindings(FIXTURES[0], {
      findings: [{ messageId: 'age-1', start: 0, end: 999, quote: 'anything' }],
    });
    expect(failures.schema).toBe(0);
    expect(failures.offset).toBe(1);
    expect(failures.quote).toBe(0);
  });

  test('reports malformed findings as schema failures', () => {
    const failures = validateFindings(FIXTURES[0], {
      findings: [{ messageId: 'age-1', start: '0', end: 1, quote: 'W' }],
    });
    expect(failures.schema).toBe(1);
    expect(failures.offset).toBe(0);
    expect(failures.quote).toBe(0);
  });

  test('distinguishes a repeated phrase reported in the wrong message', () => {
    const fixture = FIXTURES.find((candidate) => candidate.id === 'repeated-occurrence');
    const failures = validateFindings(fixture, {
      findings: [{ messageId: 'repeat-1', start: 18, end: 27, quote: 'sunflower' }],
    });
    expect(failures.quote).toBe(0);
    expect(failures['repeated-occurrence']).toBe(1);
  });

  test('rejects an extra repeated occurrence even when the expected one is present', () => {
    const fixture = FIXTURES.find((candidate) => candidate.id === 'repeated-occurrence');
    const failures = validateFindings(fixture, {
      findings: [
        { messageId: 'repeat-1', start: 18, end: 27, quote: 'sunflower' },
        { messageId: 'repeat-3', start: 8, end: 17, quote: 'sunflower' },
      ],
    });
    expect(failures.quote).toBe(0);
    expect(failures['repeated-occurrence']).toBe(1);
  });

  test('uses the OpenAI-compatible non-streaming Ollama request shape', () => {
    const request = buildRequest(FIXTURES[0], 'test-model');
    expect(request.model).toBe('test-model');
    expect(request.stream).toBe(false);
    expect(request.messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(request.response_format).toEqual({ type: 'json_object' });
  });
});
