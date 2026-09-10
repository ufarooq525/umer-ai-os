import { describe, expect, it } from 'vitest';
import { TrustRuntime } from '@umer/trust';
import type { JarvisTool } from '@umer/jarvis-core';
import { createAuthorizedJarvisTools } from './authorization.js';

const context = { sessionId: 's1', correlationId: 'c1', principal: { principalId: 'ceo', kind: 'human' as const } };

const readTool: JarvisTool = {
  name: 'list_agents',
  description: 'test',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  execute: async () => ({ ok: true }),
};

const delegateTool: JarvisTool = {
  name: 'delegate_work',
  description: 'test',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  execute: async () => ({ delegated: true }),
};

describe('JARVIS Trust authorization', () => {
  it('fails closed when no read grant exists', async () => {
    const trust = new TrustRuntime();
    const [tool] = createAuthorizedJarvisTools([readTool], { trust, principal: context.principal });
    await expect(tool.execute({}, context)).rejects.toThrow('authorization denied');
  });

  it('allows read and blocks delegate independently', async () => {
    const trust = new TrustRuntime();
    await trust.registerGrant({ grantId: 'read', principalId: 'ceo', action: 'read', resourceType: 'jarvis', effect: 'allow' });
    const [read] = createAuthorizedJarvisTools([readTool], { trust, principal: context.principal });
    expect(await read.execute({}, context)).toEqual({ ok: true });

    const [delegate] = createAuthorizedJarvisTools([delegateTool], { trust, principal: context.principal });
    await expect(delegate.execute({}, context)).rejects.toThrow('authorization denied');
  });

  it('allows governed delegation only with command execute grant', async () => {
    const trust = new TrustRuntime();
    await trust.registerGrant({ grantId: 'execute', principalId: 'ceo', action: 'execute', resourceType: 'command', effect: 'allow' });
    const [delegate] = createAuthorizedJarvisTools([delegateTool], { trust, principal: context.principal });
    expect(await delegate.execute({}, context)).toEqual({ delegated: true });
  });
});
