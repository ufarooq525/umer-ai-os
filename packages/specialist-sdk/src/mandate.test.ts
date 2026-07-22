import { describe, expect, it } from 'vitest';
import { bindMandate, buildMandate } from './mandate.js';
import { parseMarkdownSpec } from './parser.js';
import { SpecialistSdkError } from './errors.js';
import { buildValidSpecialistSpec } from './test-utils.js';

describe('mandate', () => {
  it('builds typed specialist contract from markdown', () => {
    const parsed = parseMarkdownSpec(buildValidSpecialistSpec());
    const mandate = buildMandate(parsed);
    expect(mandate.contract.specialistId).toBe('eng.app-delivery');
    expect(mandate.contract.department).toBe('Engineering');
    expect(mandate.contract.capabilityIds).toContain('cap.app.delivery');
    expect(mandate.nonGoals.length).toBeGreaterThan(0);
    expect(mandate.specHash).toHaveLength(64);
  });

  it('binds runtime binding surface', () => {
    const mandate = buildMandate(parseMarkdownSpec(buildValidSpecialistSpec()));
    const binding = bindMandate(mandate);
    expect(binding.specHash).toBe(mandate.specHash);
    expect(binding.toolAllowlist).toContain('git.diff');
    expect(binding.humanAccountabilityAnchor).toContain('Engineering Lead');
  });

  it('rejects binding without mission', () => {
    const mandate = buildMandate(parseMarkdownSpec(buildValidSpecialistSpec()));
    mandate.contract = { ...mandate.contract, mission: '' };
    expect(() => bindMandate(mandate)).toThrow(SpecialistSdkError);
  });
});
