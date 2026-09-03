import { describe, expect, it } from 'vitest';
import { ExtensionError } from './errors.js';
import { createToolRegistry } from './registry.js';
import type { ToolDefinition } from './types.js';

function tool(name: string): ToolDefinition {
  return {
    name,
    description: `desc for ${name}`,
    parameters: { type: 'object', properties: {} },
    handler: async () => ({ ok: true }),
  };
}

describe('ToolRegistry', () => {
  it('registers and retrieves tools', () => {
    const registry = createToolRegistry();
    registry.register(tool('search_web'));
    expect(registry.has('search_web')).toBe(true);
    expect(registry.get('search_web')?.name).toBe('search_web');
    expect(registry.get('missing')).toBeUndefined();
  });

  it('rejects duplicate registration', () => {
    const registry = createToolRegistry();
    registry.register(tool('search_web'));
    expect(() => registry.register(tool('search_web'))).toThrow(ExtensionError);
  });

  it('listForAllowlist only returns registered tools present in the allowlist', () => {
    const registry = createToolRegistry();
    registry.register(tool('search_web'));
    registry.register(tool('git.diff'));

    const forModel = registry.listForAllowlist(['search_web', 'unregistered.tool']);
    expect(forModel).toEqual([
      { name: 'search_web', description: 'desc for search_web', parameters: { type: 'object', properties: {} } },
    ]);
  });
});
