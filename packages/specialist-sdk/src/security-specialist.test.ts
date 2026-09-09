import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('security specialists', () => {
  it('loads security.review specialist spec', async () => {
    const loaded = await loadSpecFromFile(
      join(repoRoot, 'specialists', 'security', 'security-review.md'),
    );
    expect(loaded.binding.specialistId).toBe('security.review');
    expect(loaded.binding.department).toBe('Security');
    expect(loaded.binding.authorityClass).toBe('Advise');
  });
});
