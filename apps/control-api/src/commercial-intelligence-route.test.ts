import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import {
  buildBusinessIdentity,
  InMemoryOpportunityPersistence,
} from '@umer/opportunity-intelligence';
import type {
  BusinessProspect,
  DiscoveryCandidateRecord,
  EvidenceRecord,
  NicheDefinition,
  NicheRunMetrics,
  Opportunity,
  OutreachDraft,
} from '@umer/contracts';
import { createControlApiServer, createControlApiState } from './server.js';

async function request(server: Server, path: string): Promise<{ status: number; json: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server not listening');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  return { status: response.status, json: await response.json() };
}

const NICHE_ID = 'saudi-umrah-route-test';
const RUN_ID = 'run-ci-1';
const CANDIDATE: DiscoveryCandidateRecord = {
  id: 'cand-1',
  runId: RUN_ID,
  nicheId: NICHE_ID,
  externalId: 'makkah-transport-1',
  name: 'Al-Haramain VIP Transport',
  websiteUrl: 'https://al-haramain-transport.example',
  phone: '+966501234567',
  address: 'Makkah, Saudi Arabia',
  geography: 'Makkah',
  industry: 'transportation provider',
  sourceRefs: ['https://directory.example/makkah/1'],
  discoveredAt: '2026-09-01T00:00:00.000Z',
};
const BUSINESS_ID = buildBusinessIdentity({
  externalId: CANDIDATE.externalId,
  name: CANDIDATE.name,
  websiteUrl: CANDIDATE.websiteUrl,
  geography: CANDIDATE.geography,
}).id;

const BUSINESS: BusinessProspect = {
  id: BUSINESS_ID,
  name: 'Al-Haramain VIP Transport',
  website: CANDIDATE.websiteUrl,
  geography: 'Makkah',
  industry: 'transportation provider',
  nicheId: NICHE_ID,
  sourceRefs: CANDIDATE.sourceRefs,
  discoveredAt: '2026-09-01T00:00:00.000Z',
  lastResearchedAt: '2026-09-01T00:05:00.000Z',
};

const EVIDENCE: EvidenceRecord = {
  id: 'ev-1',
  type: 'website',
  title: 'No online booking mechanism detected',
  sourceUrl: 'https://al-haramain-transport.example',
  observedAt: '2026-09-01T00:04:00.000Z',
  observation: 'No booking widget or reservation form found on the homepage or navigation.',
  strength: 'verified',
  supports: [],
  contradicts: [],
};

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: `opp-${overrides.problemIds?.[0] ?? 'a'}`,
    type: 'repeatable_service',
    title: 'Al-Haramain VIP Transport: Automated Self-Service Booking & Reservation System',
    geography: 'Makkah',
    market: 'Saudi Umrah Services',
    nicheId: NICHE_ID,
    businessId: BUSINESS_ID,
    problemIds: ['problem-booking'],
    score: {
      problemSeverity: 70,
      demandEvidence: 80,
      abilityToPay: 75,
      reachability: 60,
      solutionFit: 80,
      competitiveGap: 60,
      deliveryFeasibility: 75,
      evidenceConfidence: 90,
      overall: 78,
      recommendation: 'outreach_ready',
    },
    evidenceRefs: ['ev-1'],
    status: 'outreach_ready',
    createdAt: '2026-09-01T00:06:00.000Z',
    updatedAt: '2026-09-01T00:06:00.000Z',
    ...overrides,
  };
}

const OPPORTUNITY_A = opportunity({ id: 'opp-booking', problemIds: ['problem-booking'] });
const OPPORTUNITY_B = opportunity({
  id: 'opp-payment',
  problemIds: ['problem-payment'],
  title: 'Al-Haramain VIP Transport: Direct Digital Checkout & Payment Gateway Integration',
});

const OUTREACH: OutreachDraft = {
  id: 'draft-1',
  opportunityId: OPPORTUNITY_A.id,
  businessId: BUSINESS_ID,
  nicheId: NICHE_ID,
  channel: 'whatsapp',
  recipient: '+966501234567',
  body: 'Draft WhatsApp message body.',
  language: 'ar',
  valueProposition: 'Automate booking to capture missed leads.',
  evidenceRefs: ['ev-1'],
  status: 'drafted',
  createdAt: '2026-09-01T00:07:00.000Z',
  updatedAt: '2026-09-01T00:07:00.000Z',
};

const NICHE: NicheDefinition = {
  id: NICHE_ID,
  name: 'Saudi Umrah Services (route test)',
  description: 'Route test niche',
  geographies: ['Makkah'],
  status: 'active',
  priority: 'high',
  targetBusinessesPerRun: 10,
  minimumOpportunityScore: 60,
  researchDepth: 'standard',
  problemHypotheses: [],
  discoverySignals: [],
  allowedSolutionTypes: [],
  outreachMode: 'draft',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const RUN_METRICS: NicheRunMetrics = {
  nicheId: NICHE_ID,
  runId: RUN_ID,
  businessesDiscovered: 1,
  businessesResearched: 1,
  qualifiedBusinesses: 1,
  opportunitiesFound: 2,
  highValueOpportunities: 2,
  estimatedPipeline: 10000,
  errors: 0,
  startedAt: '2026-09-01T00:00:00.000Z',
  completedAt: '2026-09-01T00:08:00.000Z',
};

describe('control-api commercial intelligence routes', () => {
  let server: Server;

  beforeAll(async () => {
    const state = await createControlApiState();
    const persistence = new InMemoryOpportunityPersistence();
    await persistence.saveNiche(NICHE);
    await persistence.saveDiscoveryCandidate(CANDIDATE);
    await persistence.saveBusiness(BUSINESS);
    await persistence.saveEvidence(EVIDENCE);
    await persistence.saveProblem(
      {
        id: 'problem-booking',
        statement: 'No online booking mechanism.',
        severity: 70,
        frequency: 60,
        financialImpact: 70,
        evidenceConfidence: 90,
        evidenceRefs: ['ev-1'],
      },
      { businessId: BUSINESS_ID, nicheId: NICHE_ID, runId: RUN_ID },
    );
    await persistence.saveOpportunity(OPPORTUNITY_A);
    await persistence.saveOpportunity(OPPORTUNITY_B);
    await persistence.saveOutreachDraft(OUTREACH);
    await persistence.saveRunMetrics(RUN_METRICS);
    state.opportunityReader = persistence;
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('lists niches', async () => {
    const { status, json } = await request(server, '/v1/niches');
    expect(status).toBe(200);
    const body = json as { niches: NicheDefinition[] };
    expect(body.niches.map((n) => n.id)).toContain(NICHE_ID);
  });

  it('returns a business with its discovery candidate, problems, opportunities, outreach and evidence', async () => {
    const { status, json } = await request(server, `/v1/businesses/${BUSINESS_ID}`);
    expect(status).toBe(200);
    const body = json as {
      business: BusinessProspect;
      discoveryCandidate: DiscoveryCandidateRecord | null;
      opportunities: Opportunity[];
      outreach: OutreachDraft[];
      evidence: EvidenceRecord[];
    };
    expect(body.business.name).toBe('Al-Haramain VIP Transport');
    expect(body.discoveryCandidate?.phone).toBe('+966501234567');
    expect(body.opportunities.map((o) => o.id).sort()).toEqual(['opp-booking', 'opp-payment']);
    expect(body.outreach).toHaveLength(1);
    expect(body.evidence.map((e) => e.id)).toEqual(['ev-1']);
  });

  it('404s for an unknown business', async () => {
    const { status } = await request(server, '/v1/businesses/does-not-exist');
    expect(status).toBe(404);
  });

  it('lists deduplicated prospects for a niche run', async () => {
    const { status, json } = await request(server, `/v1/niches/${NICHE_ID}/prospects`);
    expect(status).toBe(200);
    const body = json as { runId: string; prospects: Array<{ businessId: string; opportunityCount: number; bestScore: number; hasContactChannel: boolean }> };
    expect(body.runId).toBe(RUN_ID);
    expect(body.prospects).toHaveLength(1);
    expect(body.prospects[0]).toMatchObject({ businessId: BUSINESS_ID, opportunityCount: 2, bestScore: 78, hasContactChannel: true });
  });

  it('lists run events for a niche', async () => {
    const { status, json } = await request(server, `/v1/niches/${NICHE_ID}/events`);
    expect(status).toBe(200);
    expect((json as { runId: string }).runId).toBe(RUN_ID);
  });

  it('summarizes commercial intelligence across niches, bounded and cheap', async () => {
    const { status, json } = await request(server, '/v1/commercial-intelligence/summary');
    expect(status).toBe(200);
    const body = json as {
      niches: Array<{ nicheId: string; discovered: number; contactComplete: number; contactIncomplete: number }>;
      outreachDraftsAwaitingReview: number;
      businessesConsidered: number;
    };
    const niche = body.niches.find((n) => n.nicheId === NICHE_ID);
    expect(niche).toMatchObject({ discovered: 1, contactComplete: 1, contactIncomplete: 0 });
    expect(body.outreachDraftsAwaitingReview).toBeGreaterThanOrEqual(1);
    expect(body.businessesConsidered).toBeGreaterThanOrEqual(1);
  });
});
