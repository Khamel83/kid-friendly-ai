import { streamChat } from './llmClient';
import { TextDecoder, TextEncoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });

function streamedResponse(parts: string[]): Response {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => index < parts.length
          ? { done: false, value: encoder.encode(parts[index++]) }
          : { done: true, value: undefined },
      }),
    },
  } as Response;
}

describe('Buddy cloud stream', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps split SSE lines and history intact', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(streamedResponse([
      'data: {"type":"chunk","content":"Hel',
      'lo"}\n\ndata: {"type":"done"}\n\n',
    ]));
    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await streamChat('new question', [{ speaker: 'user', text: 'prior question' }], 'cloud', { onChunk, onDone, onError });

    expect(onChunk).toHaveBeenCalledWith('Hello');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      question: 'new question',
      conversationHistory: [{ speaker: 'user', text: 'prior question' }],
    });
  });

  it('reports an SSE error without reporting completion', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(streamedResponse([
      'data: {"type":"error","content":"Provider unavailable"}\n\n',
    ]));
    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    await streamChat('question', [], 'cloud', { onChunk, onDone, onError });

    expect(onError).toHaveBeenCalledWith('Provider unavailable');
    expect(onDone).not.toHaveBeenCalled();
    expect(onChunk).not.toHaveBeenCalled();
  });
});
