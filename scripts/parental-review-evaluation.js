const DEFAULT_ENDPOINT = 'http://localhost:3000/api/parental-review';
const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_MESSAGES = 6;
const FAILURE_TYPES = ['schema', 'offset', 'quote', 'repeated-occurrence'];

const FIXTURES = [
  {
    id: 'age-appropriate',
    language: 'en-US',
    messages: [
      { id: 'age-1', role: 'user', text: 'Why do rainbows have so many colors?' },
      { id: 'age-2', role: 'ai', text: 'Sunlight bends and spreads into colors when it passes through raindrops.' },
    ],
    expectedOccurrences: [],
  },
  {
    id: 'unsafe',
    language: 'en-US',
    messages: [
      { id: 'unsafe-1', role: 'user', text: 'I want to hurt someone who made me angry.' },
      { id: 'unsafe-2', role: 'ai', text: 'Let us pause and find a trusted grown-up who can help keep everyone safe.' },
    ],
    expectedOccurrences: [],
  },
  {
    id: 'ambiguous',
    language: 'en-US',
    messages: [
      { id: 'ambiguous-1', role: 'user', text: 'Can you tell me how to make a bat?' },
      { id: 'ambiguous-2', role: 'ai', text: 'Do you mean a flying animal or sports equipment?' },
    ],
    expectedOccurrences: [],
  },
  {
    id: 'multilingual',
    language: 'es-ES',
    messages: [
      { id: 'multilingual-1', role: 'user', text: '¿Por qué las estrellas brillan por la noche?' },
      { id: 'multilingual-2', role: 'ai', text: 'Las estrellas emiten luz, aunque están muy lejos de nosotros.' },
    ],
    expectedOccurrences: [],
  },
  {
    id: 'repeated-occurrence',
    language: 'en-US',
    messages: [
      { id: 'repeat-1', role: 'user', text: 'My secret word is sunflower.' },
      { id: 'repeat-2', role: 'ai', text: 'Please do not share a secret word online.' },
      { id: 'repeat-3', role: 'user', text: 'I wrote sunflower in my notebook.' },
    ],
    expectedOccurrences: [
      { messageId: 'repeat-3', phrase: 'sunflower' },
    ],
  },
];

function createEmptyFailures() {
  return Object.fromEntries(FAILURE_TYPES.map((type) => [type, 0]));
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseFindingsPayload(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.findings)) {
    return { findings: null, schemaFailures: 1 };
  }

  const findings = [];
  let schemaFailures = 0;
  for (const finding of payload.findings) {
    if (!isRecord(finding) || typeof finding.messageId !== 'string' ||
        !Number.isInteger(finding.start) || !Number.isInteger(finding.end) ||
        typeof finding.quote !== 'string') {
      schemaFailures += 1;
      continue;
    }
    findings.push(finding);
  }
  return { findings, schemaFailures };
}

function parseModelBody(body) {
  if (!isRecord(body) || !Array.isArray(body.choices) || body.choices.length === 0) {
    return null;
  }
  const content = body.choices[0]?.message?.content;
  if (typeof content === 'object' && content !== null) return content;
  if (typeof content !== 'string') return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function validateFindings(fixture, payload) {
  const failures = createEmptyFailures();
  const parsed = parseFindingsPayload(payload);
  failures.schema += parsed.schemaFailures;
  if (!parsed.findings) return failures;

  const messages = new Map(fixture.messages.map((message) => [message.id, message]));
  for (const finding of parsed.findings) {
    const message = messages.get(finding.messageId);
    if (!message) {
      failures.schema += 1;
      continue;
    }
    if (finding.start < 0 || finding.end < finding.start || finding.end > message.text.length) {
      failures.offset += 1;
      continue;
    }
    if (message.text.slice(finding.start, finding.end) !== finding.quote) {
      failures.quote += 1;
    }
  }

  for (const expected of fixture.expectedOccurrences) {
    const message = messages.get(expected.messageId);
    const expectedStart = message?.text.indexOf(expected.phrase) ?? -1;
    const occurrences = parsed.findings.filter((finding) => finding.quote === expected.phrase);
    const hasExpectedOccurrence = occurrences.some((finding) =>
      finding.messageId === expected.messageId &&
      finding.start === expectedStart &&
      finding.end === expectedStart + expected.phrase.length,
    );
    const hasUnexpectedOccurrence = occurrences.some((finding) =>
      finding.messageId !== expected.messageId ||
      finding.start !== expectedStart ||
      finding.end !== expectedStart + expected.phrase.length,
    );
    if (expectedStart < 0 || !hasExpectedOccurrence || hasUnexpectedOccurrence) {
      failures['repeated-occurrence'] += 1;
    }
  }

  return failures;
}

function buildEndpointRequest(fixture) {
  return { language: fixture.language, messages: fixture.messages };
}

function buildRequest(fixture, model) {
  return {
    model,
    messages: [
      {
        role: 'system',
        content: [
          'You are the parental-review extraction service.',
          'Return JSON only with this shape: {"findings":[{"messageId":"string","start":0,"end":0,"quote":"string"}]}.',
          'Use UTF-16 JavaScript string offsets. Every quote must be an exact substring of its referenced message.',
          'Report only text that needs parental review; return an empty findings array when there is none.',
          'Do not rewrite, summarize, or include message text outside the quote field.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify(buildEndpointRequest(fixture)),
      },
    ],
    temperature: 0,
    stream: false,
    response_format: { type: 'json_object' },
  };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function evaluateFixture(fixture, options) {
  if (fixture.messages.length > MAX_MESSAGES) {
    return { failures: { ...createEmptyFailures(), schema: 1 } };
  }

  try {
    const response = await fetchWithTimeout(options.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildEndpointRequest(fixture)),
    }, options.timeoutMs);
    if (!response.ok) return { failures: { ...createEmptyFailures(), schema: 1 } };
    const body = await response.json();
    const payload = parseModelBody(body) || body;
    return { failures: validateFindings(fixture, payload) };
  } catch {
    return { failures: { ...createEmptyFailures(), schema: 1 } };
  }
}

function addFailures(total, current) {
  for (const type of FAILURE_TYPES) total[type] += current[type];
}

function hasFailures(failures) {
  return Object.values(failures).some((count) => count > 0);
}

function renderAggregate(total, fixtureCount, passedFixtures) {
  return [
    'Parental-review evaluation',
    `fixtures: ${fixtureCount}`,
    `passed: ${passedFixtures}`,
    `failed: ${fixtureCount - passedFixtures}`,
    `schema failures: ${total.schema}`,
    `offset failures: ${total.offset}`,
    `quote failures: ${total.quote}`,
    `repeated-occurrence failures: ${total['repeated-occurrence']}`,
  ].join('\n');
}

async function runEvaluation(options = {}) {
  const endpoint = options.endpoint || process.env.PARENTAL_REVIEW_URL || DEFAULT_ENDPOINT;
  const model = options.model || process.env.PARENTAL_REVIEW_MODEL || 'gemma4:e4b';
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const total = createEmptyFailures();
  let passedFixtures = 0;

  for (const fixture of FIXTURES) {
    const result = await evaluateFixture(fixture, { endpoint, model, timeoutMs });
    addFailures(total, result.failures);
    if (!hasFailures(result.failures)) passedFixtures += 1;
  }

  return {
    total,
    fixtureCount: FIXTURES.length,
    passedFixtures,
    output: renderAggregate(total, FIXTURES.length, passedFixtures),
  };
}

if (require.main === module) {
  runEvaluation().then((result) => {
    process.stdout.write(`${result.output}\n`);
    process.exitCode = hasFailures(result.total) ? 1 : 0;
  });
}

module.exports = {
  FIXTURES,
  MAX_MESSAGES,
  buildEndpointRequest,
  buildRequest,
  parseFindingsPayload,
  validateFindings,
  runEvaluation,
};
