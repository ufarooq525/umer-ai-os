import { describe, expect, it } from 'vitest';
import { deriveOperatorBrief, draftHasInventedLift } from './operator-brief';
import type { ContactChannel } from './commercial-intelligence';
import type { OpportunityRecord } from './control-api';

const opportunity = (over: Partial<OpportunityRecord> = {}): OpportunityRecord => ({
  id: 'opp-1',
  type: 'repeatable_service',
  title: 'Digital storefront',
  geography: 'Makkah',
  market: 'Umrah',
  status: 'outreach_ready',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  score: {
    problemSeverity: 80,
    demandEvidence: 80,
    abilityToPay: 80,
    reachability: 60,
    solutionFit: 80,
    competitiveGap: 60,
    deliveryFeasibility: 70,
    evidenceConfidence: 90,
    overall: 78,
    recommendation: 'outreach_ready',
  },
  ...over,
});

const channel = (type: ContactChannel['type'], value: string | null): ContactChannel => ({
  type,
  value,
  source: value ? 'test' : null,
  confidence: value ? 'high' : 'unknown',
  verified: false,
});

describe('draftHasInventedLift', () => {
  it('flags the old 25-35 style drafts', () => {
    expect(draftHasInventedLift('زيادة الحجوزات المباشرة بنسبة 25-35%')).toBe(true);
    expect(draftHasInventedLift('efficiency increase: 20% – 35%')).toBe(true);
    expect(draftHasInventedLift('Price after a short call. No percentage.')).toBe(false);
  });
});

describe('deriveOperatorBrief', () => {
  it('treats a listing with phone and no official site as a call-after-decision, not a traffic promise', () => {
    const brief = deriveOperatorBrief({
      opportunity: opportunity(),
      businessName: 'Mawasm Makkah',
      lastResearchedAt: '2026-09-03T17:26:08.666Z',
      contactChannels: [
        channel('website', null),
        channel('phone', '+966 59 026 1106'),
        channel('email', null),
        channel('maps', 'https://maps.google.com/?cid=1'),
        channel('address', 'Alaziziyyah'),
      ],
      problems: [{ statement: 'The business operates without a public digital storefront.' }],
      evidence: [{ title: 'Business listing without public website', type: 'directory', strength: 'verified' }],
      outreachDrafts: [{ body: 'Estimated pipeline efficiency increase: 20% – 35%' }],
    });
    expect(brief.stance).toBe('decide');
    expect(brief.verdict).toMatch(/no official site/i);
    expect(brief.missing.some((m) => /official website/i.test(m))).toBe(true);
    expect(brief.doNot.some((d) => /old auto-drafts/i.test(d))).toBe(true);
    expect(brief.doNext).toMatch(/Decisions/);
    expect(brief.researchedAt).toBe('2026-09-03T17:26:08.666Z');
  });

  it('says pass when the recommendation is reject', () => {
    const brief = deriveOperatorBrief({
      opportunity: opportunity({
        status: 'rejected',
        score: { ...opportunity().score!, recommendation: 'reject' },
      }),
      businessName: 'Skip This',
      contactChannels: [channel('phone', '+9665')],
      problems: [],
      evidence: [],
    });
    expect(brief.stance).toBe('pass');
    expect(brief.doNext).toMatch(/Leave it/);
  });
});
