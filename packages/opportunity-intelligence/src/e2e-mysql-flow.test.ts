import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeMySql, createMySqlClient, migrate } from '@umer/db';
import type { EvidenceRecord, NicheDefinition } from '@umer/contracts';
import type { BusinessCandidate } from './discovery.js';
import {
  CompositeDiscoveryAdapter,
  createMySqlOpportunityPersistence,
  DefaultOpportunityBuilder,
  EvidenceBasedProblemDetector,
  EvidenceResearchAdapter,
  OpportunityRunService,
  SAUDI_UMRAH_NICHE,
  SourceDiscoveryProvider,
  StaticDiscoverySource,
  StaticEvidenceSource,
  type OpportunityPersistence,
} from './index.js';

describe('Opportunity Intelligence E2E Flow (MySQL)', () => {
  let persistence: OpportunityPersistence;
  const mysqlClient = createMySqlClient();

  beforeAll(async () => {
    // Ensure migrations are in place
    await migrate(mysqlClient);
    await mysqlClient.execute('DELETE FROM opportunity_opportunities WHERE niche_id = ?', ['saudi-umrah-e2e']);
    await mysqlClient.execute('DELETE FROM opportunity_research_cases WHERE niche_id = ?', ['saudi-umrah-e2e']);
    await mysqlClient.execute('DELETE FROM opportunity_businesses WHERE niche_id = ?', ['saudi-umrah-e2e']);
    await mysqlClient.execute('DELETE FROM opportunity_niche_runs WHERE niche_id = ?', ['saudi-umrah-e2e']);
    await mysqlClient.execute('DELETE FROM opportunity_niches WHERE id = ?', ['saudi-umrah-e2e']);
    persistence = createMySqlOpportunityPersistence();
  });

  afterAll(async () => {
    await closeMySql();
  });

  it('runs complete Opportunity Intelligence flow from discovery to MySQL persistence and verifies idempotency', async () => {
    // 1. Niche Profile setup
    const niche: NicheDefinition = {
      ...SAUDI_UMRAH_NICHE,
      id: 'saudi-umrah-e2e',
      name: 'Saudi Umrah Services (E2E)',
      minimumOpportunityScore: 60,
      targetBusinessesPerRun: 10,
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    };

    // 2. Mock Discovery Candidates representing real-world scenarios:
    // - Candidate 1: Makkah transport with missing digital booking & payment (High-value opportunity)
    // - Candidate 2: Duplicate of Candidate 1 with differing URL tracking params & whitespace
    // - Candidate 3: Madinah pilgrim agency with Arabic name & no automation (High-value opportunity)
    // - Candidate 4: Jeddah mature agency with full booking & payments (Filtered out / No problem)
    // - Candidate 5: Weak candidate with unverified signals resulting in score < 60 (Rejected / Filtered out)
    const discoveryCandidates: BusinessCandidate[] = [
      {
        externalId: 'makkah-vip-1',
        name: '  Al-Haramain VIP Transport  ',
        website: 'https://www.al-haramain-transport.example/?utm_source=google&fbclid=123',
        geography: 'Makkah',
        industry: 'transportation provider',
        sourceRefs: ['https://directory.example/makkah/1'],
        discoveredAt: '2026-09-02T00:00:00.000Z',
      },
      {
        externalId: 'makkah-vip-1',
        name: 'al-haramain vip transport',
        website: 'https://al-haramain-transport.example/',
        geography: 'Makkah',
        industry: 'transportation provider',
        sourceRefs: ['https://maps.example/makkah/haramain'],
        discoveredAt: '2026-09-02T00:00:00.000Z',
      },
      {
        externalId: 'madinah-rawdah-2',
        name: 'خدمات روضة الزوار',
        website: 'https://rawdah-pilgrims.example',
        geography: 'Madinah',
        industry: 'tour operator',
        sourceRefs: ['https://directory.example/madinah/2'],
        discoveredAt: '2026-09-02T00:00:00.000Z',
      },
      {
        externalId: 'jeddah-mature-3',
        name: 'Jeddah Executive Umrah Fleet',
        website: 'https://jeddah-luxury.example',
        geography: 'Jeddah',
        industry: 'transportation provider',
        sourceRefs: ['https://directory.example/jeddah/3'],
        discoveredAt: '2026-09-02T00:00:00.000Z',
      },
      {
        externalId: 'low-score-4',
        name: 'Unverified Operator',
        website: 'https://unverified-test.example',
        geography: 'Saudi Arabia',
        industry: 'local operator',
        sourceRefs: ['https://directory.example/sa/4'],
        discoveredAt: '2026-09-02T00:00:00.000Z',
      },
    ];

    // 3. Evidence Records
    const evidenceRecords: EvidenceRecord[] = [
      {
        id: 'ev-haramain-1',
        type: 'website',
        title: 'Al-Haramain VIP Transport website inspection',
        sourceUrl: 'https://al-haramain-transport.example',
        observedAt: '2026-09-02T00:00:00.000Z',
        observation: 'Website displays static phone and address only without online booking or digital payment.',
        strength: 'verified',
        supports: ['digital presence'],
        contradicts: [],
      },
      {
        id: 'ev-rawdah-2',
        type: 'website',
        title: 'خدمات روضة الزوار website review',
        sourceUrl: 'https://rawdah-pilgrims.example',
        observedAt: '2026-09-02T00:00:00.000Z',
        observation: 'Landing page lists Arabic tour packages with WhatsApp inquiry only. No automated booking or CRM.',
        strength: 'verified',
        supports: ['digital presence'],
        contradicts: [],
      },
      {
        id: 'ev-jeddah-3',
        type: 'website',
        title: 'Jeddah Executive Umrah Fleet inspection',
        sourceUrl: 'https://jeddah-luxury.example',
        observedAt: '2026-09-02T00:00:00.000Z',
        observation: 'Website features instant booking, reservation engine, contact form, WhatsApp chat, call to action buttons, online payment checkout with Visa and Mastercard, automated CRM follow-up, and reviews.',
        strength: 'verified',
        supports: ['booking', 'payments', 'automation', 'trust'],
        contradicts: [],
      },
      {
        id: 'ev-unverified-4',
        type: 'directory',
        title: 'Unverified Operator directory listing',
        sourceUrl: 'https://unverified-test.example',
        observedAt: '2026-09-02T00:00:00.000Z',
        observation: 'Minimal unverified directory mention with no contact response.',
        strength: 'weak',
        supports: [],
        contradicts: [],
      },
    ];

    // 4. Wire Pipeline with MySQL persistence
    const discoverySource = new StaticDiscoverySource(discoveryCandidates);
    const discoveryProvider = new SourceDiscoveryProvider([discoverySource]);
    const discoveryAdapter = new CompositeDiscoveryAdapter(discoveryProvider);
    const evidenceSource = new StaticEvidenceSource(evidenceRecords);
    const researchAdapter = new EvidenceResearchAdapter([evidenceSource], niche);

    const problemDetector = new EvidenceBasedProblemDetector();
    const opportunityBuilder = new DefaultOpportunityBuilder();

    const service = new OpportunityRunService({
      discovery: discoveryAdapter,
      research: researchAdapter,
      problemDetector,
      opportunityBuilder,
      persistence,
      clock: { nowIso: () => '2026-09-02T12:00:00.000Z' },
    });

    // 5. Execute 1st Pipeline Run
    const runId1 = '11111111-1111-4111-8111-111111111111';
    const result1 = await service.execute(niche, runId1);

    // Assertions on 1st Execution
    expect(result1.errors).toEqual([]);
    expect(result1.metrics.businessesDiscovered).toBe(discoveryCandidates.length);
    // 5 candidates with 1 duplicate -> 4 unique businesses
    expect(result1.metrics.businessesResearched).toBe(4);
    // 3 businesses have problems detected (Al-Haramain, Rawdah, and Unverified Operator)
    expect(result1.metrics.qualifiedBusinesses).toBe(3);
    expect(result1.metrics.opportunitiesFound).toBeGreaterThan(0);
    expect(result1.metrics.highValueOpportunities).toBeGreaterThan(0);
    expect(result1.metrics.estimatedPipeline).toBeGreaterThan(0);

    // 6. Verify Direct MySQL Database Records
    const savedNiche = await persistence.listOpportunities(niche.id);
    expect(savedNiche.length).toBe(result1.opportunities.length);

    // Query MySQL tables directly to verify schema mapping
    const [dbNiches] = await mysqlClient.execute<any[]>(
      'SELECT * FROM opportunity_niches WHERE id = ?',
      [niche.id],
    );
    expect(dbNiches.length).toBe(1);
    expect(dbNiches[0].name).toBe(niche.name);

    const [dbBusinesses] = await mysqlClient.execute<any[]>(
      'SELECT * FROM opportunity_businesses WHERE niche_id = ?',
      [niche.id],
    );
    expect(dbBusinesses.length).toBe(4);

    const [dbEvidence] = await mysqlClient.execute<any[]>(
      'SELECT * FROM opportunity_evidence WHERE id IN (?, ?, ?, ?)',
      ['ev-haramain-1', 'ev-rawdah-2', 'ev-jeddah-3', 'ev-unverified-4'],
    );
    expect(dbEvidence.length).toBe(4);

    const [dbCases] = await mysqlClient.execute<any[]>(
      'SELECT * FROM opportunity_research_cases WHERE niche_id = ?',
      [niche.id],
    );
    expect(dbCases.length).toBe(4);

    const [dbOpportunities] = await mysqlClient.execute<any[]>(
      'SELECT * FROM opportunity_opportunities WHERE niche_id = ?',
      [niche.id],
    );
    expect(dbOpportunities.length).toBe(result1.opportunities.length);

    const [dbRuns] = await mysqlClient.execute<any[]>(
      'SELECT * FROM opportunity_niche_runs WHERE run_id = ?',
      [runId1],
    );
    expect(dbRuns.length).toBe(1);
    expect(dbRuns[0].opportunities_found).toBe(result1.metrics.opportunitiesFound);

    // 7. Execute 2nd Pipeline Run (Idempotency verification)
    const runId2 = '22222222-2222-4222-8222-222222222222';
    const result2 = await service.execute(niche, runId2);

    expect(result2.errors).toEqual([]);
    expect(result2.metrics.businessesDiscovered).toBe(discoveryCandidates.length);
    expect(result2.metrics.opportunitiesFound).toBe(result1.metrics.opportunitiesFound);

    // Ensure business and opportunity table counts did not duplicate in MySQL
    const [dbBusinessesAfter] = await mysqlClient.execute<any[]>(
      'SELECT * FROM opportunity_businesses WHERE niche_id = ?',
      [niche.id],
    );
    expect(dbBusinessesAfter.length).toBe(4);

    const [dbOpportunitiesAfter] = await mysqlClient.execute<any[]>(
      'SELECT * FROM opportunity_opportunities WHERE niche_id = ?',
      [niche.id],
    );
    expect(dbOpportunitiesAfter.length).toBe(result1.opportunities.length);
  });
});
