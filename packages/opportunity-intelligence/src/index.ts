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
