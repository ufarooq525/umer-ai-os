import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('growth specialists', () => {
  it('loads seo.audit specialist spec', async () => {
    const loaded = await loadSpecFromFile(join(repoRoot, 'specialists', 'growth', 'seo-audit.md'));
    expect(loaded.binding.specialistId).toBe('seo.audit');
    expect(loaded.binding.department).toBe('Growth');
    expect(loaded.binding.authorityClass).toBe('Advise');
  });
});
