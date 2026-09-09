import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('release specialist', () => {
  it('loads release.prepare specialist spec', async () => {
    const loaded = await loadSpecFromFile(
      join(repoRoot, 'specialists', 'release', 'release-management.md'),
    );
    expect(loaded.binding.specialistId).toBe('release.prepare');
    expect(loaded.binding.department).toBe('Release');
    expect(loaded.binding.authorityClass).toBe('Produce');
    expect(loaded.mandate.contract.toolAllowlist).toContain('filesystem_read');
    expect(loaded.mandate.contract.toolAllowlist).toContain('filesystem_list');
  });
});
