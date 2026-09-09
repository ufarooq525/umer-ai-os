import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('architecture specialist', () => {
  it('loads architecture.design specialist spec and passes activation gate', async () => {
    const loaded = await loadSpecFromFile(
      join(repoRoot, 'specialists', 'architecture', 'solution-design.md'),
    );
    expect(loaded.validation.valid).toBe(true);
    expect(loaded.validation.issues).toEqual([]);
    expect(loaded.binding.specialistId).toBe('architecture.design');
    expect(loaded.binding.department).toBe('Architecture');
    expect(loaded.binding.authorityClass).toBe('Advise');
    expect(loaded.binding.mandateDomain).toBe('Delivery');
    expect(loaded.binding.interactionMode).toBe('SoloProducer');
    expect(loaded.binding.toolAllowlist).not.toContain('filesystem_read');
    expect(loaded.binding.capabilityIds).toEqual([
      'cap.architecture.solution_design',
      'cap.architecture.data_model',
      'cap.architecture.api_design',
    ]);
  });
});
