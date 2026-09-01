/**
 * @umer/opportunity-intelligence — domain services for global commercial discovery.
 */

export {
  DEFAULT_SCORE_WEIGHTS,
  DEFAULT_RECOMMENDATION_THRESHOLDS,
  scoreOpportunity,
  type ScoreFactors,
  type ScoreWeights,
  type RecommendationThresholds,
} from './scoring.js';

export { InMemoryNicheRegistry, type NicheRegistry } from './niche-registry.js';

export {
  discoverBusinesses,
  type BusinessCandidate,
  type BusinessDiscoveryProvider,
  type DiscoveryQuery,
  type DiscoveryResult,
} from './discovery.js';

export {
  DefaultOpportunityPipeline,
  type BusinessAudit,
  type DiscoveryAdapter,
  type DiscoveryCandidate,
  type EvidenceRecord as PipelineEvidenceRecord,
  type OpportunityBuilder,
  type OpportunityPipeline,
  type PipelineResult,
  type ProblemDetector,
  type ResearchAdapter,
} from './pipeline.js';

export { deduplicateCandidates, type DeduplicationResult } from './dedup.js';

export { buildOpportunityDossier, type OpportunityDossier } from './dossier.js';

export {
  InMemoryBusinessProspectStore,
  InMemoryEvidenceStore,
  InMemoryNicheRunMetricsStore,
  InMemoryNicheStore,
  InMemoryOpportunityStore,
  InMemoryResearchCaseStore,
  type BusinessProspectStore,
  type EvidenceStore,
  type NicheRunMetricsStore,
  type NicheStore,
  type OpportunityStore,
  type ResearchCaseStore,
} from './store.js';
