import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('qa specialists', () => {
  it('loads qa.verify specialist spec', async () => {
    const loaded = await loadSpecFromFile(join(repoRoot, 'specialists', 'qa', 'qa-verify.md'));
    expect(loaded.binding.specialistId).toBe('qa.verify');
    expect(loaded.binding.department).toBe('QA');
    expect(loaded.binding.authorityClass).toBe('Advise');
  });
});
