import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('engineering specialists', () => {
  it('loads eng.app-delivery specialist spec', async () => {
    const loaded = await loadSpecFromFile(
      join(repoRoot, 'specialists', 'engineering', 'application-delivery.md'),
    );
    expect(loaded.binding.specialistId).toBe('eng.app-delivery');
    expect(loaded.binding.department).toBe('Engineering');
    expect(loaded.binding.authorityClass).toBe('Produce');
  });
});
