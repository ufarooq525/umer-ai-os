import { z } from 'zod';

/**
 * Global Opportunity Intelligence contracts.
 *
 * These models deliberately separate markets, problems, businesses and
 * opportunities so discovery is not hard-coded around lead generation.
 */
/**
 * Sales/discovery lifecycle (existing) plus two additive bridge statuses that
 * connect this Opportunity to Work Management execution: `selected_for_execution`
 * (committed to build; not a sales-funnel state) and `project_created` (a
 * ProjectContract now exists for it). Both are plain enum values stored in
 * the existing `status` column — no migration needed, so they round-trip
 * through the MySQL adapter exactly like every other status value.
 *
 * There is deliberately no "executing"/"failed" status here: once a Project
 * exists, that Project's own status is the source of truth for execution
 * progress, never duplicated on the Opportunity.
 *
 * IMPORTANT — this contract intentionally has NO `projectId` field. The
 * MySQL-persisted `opportunity_opportunities` table has no column for it and
 * this milestone adds no migration, so a `projectId` field here would only
 * round-trip through the in-memory store and silently vanish through MySQL —
 * a persistence lie. The forward reference is recorded the other way instead:
 * `ProjectContract.sourceOpportunityId` (control-api's own in-memory store,
 * honestly documented as in-memory-only, no false persistence claim). Finding
 * "which Project did opportunity X become" today means querying the Project
 * store for `sourceOpportunityId === X`, not reading a field off the
 * Opportunity. See implementation/COMPANY_OPERATING_MODEL.md §Boundary.
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
  'selected_for_execution',
  'project_created',
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

export const EvidenceTypeSchema = z.enum([
  'website',
  'directory',
  'review',
  'job_posting',
  'social_post',
  'forum_post',
  'pricing_page',
  'product_page',
  'announcement',
  'public_document',
  'search_result',
  'other',
]);

export const EvidenceStrengthSchema = z.enum(['weak', 'moderate', 'strong', 'verified']);

export const BusinessProspectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    website: z.string().url().optional(),
    geography: z.string().min(1),
    industry: z.string().optional(),
    nicheId: z.string().optional(),
    sourceRefs: z.array(z.string()).min(1),
    discoveredAt: z.string().datetime(),
    lastResearchedAt: z.string().datetime().optional(),
  })
  .strict();

export const EvidenceRecordSchema = z
  .object({
    id: z.string().min(1),
    type: EvidenceTypeSchema,
    title: z.string().min(1),
    sourceUrl: z.string().url(),
    observedAt: z.string().datetime(),
    excerpt: z.string().min(1).optional(),
    observation: z.string().min(1),
    strength: EvidenceStrengthSchema,
    supports: z.array(z.string()).default([]),
    contradicts: z.array(z.string()).default([]),
  })
  .strict();

export const ResearchCaseSchema = z
  .object({
    id: z.string().min(1),
    objective: z.string().min(1),
    nicheId: z.string().optional(),
    businessId: z.string().optional(),
    depth: ResearchDepthSchema,
    questions: z.array(z.string().min(1)).min(1),
    evidenceRefs: z.array(z.string()).default([]),
    status: z.enum(['planned', 'running', 'completed', 'blocked', 'cancelled']),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
  })
  .strict();

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

export const OpportunityRunEventSchema = z
  .object({
    id: z.string().min(1),
    runId: z.string().min(1),
    nicheId: z.string().min(1),
    stage: z.string().min(1),
    agentName: z.string().min(1),
    level: z.enum(['info', 'warn', 'error', 'success']).default('info'),
    message: z.string().min(1),
    metadata: z.record(z.unknown()).optional(),
    occurredAt: z.string().datetime(),
  })
  .strict();

export const OpportunityProblemRecordSchema = z
  .object({
    id: z.string().min(1),
    businessId: z.string().min(1),
    nicheId: z.string().min(1),
    runId: z.string().min(1),
    statement: z.string().min(1),
    severity: z.number().min(0).max(100),
    frequency: z.number().min(0).max(100),
    financialImpact: z.number().min(0).max(100),
    evidenceConfidence: z.number().min(0).max(100),
    evidenceRefs: z.array(z.string()).min(1),
    createdAt: z.string().datetime(),
  })
  .strict();

export const DiscoveryCandidateRecordSchema = z
  .object({
    id: z.string().min(1),
    runId: z.string().min(1),
    nicheId: z.string().min(1),
    externalId: z.string().optional(),
    name: z.string().min(1),
    websiteUrl: z.string().url().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    geography: z.string().min(1),
    industry: z.string().optional(),
    sourceRefs: z.array(z.string()).min(1),
    discoveredAt: z.string().datetime(),
  })
  .strict();

export const OutreachChannelSchema = z.enum(['email', 'whatsapp', 'linkedin', 'phone']);
export const OutreachStatusSchema = z.enum(['drafted', 'ready', 'sent', 'replied', 'converted', 'rejected']);

export const OutreachDraftSchema = z
  .object({
    id: z.string().min(1),
    opportunityId: z.string().min(1),
    businessId: z.string().min(1),
    nicheId: z.string().min(1),
    channel: OutreachChannelSchema,
    recipient: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().min(1),
    language: z.enum(['ar', 'en', 'bilingual']).default('en'),
    valueProposition: z.string().min(1),
    evidenceRefs: z.array(z.string()).default([]),
    status: OutreachStatusSchema.default('drafted'),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type OpportunityStatus = z.infer<typeof OpportunityStatusSchema>;
export type NicheStatus = z.infer<typeof NicheStatusSchema>;
export type OpportunityType = z.infer<typeof OpportunityTypeSchema>;
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;
export type EvidenceStrength = z.infer<typeof EvidenceStrengthSchema>;
export type BusinessProspect = z.infer<typeof BusinessProspectSchema>;
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;
export type ResearchCase = z.infer<typeof ResearchCaseSchema>;
export type NicheDefinition = z.infer<typeof NicheDefinitionSchema>;
export type Problem = z.infer<typeof ProblemSchema>;
export type OpportunityScore = z.infer<typeof OpportunityScoreSchema>;
export type Opportunity = z.infer<typeof OpportunitySchema>;
export type NicheRunMetrics = z.infer<typeof NicheRunMetricsSchema>;
export type Experiment = z.infer<typeof ExperimentSchema>;
export type OpportunityRunEvent = z.infer<typeof OpportunityRunEventSchema>;
export type OpportunityProblemRecord = z.infer<typeof OpportunityProblemRecordSchema>;
export type DiscoveryCandidateRecord = z.infer<typeof DiscoveryCandidateRecordSchema>;
export type OutreachChannel = z.infer<typeof OutreachChannelSchema>;
export type OutreachStatus = z.infer<typeof OutreachStatusSchema>;
export type OutreachDraft = z.infer<typeof OutreachDraftSchema>;
