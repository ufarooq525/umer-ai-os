import { describe, expect, it } from 'vitest';
import { deriveSendProposal } from './send-proposal';
import type { OpportunityRecord } from './control-api';

const opportunity = (over: Partial<OpportunityRecord> = {}): OpportunityRecord => ({
  id: 'opp-1',
  type: 'niche',
  title: 'Add online booking',
  geography: 'Makkah',
  market: 'transport',
  status: 'outreach_ready',
  estimatedValueMin: 1200,
  estimatedValueMax: 2500,
  currency: 'USD',
  timeToRevenueDays: 21,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe('deriveSendProposal', () => {
  it('writes an honest letter from recorded facts and never invents lift', () => {
    const proposal = deriveSendProposal({
      opportunity: opportunity(),
      businessName: 'Al Ansar Tours',
      email: 'hello@example.com',
      website: 'https://example.com',
      problems: [
        {
          id: 'p1',
          businessId: 'b1',
          nicheId: 'n1',
          runId: 'r1',
          statement: 'WhatsApp-only booking with no deposit',
          severity: 80,
          frequency: 70,
          financialImpact: 60,
          evidenceConfidence: 70,
          evidenceRefs: [],
        },
      ],
      evidence: [
        {
          id: 'e1',
          type: 'observation',
          title: 'No booking form on the homepage',
          sourceUrl: 'https://example.com',
          observedAt: '2026-09-01T00:00:00.000Z',
          observation: 'Contact is WhatsApp only',
          strength: 'moderate',
        },
      ],
    });
    expect(proposal.subject).toContain('Add online booking');
    expect(proposal.body).toContain('Al Ansar Tours');
    expect(proposal.body).toContain('WhatsApp-only booking');
    expect(proposal.body).toContain('No booking form on the homepage');
    expect(proposal.body).toContain('USD 1200–USD 2500');
    expect(proposal.body).not.toMatch(/25-35%|guaranteed/i);
    expect(proposal.canSend).toBe(true);
    expect(proposal.mailto).toMatch(/^mailto:hello%40example.com/);
  });

  it('stays sendable as a copy-paste letter when email is missing', () => {
    const proposal = deriveSendProposal({
      opportunity: opportunity({ estimatedValueMin: undefined, estimatedValueMax: undefined, timeToRevenueDays: undefined }),
      businessName: null,
    });
    expect(proposal.canSend).toBe(false);
    expect(proposal.body).toContain('no price is on this record');
    expect(proposal.blockers.length).toBeGreaterThan(0);
    expect(proposal.body).not.toMatch(/\d+%/);
  });
});
