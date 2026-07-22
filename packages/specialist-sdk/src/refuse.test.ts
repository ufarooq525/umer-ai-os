import { describe, expect, it } from 'vitest';
import { evaluateRefusal, getRefusalSurface } from './refuse.js';
import { buildMandate } from './mandate.js';
import { parseMarkdownSpec } from './parser.js';
import { buildValidSpecialistSpec } from './test-utils.js';

describe('refuse', () => {
  const mandate = buildMandate(parseMarkdownSpec(buildValidSpecialistSpec()));

  it('refuses actions matching non-goals', () => {
    const decision = evaluateRefusal(mandate, {
      action: 'approve Business portfolio decisions',
    });
    expect(decision.refused).toBe(true);
    expect(decision.matchedNonGoal).toBeDefined();
  });

  it('refuses tools outside allowlist', () => {
    const decision = evaluateRefusal(mandate, {
      action: 'run deploy',
      toolName: 'shell.exec',
    });
    expect(decision.refused).toBe(true);
  });

  it('allows permitted tools', () => {
    const decision = evaluateRefusal(mandate, {
      action: 'inspect diff',
      toolName: 'git.diff',
    });
    expect(decision.refused).toBe(false);
  });

  it('exposes refusal surface for agent runtime', () => {
    const surface = getRefusalSurface(mandate);
    expect(surface.nonGoals.length).toBeGreaterThan(0);
    expect(surface.authorityClass).toBe('Produce');
  });
});
