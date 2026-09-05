/**
 * @umer/opportunity-intelligence — domain services for global commercial discovery.
 */
export { DEFAULT_SCORE_WEIGHTS, DEFAULT_RECOMMENDATION_THRESHOLDS, scoreOpportunity, type ScoreFactors, type ScoreWeights, type RecommendationThresholds } from './scoring.js';
export { InMemoryNicheRegistry, type NicheRegistry } from './niche-registry.js';
export { InMemoryNicheProfileRegistry, BUILTIN_NICHE_PROFILES, SAUDI_UMRAH_NICHE, validateNicheProfile, type NicheProfile } from './niche-profiles.js';
export { discoverBusinesses, type BusinessCandidate, type BusinessDiscoveryProvider, type DiscoveryQuery, type DiscoveryResult } from './discovery.js';
export { DiscoveryOrchestrator, type DiscoveryOrchestratorOptions, type DiscoveryRunResult } from './discovery-orchestrator.js';
export { ResearchOrchestrator, type ResearchOrchestratorOptions, type ResearchResult } from './research-orchestrator.js';
export { DefaultOpportunityPipeline, type BusinessAudit, type DiscoveryAdapter, type DiscoveryCandidate, type EvidenceRecord as PipelineEvidenceRecord, type OpportunityBuilder, type OpportunityPipeline, type PipelineResult, type ProblemDetector, type ResearchAdapter } from './pipeline.js';
export { EvidenceBasedProblemDetector, auditBusiness } from './business-audit.js';
export { DefaultOpportunityBuilder } from './opportunity-builder.js';
export { deduplicateCandidates, candidateIdentityKey, type DeduplicationResult } from './dedup.js';
export { buildOpportunityDossier, type OpportunityDossier } from './dossier.js';
export { InMemoryBusinessProspectStore, InMemoryEvidenceStore, InMemoryNicheRunMetricsStore, InMemoryNicheStore, InMemoryOpportunityStore, InMemoryResearchCaseStore, type BusinessProspectStore, type EvidenceStore, type NicheRunMetricsStore, type NicheStore, type OpportunityStore, type ResearchCaseStore } from './store.js';
export { InMemoryOpportunityPersistence, MySqlOpportunityPersistence, type MySqlExecutor, type MySqlOpportunityPersistenceOptions, type OpportunityPersistence } from './persistence.js';
export { createMySqlOpportunityPersistence } from './mysql.js';
export { OpportunityRunService, defaultOpportunityRunClock, type OpportunityRunClock, type OpportunityRunResult, type OpportunityRunServiceOptions } from './run-service.js';
export { buildBusinessIdentity, createBusinessId, normalizeEmail, normalizeGeography, normalizePhone, resolveIdentity, type BusinessIdentity, type IdentityCandidate, type IdentityMatch } from './identity.js';
export { normalizeBusinessName, normalizeCandidate, normalizeWebsite, type NormalizedBusinessCandidate } from './normalization.js';
export { CompositeDiscoveryAdapter, EvidenceResearchAdapter, GooglePlacesDiscoverySource, SourceDiscoveryProvider, StaticDiscoverySource, StaticEvidenceSource, WebsiteEvidenceSource, inferPlacesRegion, type DiscoverySource, type EvidenceSource } from './adapters.js';
export { OpportunityAutonomousScheduler, type AutonomousSchedulerState, type SchedulerConfig } from './autonomous-scheduler.js';
export { DefaultOutreachGenerator, type OutreachGenerator, type OutreachGeneratorInput } from './outreach-generator.js';
