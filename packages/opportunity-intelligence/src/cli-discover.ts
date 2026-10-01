#!/usr/bin/env node
/**
 * CLI tool to run an opportunity discovery batch for a chosen niche and city.
 * Usage: pnpm cli:discover --niche=clinics-hospitals --city="Karachi" --limit=20
 */
import { BUILTIN_NICHE_PROFILES } from './niche-profiles.js';
import {
  GooglePlacesDiscoverySource,
  SourceDiscoveryProvider,
  CompositeDiscoveryAdapter,
  EvidenceResearchAdapter,
  WebsiteEvidenceSource,
  EvidenceBasedProblemDetector,
  DefaultOpportunityBuilder,
  OpportunityRunService,
  createMySqlOpportunityPersistence,
} from './index.js';
import type { NicheDefinition } from '@umer/contracts';

async function main() {
  const args = process.argv.slice(2);
  const nicheArg = args.find((a) => a.startsWith('--niche='))?.split('=')[1];
  const cityArg = args.find((a) => a.startsWith('--city='))?.split('=')[1];
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];

  if (!nicheArg) {
    console.error('Error: --niche is required');
    console.error('Available niches:');
    for (const profile of BUILTIN_NICHE_PROFILES) {
      console.error(`  - ${profile.id}: ${profile.name}`);
    }
    process.exit(1);
  }

  if (!cityArg) {
    console.error('Error: --city is required');
    console.error('Example: --city="Karachi"');
    process.exit(1);
  }

  const profile = BUILTIN_NICHE_PROFILES.find((p) => p.id === nicheArg);
  if (!profile) {
    console.error(`Error: Niche "${nicheArg}" not found`);
    console.error('Available niches:');
    for (const p of BUILTIN_NICHE_PROFILES) {
      console.error(`  - ${p.id}: ${p.name}`);
    }
    process.exit(1);
  }

  const limit = limitArg ? Number.parseInt(limitArg, 10) : 20;
  if (Number.isNaN(limit) || limit < 1 || limit > 20) {
    console.error('Error: --limit must be between 1 and 20');
    process.exit(1);
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('');
    console.error('⚠️  WARNING: GOOGLE_MAPS_API_KEY is not configured.');
    console.error('   Live discovery cannot start without a valid Google Maps API key.');
    console.error('   Please set GOOGLE_MAPS_API_KEY in your .env file or environment.');
    console.error('');
    process.exit(1);
  }

  console.log('');
  console.log(`🔍 Discovery Configuration`);
  console.log(`   Niche: ${profile.name} (${profile.id})`);
  console.log(`   City: ${cityArg}`);
  console.log(`   Limit: ${limit} businesses`);
  console.log(`   Mode: LIVE (Google Places API)`);
  console.log('');

  const now = new Date().toISOString();
  const runId = `cli-${Date.now()}`;
  
  const niche: NicheDefinition = {
    ...profile,
    geographies: [cityArg],
    targetBusinessesPerRun: limit,
    updatedAt: now,
  };

  const discoverySource = new GooglePlacesDiscoverySource();
  const discovery = new CompositeDiscoveryAdapter(new SourceDiscoveryProvider([discoverySource]));
  const research = new EvidenceResearchAdapter([new WebsiteEvidenceSource()], niche);

  const service = new OpportunityRunService({
    discovery,
    research,
    problemDetector: new EvidenceBasedProblemDetector(),
    opportunityBuilder: new DefaultOpportunityBuilder(),
    persistence: createMySqlOpportunityPersistence(),
    onEvent: (ev) => {
      const prefix = ev.stage ? `[${ev.stage}]` : '';
      console.log(`${prefix} ${ev.message}`);
    },
  });

  console.log('🚀 Starting discovery run...');
  console.log('');

  try {
    const result = await service.execute(niche, runId);
    
    console.log('');
    console.log('✅ Discovery completed successfully!');
    console.log('');
    console.log('📊 Results:');
    console.log(`   Businesses discovered: ${result.metrics.businessesDiscovered}`);
    console.log(`   Businesses researched: ${result.metrics.businessesResearched}`);
    console.log(`   Qualified businesses: ${result.metrics.qualifiedBusinesses}`);
    console.log(`   Opportunities found: ${result.metrics.opportunitiesFound}`);
    console.log(`   High-value opportunities: ${result.metrics.highValueOpportunities}`);
    console.log(`   Estimated pipeline: $${result.metrics.estimatedPipeline.toLocaleString()}`);
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. View opportunities in the web UI at /opportunities');
    console.log('   2. Review outreach drafts (draft-only, not sent automatically)');
    console.log('   3. Copy/mailto links available for each qualified lead');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ Discovery failed:');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
