import { describe, expect, it, vi } from 'vitest';
import { ModelRoutingError } from '../errors.js';
import type { ChatRequest } from '../types.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const baseRequest: ChatRequest = {
  model: 'qwen/qwen3-8b',
  messages: [{ role: 'user', content: 'Find profitable SaaS opportunities in healthcare.' }],
};

describe('OpenAICompatibleProvider', () => {
  it('sends an OpenAI-compatible request to the configured base URL and no API key header for LM Studio', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { role: 'assistant', content: 'Hello' }, finish_reason: 'stop' }],
      }),
    );
    const provider = new OpenAICompatibleProvider({
      providerId: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      defaultModel: 'qwen/qwen3-8b',
      fetchImpl,
    });

    const response = await provider.chat(baseRequest);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:1234/v1/chat/completions');
    expect(init.headers).not.toHaveProperty('authorization');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('qwen/qwen3-8b');
    expect(body.messages[0]).toEqual({ role: 'user', content: baseRequest.messages[0]?.content });
    expect(response.message.content).toBe('Hello');
    expect(response.finishReason).toBe('stop');
  });

  it('parses an assistant tool_calls response into ToolCallRequest[]', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  type: 'function',
                  id: 'call_1',
                  function: {
                    name: 'search_web',
                    arguments: '{"query":"profitable SaaS opportunities in the healthcare industry"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      }),
    );
    const provider = new OpenAICompatibleProvider({
      providerId: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      defaultModel: 'qwen/qwen3-8b',
      fetchImpl,
    });

    const response = await provider.chat({
      ...baseRequest,
      tools: [
        {
          name: 'search_web',
          description: 'Search the web',
          parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        },
      ],
    });

    expect(response.finishReason).toBe('tool_calls');
    expect(response.message.toolCalls).toEqual([
      {
        id: 'call_1',
        name: 'search_web',
        argumentsJson: '{"query":"profitable SaaS opportunities in the healthcare industry"}',
      },
    ]);
  });

  it('serializes assistant tool_calls and tool result messages back onto the wire', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { role: 'assistant', content: 'done' }, finish_reason: 'stop' }] }),
    );
    const provider = new OpenAICompatibleProvider({
      providerId: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      defaultModel: 'qwen/qwen3-8b',
      fetchImpl,
    });

    await provider.chat({
      model: 'qwen/qwen3-8b',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'search it' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'search_web', argumentsJson: '{"query":"x"}' }],
        },
        { role: 'tool', content: '{"results":[]}', toolCallId: 'call_1', name: 'search_web' },
      ],
    });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages[2]).toEqual({
      role: 'assistant',
      content: '',
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search_web', arguments: '{"query":"x"}' } }],
    });
    expect(body.messages[3]).toEqual({
      role: 'tool',
      content: '{"results":[]}',
      tool_call_id: 'call_1',
      name: 'search_web',
    });
  });

  it('throws ModelRoutingError with code PROVIDER_ERROR on non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('server exploded', { status: 500 }));
    const provider = new OpenAICompatibleProvider({
      providerId: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      defaultModel: 'qwen/qwen3-8b',
      fetchImpl,
      maxAttempts: 1,
    });

    await expect(provider.chat(baseRequest)).rejects.toMatchObject({
      name: 'ModelRoutingError',
      code: 'PROVIDER_ERROR',
    });
  });

  it('retries transient network failures up to maxAttempts', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { role: 'assistant', content: 'recovered' }, finish_reason: 'stop' }] }),
      );
    const provider = new OpenAICompatibleProvider({
      providerId: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      defaultModel: 'qwen/qwen3-8b',
      fetchImpl,
      maxAttempts: 2,
    });

    const response = await provider.chat(baseRequest);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(response.message.content).toBe('recovered');
  });

  it('throws ModelRoutingError INVALID_RESPONSE when choices are missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    const provider = new OpenAICompatibleProvider({
      providerId: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      defaultModel: 'qwen/qwen3-8b',
      fetchImpl,
      maxAttempts: 1,
    });

    await expect(provider.chat(baseRequest)).rejects.toBeInstanceOf(ModelRoutingError);
  });
});
