import { describe, expect, it } from 'vitest';
import { parseMarkdownSpec } from './parser.js';
import { validateActivationGate } from './validator.js';
import { buildValidSpecialistSpec } from './test-utils.js';

describe('validateActivationGate', () => {
  it('passes a complete specialist spec', () => {
    const parsed = parseMarkdownSpec(buildValidSpecialistSpec());
    const result = validateActivationGate(parsed);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails when agent section is missing', () => {
    const parsed = parseMarkdownSpec(buildValidSpecialistSpec({ omitSection: 'Mission' }));
    const result = validateActivationGate(parsed);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.section === 'Mission')).toBe(true);
  });

  it('fails when enterprise section is missing', () => {
    const parsed = parseMarkdownSpec(buildValidSpecialistSpec({ omitSection: 'E18' }));
    const result = validateActivationGate(parsed);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.section === 'E18')).toBe(true);
  });

  it('fails when examples section lacks worked example', () => {
    const content = buildValidSpecialistSpec().replace(
      '## Examples\n\nInput: sample task brief.\nOutput: completed delivery artifact with acceptance evidence.',
      '## Examples\n\nThis section is long enough to pass length checks but has no worked sample pair.',
    );
    const parsed = parseMarkdownSpec(content);
    const result = validateActivationGate(parsed);
    expect(result.issues.some((issue) => issue.code === 'EXAMPLE_MISSING')).toBe(true);
  });

  it('flags weak non-goals section', () => {
    const content = buildValidSpecialistSpec().replace(
      'Must refuse Business portfolio decisions and silent mandate expansion.',
      'General guidance only without refusal boundaries.',
    );
    const parsed = parseMarkdownSpec(content);
    const result = validateActivationGate(parsed);
    expect(result.issues.some((issue) => issue.code === 'NON_GOALS_WEAK')).toBe(true);
  });

  it('flags missing human anchor content', () => {
    const content = buildValidSpecialistSpec().replace(
      '## E18 — Human Accountability Anchor\n\nanchor: Engineering Lead',
      '## E18 — Human Accountability Anchor\n\n   ',
    );
    const parsed = parseMarkdownSpec(content);
    const result = validateActivationGate(parsed);
    expect(result.issues.some((issue) => issue.code === 'HUMAN_ANCHOR_MISSING')).toBe(true);
  });
});
