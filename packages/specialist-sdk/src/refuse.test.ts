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

  it('never matches a non-goal purely from toolName — a real tool name is an identifier, not a description of the request', () => {
    // Confirmed live: security.review's real, load-bearing process_run_audit
    // tool contains "audit", which is also a keyword extracted from that
    // same mandate's own non-goal text — if toolName fed the same haystack
    // as action, every legitimate use of that tool would be refused.
    const decision = evaluateRefusal(mandate, { toolName: 'business.audit' });
    expect(decision.refused).toBe(true);
    expect(decision.matchedNonGoal).toBeUndefined();
    expect(decision.reason).toContain('is not on the specialist allowlist');
  });

  it('skips the non-goal check entirely when no action is supplied, still enforcing the tool allowlist', () => {
    const decision = evaluateRefusal(mandate, { toolName: 'git.diff' });
    expect(decision.refused).toBe(false);
  });

  it('exposes refusal surface for agent runtime', () => {
    const surface = getRefusalSurface(mandate);
    expect(surface.nonGoals.length).toBeGreaterThan(0);
    expect(surface.authorityClass).toBe('Produce');
  });
});
