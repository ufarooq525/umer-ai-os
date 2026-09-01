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
} from './index.js';

async function main() {
  console.log('================================================================');
  console.log('🚀 Opportunity Intelligence E2E Flow — Saudi Umrah Niche');
  console.log('================================================================\n');

  const mysqlClient = createMySqlClient();
  console.log('📦 Step 1: Applying MySQL Migrations...');
  await migrate(mysqlClient);
  console.log('✅ Migrations verified.\n');

  const persistence = createMySqlOpportunityPersistence();

  // Niche definition
  const niche: NicheDefinition = {
    ...SAUDI_UMRAH_NICHE,
    id: 'saudi-umrah-live-e2e',
    name: 'Saudi Umrah Services (Local E2E)',
    minimumOpportunityScore: 60,
    targetBusinessesPerRun: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log(`🎯 Step 2: Loaded Niche Profile: "${niche.name}" (${niche.id})`);
  console.log(`   Geographies: ${niche.geographies.join(', ')}`);
  console.log(`   Min Score Threshold: ${niche.minimumOpportunityScore}\n`);

  // Simulated Discovery Candidates
  const discoveryCandidates: BusinessCandidate[] = [
    {
      externalId: 'makkah-vip-1',
      name: '  Al-Haramain VIP Transport  ',
      website: 'https://www.al-haramain-transport.example/?utm_source=google&fbclid=123',
      geography: 'Makkah',
      industry: 'transportation provider',
      sourceRefs: ['https://directory.example/makkah/1'],
      discoveredAt: new Date().toISOString(),
    },
    {
      externalId: 'makkah-vip-1',
      name: 'al-haramain vip transport',
      website: 'https://al-haramain-transport.example/',
      geography: 'Makkah',
      industry: 'transportation provider',
      sourceRefs: ['https://maps.example/makkah/haramain'],
      discoveredAt: new Date().toISOString(),
    },
    {
      externalId: 'madinah-rawdah-2',
      name: 'خدمات روضة الزوار',
      website: 'https://rawdah-pilgrims.example',
      geography: 'Madinah',
      industry: 'tour operator',
      sourceRefs: ['https://directory.example/madinah/2'],
      discoveredAt: new Date().toISOString(),
    },
    {
      externalId: 'jeddah-mature-3',
      name: 'Jeddah Executive Umrah Fleet',
      website: 'https://jeddah-luxury.example',
      geography: 'Jeddah',
      industry: 'transportation provider',
      sourceRefs: ['https://directory.example/jeddah/3'],
      discoveredAt: new Date().toISOString(),
    },
    {
      externalId: 'low-score-4',
      name: 'Unverified Operator',
      website: 'https://unverified-test.example',
      geography: 'Saudi Arabia',
      industry: 'local operator',
      sourceRefs: ['https://directory.example/sa/4'],
      discoveredAt: new Date().toISOString(),
    },
  ];

  // Evidence
  const evidenceRecords: EvidenceRecord[] = [
    {
      id: 'ev-haramain-1',
      type: 'website',
      title: 'Al-Haramain VIP Transport website inspection',
      sourceUrl: 'https://al-haramain-transport.example',
      observedAt: new Date().toISOString(),
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
      observedAt: new Date().toISOString(),
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
      observedAt: new Date().toISOString(),
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
      observedAt: new Date().toISOString(),
      observation: 'Minimal unverified directory mention with no contact response.',
      strength: 'weak',
      supports: [],
      contradicts: [],
    },
  ];

  console.log(`🔍 Step 3: Configuring Discovery and Research Providers...`);
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
  });

  console.log('⚡ Step 4: Executing Opportunity Intelligence Pipeline...\n');
  const runId = '11111111-1111-4111-8111-111111111111';
  const result = await service.execute(niche, runId);

  console.log('================================================================');
  console.log('📊 Pipeline Execution Metrics');
  console.log('================================================================');
  console.log(`• Run ID:                   ${result.runId}`);
  console.log(`• Discovered Businesses:    ${result.metrics.businessesDiscovered}`);
  console.log(`• Researched Businesses:    ${result.metrics.businessesResearched}`);
  console.log(`• Qualified Businesses:     ${result.metrics.qualifiedBusinesses}`);
  console.log(`• Opportunities Generated:  ${result.metrics.opportunitiesFound}`);
  console.log(`• High-Value Opportunities: ${result.metrics.highValueOpportunities}`);
  console.log(`• Est. Pipeline Value:      $${result.metrics.estimatedPipeline.toLocaleString()} USD`);
  console.log(`• Errors:                   ${result.metrics.errors}`);
  console.log('================================================================\n');

  console.log('📋 Generated Opportunities:');
  for (const opp of result.opportunities) {
    console.log(`  [Score: ${opp.score.overall.toFixed(1)} / ${opp.score.recommendation}] ${opp.title} ($${opp.estimatedValueMin}-$${opp.estimatedValueMax})`);
  }

  console.log('\n🗄️ Step 5: Verifying MySQL Persistence Tables...');
  const [dbNiches] = await mysqlClient.execute<any[]>('SELECT count(*) as count FROM opportunity_niches WHERE id = ?', [niche.id]);
  const [dbBusinesses] = await mysqlClient.execute<any[]>('SELECT count(*) as count FROM opportunity_businesses WHERE niche_id = ?', [niche.id]);
  const [dbOpportunities] = await mysqlClient.execute<any[]>('SELECT count(*) as count FROM opportunity_opportunities WHERE niche_id = ?', [niche.id]);
  const [dbRuns] = await mysqlClient.execute<any[]>('SELECT count(*) as count FROM opportunity_niche_runs WHERE run_id = ?', [runId]);

  console.log(`• opportunity_niches:        ${dbNiches[0].count} record(s)`);
  console.log(`• opportunity_businesses:    ${dbBusinesses[0].count} record(s)`);
  console.log(`• opportunity_opportunities: ${dbOpportunities[0].count} record(s)`);
  console.log(`• opportunity_niche_runs:    ${dbRuns[0].count} record(s)`);
  console.log('\n✅ Opportunity Intelligence Flow completed successfully!');

  await closeMySql();
}

main().catch(async (err) => {
  console.error('❌ Pipeline failed:', err);
  await closeMySql();
  process.exit(1);
});
