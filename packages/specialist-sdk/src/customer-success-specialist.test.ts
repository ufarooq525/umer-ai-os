import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSpecFromFile } from './loader.js';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');

describe('customer success account manager specialist', () => {
  it('loads customer-success.account-manager specialist spec', async () => {
    const loaded = await loadSpecFromFile(
      join(repoRoot, 'specialists', 'customer-success', 'account-manager.md'),
    );
    expect(loaded.binding.specialistId).toBe('customer-success.account-manager');
    expect(loaded.binding.department).toBe('CustomerSuccess');
    expect(loaded.binding.authorityClass).toBe('Produce');
    expect(loaded.binding.mandateDomain).toBe('Business');
    expect(loaded.mandate.contract.toolAllowlist).toContain('catalog.read');
    expect(loaded.mandate.contract.toolAllowlist).toContain('filesystem_read');
    expect(loaded.mandate.contract.capabilityIds).toContain('cap.customer_success.account_governance');
    expect(loaded.mandate.contract.capabilityIds).toContain('cap.customer_success.support_triage');
    expect(loaded.mandate.contract.capabilityIds).toContain('cap.customer_success.margin_analysis');
    expect(loaded.mandate.contract.capabilityIds).toContain('cap.customer_success.learning_extraction');
  });
});
