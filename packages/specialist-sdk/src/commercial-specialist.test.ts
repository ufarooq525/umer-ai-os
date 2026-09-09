import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('commercial sales specialist', () => {
  it('loads commercial.sales-representative specialist spec', async () => {
    const loaded = await loadSpecFromFile(
      join(repoRoot, 'specialists', 'commercial', 'sales-representative.md'),
    );
    expect(loaded.binding.specialistId).toBe('commercial.sales-representative');
    expect(loaded.binding.department).toBe('Commercial');
    expect(loaded.binding.authorityClass).toBe('Produce');
    expect(loaded.binding.mandateDomain).toBe('Business');
    expect(loaded.mandate.contract.toolAllowlist).toContain('catalog.read');
    expect(loaded.mandate.contract.toolAllowlist).toContain('filesystem_read');
    expect(loaded.mandate.contract.capabilityIds).toContain('cap.commercial.outreach');
    expect(loaded.mandate.contract.capabilityIds).toContain('cap.commercial.qualification');
    expect(loaded.mandate.contract.capabilityIds).toContain('cap.commercial.proposal');
  });
});
