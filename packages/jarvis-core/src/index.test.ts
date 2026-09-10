import { describe, expect, it } from 'vitest';
import type { LLMProvider } from '@umer/model-routing';
import { JarvisCore } from './index.js';

function provider(responses: Array<Awaited<ReturnType<LLMProvider['chat']>>>): LLMProvider {
  let index = 0;
  return {
    providerId: 'test',
    async chat() {
      return responses[index++] ?? responses.at(-1)!;
    },
  };
}

describe('JarvisCore', () => {
  it('answers directly without tools', async () => {
    const jarvis = new JarvisCore({
      provider: provider([{ message: { role: 'assistant', content: 'Good morning.' }, finishReason: 'stop' }]),
    });

    const result = await jarvis.respond('session-1', 'Good morning');
    expect(result.assistantMessage).toBe('Good morning.');
    expect(result.toolCalls).toHaveLength(0);
  });

  it('executes a registered tool and feeds the result back to the model', async () => {
    const calls: unknown[] = [];
    const jarvis = new JarvisCore({
      provider: provider([
        {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [{ id: 'call-1', name: 'system_status', argumentsJson: '{}' }],
          },
          finishReason: 'tool_calls',
        },
        { message: { role: 'assistant', content: 'The system is healthy.' }, finishReason: 'stop' },
      ]),
      tools: [
        {
          name: 'system_status',
          description: 'Read system health.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          execute: async (input) => {
            calls.push(input);
            return { status: 'healthy' };
          },
        },
      ],
    });

    const result = await jarvis.respond('session-2', 'How is the system?');
    expect(result.assistantMessage).toBe('The system is healthy.');
    expect(calls).toEqual([{}]);
    expect(result.toolCalls[0]?.result).toEqual({ status: 'healthy' });
  });

  it('fails closed on an unregistered tool instead of executing it', async () => {
    const jarvis = new JarvisCore({
      provider: provider([
        {
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [{ id: 'call-1', name: 'dangerous_action', argumentsJson: '{}' }],
          },
          finishReason: 'tool_calls',
        },
        { message: { role: 'assistant', content: 'I could not execute that action.' }, finishReason: 'stop' },
      ]),
    });

    const result = await jarvis.respond('session-3', 'Do it');
    expect(result.toolCalls[0]?.error).toContain('not registered');
  });
});
