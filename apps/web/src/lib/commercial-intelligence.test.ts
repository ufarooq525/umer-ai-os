import { describe, expect, it } from 'vitest';
import {
  deriveCommercialAttentionCases,
  deriveContactChannels,
  deriveOpportunityActivity,
  deriveOutreachReadiness,
  deriveProspectFit,
  deriveSocialChannels,
} from './commercial-intelligence';
import type {
  BusinessProspectRecord,
  CommercialIntelligenceSummary,
  DiscoveryCandidateRecord,
  EvidenceRecord,
  OpportunityRecord,
  OpportunityRunEventRecord,
  OutreachDraftRecord,
} from './control-api';

const evidence = (over: Partial<EvidenceRecord> = {}): EvidenceRecord => ({
  id: 'ev-1',
  type: 'social_post',
  title: 'Facebook page linked from their website',
  sourceUrl: 'https://www.facebook.com/al-haramain-transport',
  observedAt: '2026-09-01T00:00:00.000Z',
  observation: 'Found on their website. Unverified.',
  strength: 'moderate',
  ...over,
});

const candidate = (over: Partial<DiscoveryCandidateRecord> = {}): DiscoveryCandidateRecord => ({
  id: 'cand-1',
  runId: 'run-1',
  nicheId: 'niche-1',
  name: 'Al-Haramain VIP Transport',
  websiteUrl: 'https://al-haramain-transport.example',
  phone: '+966501234567',
  address: 'Makkah, Saudi Arabia',
  geography: 'Makkah',
  discoveredAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const business = (over: Partial<BusinessProspectRecord> = {}): BusinessProspectRecord => ({
  id: 'biz-1',
  name: 'Al-Haramain VIP Transport',
  geography: 'Makkah',
  discoveredAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const opportunity = (over: Partial<OpportunityRecord> = {}): OpportunityRecord => ({
  id: 'opp-1',
  type: 'repeatable_service',
  title: 'Booking system',
  geography: 'Makkah',
  market: 'Saudi Umrah',
  businessId: 'biz-1',
  score: {
    problemSeverity: 70,
    demandEvidence: 80,
    abilityToPay: 75,
    reachability: 60,
    solutionFit: 80,
    competitiveGap: 65,
    deliveryFeasibility: 75,
    evidenceConfidence: 90,
    overall: 78,
    recommendation: 'outreach_ready',
  },
  status: 'outreach_ready',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const draft = (over: Partial<OutreachDraftRecord> = {}): OutreachDraftRecord => ({
  id: 'draft-1',
  opportunityId: 'opp-1',
  businessId: 'biz-1',
  nicheId: 'niche-1',
  channel: 'whatsapp',
  body: 'draft body',
  language: 'ar',
  valueProposition: 'automate booking',
  evidenceRefs: [],
  status: 'drafted',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

describe('deriveContactChannels', () => {
  it('surfaces real Google-Places-sourced phone, website and address as high confidence', () => {
    const channels = deriveContactChannels(business({ website: undefined }), candidate());
    const byType = Object.fromEntries(channels.map((c) => [c.type, c]));
    expect(byType.website).toMatchObject({ value: 'https://al-haramain-transport.example', confidence: 'high', source: 'Google Places' });
    expect(byType.phone).toMatchObject({ value: '+966501234567', confidence: 'high', verified: false });
    expect(byType.address).toMatchObject({ value: 'Makkah, Saudi Arabia', confidence: 'high' });
    expect(byType.address?.href).toContain('google.com/maps');
    expect(byType.maps?.href).toContain('google.com/maps');
  });

  it('exposes the real Google Maps listing URL from sourceRefs so the founder can cross-check', () => {
    const maps = 'https://maps.google.com/?cid=433693025369287885';
    const channels = deriveContactChannels(
      business({
        sourceRefs: ['google-places:ChIJB55wMTAFwhURzWyzPoLJBAY', maps, 'phone:+966 59 026 1106', 'address:Alaziziyyah, Makkah'],
      }),
      candidate({ websiteUrl: undefined, sourceRefs: ['google-places:ChIJB55wMTAFwhURzWyzPoLJBAY', maps] }),
    );
    const mapsChannel = channels.find((c) => c.type === 'maps');
    expect(mapsChannel?.value).toBe(maps);
    expect(mapsChannel?.href).toBe(maps);
  });

  it('never invents an email or marks anything verified when no discovery candidate exists', () => {
    const channels = deriveContactChannels(business(), null);
    const byType = Object.fromEntries(channels.map((c) => [c.type, c]));
    expect(byType.phone).toMatchObject({ value: null, confidence: 'unknown' });
    expect(byType.email).toMatchObject({ value: null, confidence: 'unknown' });
    expect(channels.every((c) => c.verified === false)).toBe(true);
  });

  it('recovers an email only from an explicit sourceRefs email: prefix, at medium confidence', () => {
    const channels = deriveContactChannels(business({ sourceRefs: ['email:booking@example.com'] }), null);
    const email = channels.find((c) => c.type === 'email');
    expect(email).toMatchObject({ value: 'booking@example.com', confidence: 'medium' });
  });

  it('marks whatsapp as low confidence since it is only inferred from the phone number', () => {
    const channels = deriveContactChannels(business(), candidate());
    const whatsapp = channels.find((c) => c.type === 'whatsapp');
    expect(whatsapp).toMatchObject({ value: '+966501234567', confidence: 'low' });
  });

  it('recovers phone and address from sourceRefs when the structured columns are empty — the real shape live Google Places data actually has', () => {
    const channels = deriveContactChannels(
      business(),
      candidate({
        phone: undefined,
        address: undefined,
        sourceRefs: ['google-places:abc', 'phone:+966 53 351 9689', 'address:Misfalah, Makkah 24233'],
      }),
    );
    const byType = Object.fromEntries(channels.map((c) => [c.type, c]));
    expect(byType.phone?.value).toBe('+966 53 351 9689');
    expect(byType.address?.value).toBe('Misfalah, Makkah 24233');
  });
});

describe('deriveOutreachReadiness', () => {
  it('is ready when identity, contact, evidence and a draft all exist', () => {
    const channels = deriveContactChannels(business(), candidate());
    const readiness = deriveOutreachReadiness(business(), channels, 3, [draft()]);
    expect(readiness.status).toBe('ready');
    expect(readiness.blockers).toHaveLength(0);
  });

  it('is blocked when there is no contact channel and no evidence, not falsely marked ready', () => {
    const channels = deriveContactChannels(business(), null);
    const readiness = deriveOutreachReadiness(business(), channels, 0, []);
    expect(readiness.status).toBe('blocked');
    expect(readiness.blockers).toContain('No contact channel discovered (no phone, website, or email).');
    expect(readiness.blockers).toContain('No supporting evidence collected yet.');
  });

  it('is incomplete (not ready) when contact exists but no outreach draft has been prepared', () => {
    const channels = deriveContactChannels(business(), candidate());
    const readiness = deriveOutreachReadiness(business(), channels, 2, []);
    expect(readiness.status).toBe('incomplete');
    expect(readiness.blockers).toContain('No outreach message prepared yet.');
  });

  it('flags an unverified placeholder business name as a blocker', () => {
    const channels = deriveContactChannels(business(), candidate());
    const readiness = deriveOutreachReadiness(business({ name: 'Unverified Operator' }), channels, 2, [draft()]);
    expect(readiness.blockers).toContain('Business identity could not be confirmed — name is a placeholder.');
    expect(readiness.status).not.toBe('ready');
  });

  it('does not treat a discovered-but-unverified social link as a real contact channel', () => {
    const socialOnly = deriveSocialChannels([evidence()]);
    const readiness = deriveOutreachReadiness(business(), socialOnly, 0, []);
    expect(readiness.status).toBe('blocked');
    expect(readiness.blockers).toContain('Only unverified social links found — no confirmed phone, website, or email.');
  });
});

describe('deriveSocialChannels', () => {
  it('turns a social_post evidence record into a low-confidence, unverified channel', () => {
    const channels = deriveSocialChannels([evidence()]);
    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({
      type: 'facebook',
      value: 'https://www.facebook.com/al-haramain-transport',
      confidence: 'low',
      verified: false,
    });
    expect(channels[0]!.source).toMatch(/unverified/i);
  });

  it('recognizes every supported platform by hostname', () => {
    const channels = deriveSocialChannels([
      evidence({ id: 'ev-ig', sourceUrl: 'https://www.instagram.com/al_haramain/' }),
      evidence({ id: 'ev-tw', sourceUrl: 'https://x.com/al_haramain' }),
      evidence({ id: 'ev-li', sourceUrl: 'https://www.linkedin.com/company/al-haramain' }),
    ]);
    expect(channels.map((c) => c.type).sort()).toEqual(['instagram', 'linkedin', 'twitter']);
  });

  it('ignores evidence that is not a social_post', () => {
    expect(deriveSocialChannels([evidence({ type: 'website' })])).toHaveLength(0);
  });

  it('keeps only the first link per platform', () => {
    const channels = deriveSocialChannels([
      evidence({ id: 'ev-1', sourceUrl: 'https://www.facebook.com/business-a' }),
      evidence({ id: 'ev-2', sourceUrl: 'https://www.facebook.com/business-b' }),
    ]);
    expect(channels).toHaveLength(1);
    expect(channels[0]!.value).toBe('https://www.facebook.com/business-a');
  });

  it('skips a malformed source URL instead of throwing', () => {
    expect(() => deriveSocialChannels([evidence({ sourceUrl: 'not-a-url' })])).not.toThrow();
    expect(deriveSocialChannels([evidence({ sourceUrl: 'not-a-url' })])).toHaveLength(0);
  });
});

describe('deriveProspectFit', () => {
  it('picks the best-scoring opportunity for a business with several', () => {
    const fit = deriveProspectFit([
      opportunity({ id: 'opp-a', score: { ...opportunity().score!, overall: 60 } }),
      opportunity({ id: 'opp-b', score: { ...opportunity().score!, overall: 91 } }),
    ]);
    expect(fit.score).toBe(91);
    expect(fit.bestOpportunityId).toBe('opp-b');
    expect(fit.reasons.length).toBeGreaterThan(0);
  });

  it('returns null score with no fabricated reasons when there are no scored opportunities', () => {
    const fit = deriveProspectFit([]);
    expect(fit.score).toBeNull();
    expect(fit.reasons).toHaveLength(0);
  });
});

describe('deriveOpportunityActivity', () => {
  it('translates real run events into a sorted, icon-tagged feed using the real message text', () => {
    const events: OpportunityRunEventRecord[] = [
      { id: 'e1', runId: 'run-1', nicheId: 'niche-1', stage: 'discovery', agentName: 'discovery-agent', level: 'info', message: 'Discovered 18 businesses', occurredAt: '2026-09-01T00:00:00.000Z' },
      { id: 'e2', runId: 'run-1', nicheId: 'niche-1', stage: 'scoring', agentName: 'scoring-agent', level: 'success', message: 'Scored 4 opportunities', occurredAt: '2026-09-01T00:05:00.000Z' },
    ];
    const activity = deriveOpportunityActivity(events);
    expect(activity.map((a) => a.headline)).toEqual(['Scored 4 opportunities', 'Discovered 18 businesses']);
    expect(activity[0]?.icon).toBe('📊');
  });
});

describe('deriveCommercialAttentionCases', () => {
  it('flags a niche with a real contact-gap majority, but ignores tiny runs to avoid noise', () => {
    const summary: CommercialIntelligenceSummary = {
      niches: [
        { nicheId: 'n1', nicheName: 'Saudi Umrah', runId: 'run-1', discovered: 10, contactComplete: 3, contactIncomplete: 7 },
        { nicheId: 'n2', nicheName: 'Tiny Niche', runId: 'run-2', discovered: 2, contactComplete: 0, contactIncomplete: 2 },
      ],
      outreachDraftsAwaitingReview: 0,
      businessesConsidered: 12,
      cap: 200,
    };
    const cases = deriveCommercialAttentionCases(summary);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ category: 'contact_intelligence_incomplete', severity: 'medium' });
    expect(cases[0]?.title).toContain('Saudi Umrah');
  });

  it('adds one global outreach-ready case from a real drafted count, never one per draft', () => {
    const summary: CommercialIntelligenceSummary = {
      niches: [],
      outreachDraftsAwaitingReview: 6,
      businessesConsidered: 0,
      cap: 200,
    };
    const cases = deriveCommercialAttentionCases(summary);
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ category: 'outreach_ready', ceoActionNeeded: true });
    expect(cases[0]?.title).toBe('6 outreach drafts ready for review');
  });

  it('produces no cases when everything is healthy', () => {
    const summary: CommercialIntelligenceSummary = {
      niches: [{ nicheId: 'n1', nicheName: 'Healthy', runId: 'run-1', discovered: 10, contactComplete: 9, contactIncomplete: 1 }],
      outreachDraftsAwaitingReview: 0,
      businessesConsidered: 10,
      cap: 200,
    };
    expect(deriveCommercialAttentionCases(summary)).toHaveLength(0);
  });
});
