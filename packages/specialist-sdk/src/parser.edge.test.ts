import { describe, expect, it } from 'vitest';
import { parseMarkdownSpec } from './parser.js';
import { buildMandate } from './mandate.js';
import { buildValidSpecialistSpec } from './test-utils.js';

describe('parser edge cases', () => {
  it('parses enterprise sections by title without E prefix', () => {
    const content = `${buildValidSpecialistSpec()}\n## Human Accountability Anchor\n\nanchor: Backup Lead`;
    const parsed = parseMarkdownSpec(content);
    expect(parsed.enterpriseSections.E18).toBeDefined();
  });

  it('uses metadata and frontmatter fallbacks when building mandate', () => {
    const content = buildValidSpecialistSpec().replace(
      'specialist_id: eng.app-delivery',
      'specialist_id: eng.fallback',
    );
    const mandate = buildMandate(parseMarkdownSpec(content));
    expect(mandate.contract.specialistId).toBe('eng.fallback');
    expect(mandate.contract.skillBindings.length).toBeGreaterThan(0);
  });

  it('derives specialist id from department when frontmatter id is absent', () => {
    const content = buildValidSpecialistSpec().replace('specialist_id: eng.app-delivery\n', '');
    const mandate = buildMandate(parseMarkdownSpec(content));
    expect(mandate.contract.specialistId).toBe('engineering.specialist');
  });

  it('applies enum fallbacks for invalid metadata values', () => {
    const content = buildValidSpecialistSpec()
      .replace('mandate_domain: Delivery', 'mandate_domain: InvalidDomain')
      .replace('authority_class: Produce', 'authority_class: NotReal')
      .replace('interaction_mode: SoloProducer', 'interaction_mode: BadMode')
      .replace('status: Registered', 'status: NotAStatus');
    const mandate = buildMandate(parseMarkdownSpec(content));
    expect(mandate.contract.mandateDomain).toBe('Delivery');
    expect(mandate.contract.authorityClass).toBe('Produce');
    expect(mandate.contract.interactionMode).toBe('SoloProducer');
    expect(mandate.contract.status).toBe('Registered');
  });

  it('falls back to untitled specialist when heading is missing', () => {
    const content = buildValidSpecialistSpec().replace('# Application Delivery Specialist\n\n', '');
    expect(parseMarkdownSpec(content).title).toBe('Untitled Specialist');
  });

  it('uses cap.unbound when no capability ids are declared', () => {
    const content = buildValidSpecialistSpec().replace(
      '## E2 — Capability Accountability\n\n- cap.app.delivery\n- cap.code.review',
      '## E2 — Capability Accountability\n\nNo capability identifiers in this section.',
    );
    const mandate = buildMandate(parseMarkdownSpec(content));
    expect(mandate.contract.capabilityIds).toEqual(['cap.unbound']);
  });

  it('reads capability ids from scalar fallback in E2', () => {
    const content = buildValidSpecialistSpec().replace(
      '## E2 — Capability Accountability\n\n- cap.app.delivery\n- cap.code.review',
      '## E2 — Capability Accountability\n\ncapability_ids: cap.scalar.only',
    );
    const mandate = buildMandate(parseMarkdownSpec(content));
    expect(mandate.contract.capabilityIds).toContain('cap.scalar.only');
  });
});
