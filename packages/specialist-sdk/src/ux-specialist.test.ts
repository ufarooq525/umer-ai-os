import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('design specialists', () => {
  it('loads ux.design specialist spec', async () => {
    const loaded = await loadSpecFromFile(
      join(repoRoot, 'specialists', 'design', 'ux-design.md'),
    );
    expect(loaded.binding.specialistId).toBe('ux.design');
    expect(loaded.binding.department).toBe('Design');
    expect(loaded.binding.authorityClass).toBe('Advise');
    expect(loaded.binding.mandateDomain).toBe('Delivery');
    expect(loaded.binding.interactionMode).toBe('SoloProducer');
  });
});
