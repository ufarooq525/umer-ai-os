import { describe, expect, it } from 'vitest';
import { InMemoryRegistryAdapter, registerBinding } from './registry.js';
import { bindMandate, buildMandate } from './mandate.js';
import { parseMarkdownSpec } from './parser.js';
import { buildValidSpecialistSpec } from './test-utils.js';
import { SpecialistSdkError } from './errors.js';

describe('registry', () => {
  it('registers runtime bindings in memory', async () => {
    const adapter = new InMemoryRegistryAdapter();
    const binding = bindMandate(buildMandate(parseMarkdownSpec(buildValidSpecialistSpec())));
    await registerBinding(adapter, binding);
    expect(adapter.get('eng.app-delivery')?.specHash).toBe(binding.specHash);
    expect(adapter.list()).toHaveLength(1);
  });

  it('wraps registration failures', async () => {
    const adapter: InMemoryRegistryAdapter = {
      register: async () => {
        throw new Error('registry unavailable');
      },
    };
    const binding = bindMandate(buildMandate(parseMarkdownSpec(buildValidSpecialistSpec())));
    await expect(registerBinding(adapter, binding)).rejects.toThrow(SpecialistSdkError);
  });

  it('clears registry entries', async () => {
    const adapter = new InMemoryRegistryAdapter();
    const binding = bindMandate(buildMandate(parseMarkdownSpec(buildValidSpecialistSpec())));
    await registerBinding(adapter, binding);
    adapter.clear();
    expect(adapter.list()).toHaveLength(0);
  });
});
