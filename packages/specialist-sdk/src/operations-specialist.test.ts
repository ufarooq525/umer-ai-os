import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('operations specialist', () => {
  it('loads operations.verify specialist spec', async () => {
    const loaded = await loadSpecFromFile(
      join(repoRoot, 'specialists', 'operations', 'site-reliability.md'),
    );
    expect(loaded.binding.specialistId).toBe('operations.verify');
    expect(loaded.binding.department).toBe('Operations');
    expect(loaded.binding.authorityClass).toBe('Produce');
    expect(loaded.mandate.contract.toolAllowlist).toContain('filesystem_read');
    expect(loaded.mandate.contract.toolAllowlist).toContain('filesystem_list');
  });
});
