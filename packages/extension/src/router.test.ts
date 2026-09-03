import { describe, expect, it } from 'vitest';
import { createToolRegistry } from './registry.js';
import { createToolRouter } from './router.js';
import type { ToolDefinition, ToolExecutionContext } from './types.js';

const baseCtx: Omit<ToolExecutionContext, 'toolCallId'> = {
  specialistId: 'growth.opportunity-research',
  workPackageId: 'wp-1',
  correlationId: 'corr-1',
};

describe('ToolRouter', () => {
  it('executes an allowlisted, registered tool and returns its output', async () => {
    const registry = createToolRegistry();
    const echo: ToolDefinition = {
      name: 'search_web',
      description: 'echo',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
      handler: async (input) => ({ echoed: input }),
    };
    registry.register(echo);
    const router = createToolRouter({ registry });

    const result = await router.execute(
      { id: 'call_1', name: 'search_web', argumentsJson: '{"query":"healthcare saas"}' },
      ['search_web'],
      baseCtx,
    );

    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ echoed: { query: 'healthcare saas' } });
    expect(result.toolCallId).toBe('call_1');
  });

  it('denies a registered tool that is not on the allowlist (fail closed)', async () => {
    const registry = createToolRegistry();
    registry.register({
      name: 'filesystem.write',
      description: 'writes files',
      parameters: { type: 'object', properties: {} },
      handler: async () => ({}),
    });
    const router = createToolRouter({ registry });

    const result = await router.execute(
      { id: 'call_1', name: 'filesystem.write', argumentsJson: '{}' },
      ['search_web'],
      baseCtx,
    );

    expect(result.status).toBe('denied');
  });

  it('rejects an unknown (unregistered) tool', async () => {
    const registry = createToolRegistry();
    const router = createToolRouter({ registry });

    const result = await router.execute(
      { id: 'call_1', name: 'nonexistent_tool', argumentsJson: '{}' },
      ['nonexistent_tool'],
      baseCtx,
    );

    expect(result.status).toBe('unknown_tool');
  });

  it('reports malformed tool-call arguments without throwing', async () => {
    const registry = createToolRegistry();
    registry.register({
      name: 'search_web',
      description: 'search',
      parameters: { type: 'object', properties: {} },
      handler: async () => ({}),
    });
    const router = createToolRouter({ registry });

    const result = await router.execute(
      { id: 'call_1', name: 'search_web', argumentsJson: '{not valid json' },
      ['search_web'],
      baseCtx,
    );

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/malformed/i);
  });

  it('captures a handler failure as a failed ToolExecutionResult', async () => {
    const registry = createToolRegistry();
    registry.register({
      name: 'search_web',
      description: 'search',
      parameters: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('upstream exploded');
      },
    });
    const router = createToolRouter({ registry });

    const result = await router.execute(
      { id: 'call_1', name: 'search_web', argumentsJson: '{}' },
      ['search_web'],
      baseCtx,
    );

    expect(result.status).toBe('failed');
    expect(result.error).toContain('upstream exploded');
  });

  it('times out a hanging tool handler', async () => {
    const registry = createToolRegistry();
    registry.register({
      name: 'search_web',
      description: 'search',
      parameters: { type: 'object', properties: {} },
      timeoutMs: 20,
      handler: () => new Promise(() => undefined),
    });
    const router = createToolRouter({ registry });

    const result = await router.execute(
      { id: 'call_1', name: 'search_web', argumentsJson: '{}' },
      ['search_web'],
      baseCtx,
    );

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/timed out/i);
  });
});
