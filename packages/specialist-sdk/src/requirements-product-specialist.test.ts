import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('program specialists', () => {
  it('loads requirements.formalize specialist spec', async () => {
    const loaded = await loadSpecFromFile(
      join(repoRoot, 'specialists', 'program', 'requirements-formalize.md'),
    );
    expect(loaded.binding.specialistId).toBe('requirements.formalize');
    expect(loaded.binding.department).toBe('Requirements');
    expect(loaded.binding.authorityClass).toBe('Advise');
    expect(loaded.binding.mandateDomain).toBe('Delivery');
    expect(loaded.binding.interactionMode).toBe('SoloProducer');
    expect(loaded.binding.toolAllowlist).not.toContain('filesystem_read');
  });

  it('loads product.definition specialist spec', async () => {
    const loaded = await loadSpecFromFile(
      join(repoRoot, 'specialists', 'program', 'product-definition.md'),
    );
    expect(loaded.binding.specialistId).toBe('product.definition');
    expect(loaded.binding.department).toBe('Product');
    expect(loaded.binding.authorityClass).toBe('Advise');
    expect(loaded.binding.mandateDomain).toBe('Delivery');
    expect(loaded.binding.interactionMode).toBe('SoloProducer');
    expect(loaded.binding.toolAllowlist).not.toContain('filesystem_read');
  });
});
