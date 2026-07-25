import { describe, expect, it } from 'vitest';
import { decideIntakeRouting, routeIntakeGoal, TYPE_SPECIALISTS } from './pm-routing.js';

describe('routeIntakeGoal', () => {
  it('routes look-and-feel complaints to the design desk', () => {
    const routing = routeIntakeGoal({
      goal: 'the ui of this application is so weird and traditional, please improve the layout',
    });
    expect(routing.suggestedType).toBe('ux');
    expect(routing.writesCode).toBe(false);
    expect(routing.followUp).toContain('feature or bug');
    expect(routing.signals).toContain('ui');
  });

  it('routes a misbehaving flow to the bug desk', () => {
    const routing = routeIntakeGoal({
      goal: 'checkout is broken and throws a 500 error when a coupon is applied',
    });
    expect(routing.suggestedType).toBe('bug');
    expect(routing.writesCode).toBe(true);
    expect(routing.confidence).toBe('high');
  });

  it('routes new behaviour to the feature desk', () => {
    const routing = routeIntakeGoal({
      goal: 'add CSV export to the invoices list and allow users to pick a date range',
    });
    expect(routing.suggestedType).toBe('feature');
    expect(routing.writesCode).toBe(true);
  });

  it('routes search visibility work to the growth desk', () => {
    const routing = routeIntakeGoal({
      goal: 'our sitemap is missing and meta description tags are empty, hurting rankings',
    });
    expect(routing.suggestedType).toBe('seo');
    expect(routing.specialists).toEqual(TYPE_SPECIALISTS.seo);
  });

  it('routes vulnerability wording to the security desk', () => {
    const routing = routeIntakeGoal({
      goal: 'review the admin panel for sql injection and unauthorized access',
    });
    expect(routing.suggestedType).toBe('security');
    expect(routing.followUp).toContain('report-only');
  });

  it('routes speed wording to the performance desk', () => {
    const routing = routeIntakeGoal({
      goal: 'the landing page is slow, lcp is above 4s in lighthouse',
    });
    expect(routing.suggestedType).toBe('perf');
  });

  it('routes coverage wording to the quality desk', () => {
    const routing = routeIntakeGoal({
      goal: 'write tests for the enrollment flow and improve test coverage',
    });
    expect(routing.suggestedType).toBe('qa');
  });

  it('keeps an open question at brainstorm', () => {
    const routing = routeIntakeGoal({
      goal: 'should we split the portal into two apps or keep one monolith?',
    });
    expect(routing.suggestedType).toBe('brainstorm');
  });

  it('never matches ui inside unrelated words', () => {
    const routing = routeIntakeGoal({ goal: 'build a guide for the quiz builder module' });
    expect(routing.signals).not.toContain('ui');
    expect(routing.suggestedType).toBe('feature');
  });

  it('falls back to feature with low confidence when nothing matches', () => {
    const routing = routeIntakeGoal({ goal: 'handle the thing we discussed yesterday' });
    expect(routing.suggestedType).toBe('feature');
    expect(routing.confidence).toBe('low');
    expect(routing.reason).toContain('Nothing in the wording');
  });

  it('reads doneWhen and constraints as part of the signal', () => {
    const routing = routeIntakeGoal({
      goal: 'go over the portal once more',
      doneWhen: 'spacing and typography are consistent across pages',
    });
    expect(routing.suggestedType).toBe('ux');
  });

  it('ranks alternatives without repeating the winner', () => {
    const routing = routeIntakeGoal({
      goal: 'the checkout ui is broken and the layout throws an error on mobile',
    });
    expect(routing.alternatives.some((a) => a.type === routing.suggestedType)).toBe(false);
    expect(routing.candidates.length).toBeGreaterThan(1);
  });

  it('is deterministic for the same input', () => {
    const goal = 'redesign the dashboard navigation for mobile view';
    expect(routeIntakeGoal({ goal })).toEqual(routeIntakeGoal({ goal }));
  });
});

describe('decideIntakeRouting', () => {
  it('never overrides the operator type', () => {
    const decision = decideIntakeRouting({
      requestedType: 'feature',
      goal: 'the ui looks dated, redesign the layout',
    });
    expect(decision.requestedType).toBe('feature');
    expect(decision.suggestedType).toBe('ux');
    expect(decision.agreed).toBe(false);
    expect(decision.note).toContain('reads like ux');
  });

  it('confirms agreement when the operator matches PM', () => {
    const decision = decideIntakeRouting({
      requestedType: 'bug',
      goal: 'login is broken and throws an exception',
    });
    expect(decision.agreed).toBe(true);
    expect(decision.note).toContain('PM agrees');
  });
});
