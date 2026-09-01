import { z } from 'zod';

/**
 * Global Opportunity Intelligence contracts.
 *
 * These models deliberately separate markets, problems, businesses and
 * opportunities so discovery is not hard-coded around lead generation.
 */
export const OpportunityStatusSchema = z.enum([
  'discovered',
  'researching',
  'validated',
  'outreach_ready',
  'in_sales',
  'won',
  'lost',
  'rejected',
  'converted_to_product',
]);

export const NicheStatusSchema = z.enum([
  'idea',
  'hypothesis',
  'testing',
  'validated',
  'active',
  'winning',
  'declining',
  'paused',
  'rejected',
  'retired',
]);

export const OpportunityTypeSchema = z.enum([
  'service',
  'repeatable_service',
  'product',
  'partnership',
  'acquisition',
  'other',
]);

export const ResearchDepthSchema = z.enum(['quick', 'standard', 'deep']);

export const NicheDefinitionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    geographies: z.array(z.string().min(1)).min(1),
    status: NicheStatusSchema,
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    targetBusinessesPerRun: z.number().int().positive(),
    minimumOpportunityScore: z.number().min(0).max(100),
    researchDepth: ResearchDepthSchema,
    problemHypotheses: z.array(z.string().min(1)).default([]),
    discoverySignals: z.array(z.string().min(1)).default([]),
    allowedSolutionTypes: z.array(z.string().min(1)).default([]),
    outreachMode: z.enum(['disabled', 'draft', 'approval_required', 'bounded_autonomous']),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const ProblemSchema = z
  .object({
    id: z.string().min(1),
    statement: z.string().min(1),
    severity: z.number().min(0).max(100),
    frequency: z.number().min(0).max(100),
    financialImpact: z.number().min(0).max(100),
    evidenceConfidence: z.number().min(0).max(100),
    evidenceRefs: z.array(z.string()).min(1),
  })
  .strict();

export const OpportunityScoreSchema = z
  .object({
    problemSeverity: z.number().min(0).max(100),
    demandEvidence: z.number().min(0).max(100),
    abilityToPay: z.number().min(0).max(100),
    reachability: z.number().min(0).max(100),
    solutionFit: z.number().min(0).max(100),
    competitiveGap: z.number().min(0).max(100),
    deliveryFeasibility: z.number().min(0).max(100),
    evidenceConfidence: z.number().min(0).max(100),
    overall: z.number().min(0).max(100),
    recommendation: z.enum(['reject', 'watch', 'research_more', 'outreach_ready', 'product_candidate']),
  })
  .strict();

export const OpportunitySchema = z
  .object({
    id: z.string().min(1),
    type: OpportunityTypeSchema,
    title: z.string().min(1),
    geography: z.string().min(1),
    market: z.string().min(1),
    nicheId: z.string().optional(),
    businessId: z.string().optional(),
    problemIds: z.array(z.string()).min(1),
    score: OpportunityScoreSchema,
    estimatedValueMin: z.number().nonnegative().optional(),
    estimatedValueMax: z.number().nonnegative().optional(),
    currency: z.string().min(3).max(3).optional(),
    timeToRevenueDays: z.number().int().nonnegative().optional(),
    evidenceRefs: z.array(z.string()).min(1),
    status: OpportunityStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const NicheRunMetricsSchema = z
  .object({
    nicheId: z.string().min(1),
    runId: z.string().min(1),
    businessesDiscovered: z.number().int().nonnegative(),
    businessesResearched: z.number().int().nonnegative(),
    qualifiedBusinesses: z.number().int().nonnegative(),
    opportunitiesFound: z.number().int().nonnegative(),
    highValueOpportunities: z.number().int().nonnegative(),
    estimatedPipeline: z.number().nonnegative(),
    errors: z.number().int().nonnegative(),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    nextRunAt: z.string().datetime().optional(),
  })
  .strict();

export const ExperimentSchema = z
  .object({
    id: z.string().min(1),
    hypothesis: z.string().min(1),
    scope: z.string().min(1),
    sampleSize: z.number().int().positive(),
    successCriteria: z.array(z.string().min(1)).min(1),
    status: z.enum(['planned', 'running', 'completed', 'failed', 'cancelled']),
    result: z.string().optional(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
  })
  .strict();

export type OpportunityStatus = z.infer<typeof OpportunityStatusSchema>;
export type NicheStatus = z.infer<typeof NicheStatusSchema>;
export type OpportunityType = z.infer<typeof OpportunityTypeSchema>;
export type NicheDefinition = z.infer<typeof NicheDefinitionSchema>;
export type Problem = z.infer<typeof ProblemSchema>;
export type OpportunityScore = z.infer<typeof OpportunityScoreSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type NicheRunMetrics = z.infer<typeof NicheRunMetricsSchema>;
export type Experiment = z.infer<typeof ExperimentSchema>;
