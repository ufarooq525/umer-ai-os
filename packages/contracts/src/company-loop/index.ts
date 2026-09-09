import { z } from 'zod';
import {
  LoopCycleIdSchema,
  ProjectIdSchema,
  DealIdSchema,
  CustomerIdSchema,
} from '../common/ids.js';

/** Canonical stages of the Autonomous Company Loop */
export const CompanyLoopStageSchema = z.enum([
  'market_discovery',
  'opportunity_scoring',
  'commercial_sales',
  'requirements_intake',
  'product_definition',
  'architecture_ux',
  'engineering_delivery',
  'qa_security_gates',
  'release_operations',
  'customer_success',
  'revenue_realization',
  'learning_calibration',
]);
export type CompanyLoopStage = z.infer<typeof CompanyLoopStageSchema>;

export const LoopStageExecutionStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'skipped',
]);
export type LoopStageExecutionStatus = z.infer<typeof LoopStageExecutionStatusSchema>;

export const CompanyLoopStageStatusSchema = z
  .object({
    stage: CompanyLoopStageSchema,
    status: LoopStageExecutionStatusSchema,
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    details: z.record(z.unknown()).default({}),
  })
  .strict();
export type CompanyLoopStageStatus = z.infer<typeof CompanyLoopStageStatusSchema>;

export const CompanyLoopCycleSchema = z
  .object({
    id: LoopCycleIdSchema,
    title: z.string().min(1),
    status: z.enum(['active', 'completed', 'failed', 'paused']),
    currentStage: CompanyLoopStageSchema,
    nicheId: z.string().optional(),
    opportunityId: z.string().optional(),
    dealId: DealIdSchema.optional(),
    projectId: ProjectIdSchema.optional(),
    requirementId: z.string().optional(),
    customerId: CustomerIdSchema.optional(),
    stages: z.array(CompanyLoopStageStatusSchema),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    error: z.string().optional(),
  })
  .strict();
export type CompanyLoopCycle = z.infer<typeof CompanyLoopCycleSchema>;
export type CompanyLoopCycleInput = z.input<typeof CompanyLoopCycleSchema>;

/**
 * CompanyOverviewSchema:
 * Canonical representation answering the 10 CEO questions directly
 * from real persisted state in accordance with the CEO Success Test.
 */
export const CompanyOverviewSchema = z
  .object({
    whatCompanyIsDoing: z
      .object({
        activeProjectsCount: z.number().nonnegative(),
        runningTasksCount: z.number().nonnegative(),
        openDealsCount: z.number().nonnegative(),
        productionStatus: z.string(),
        activeLoopCyclesCount: z.number().nonnegative(),
        summary: z.string(),
      })
      .strict(),
    opportunitiesPursued: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          status: z.string(),
          overallScore: z.number(),
          estimatedValue: z.number().optional(),
          recommendation: z.string(),
        })
        .strict(),
    ),
    prospectsThatMatter: z.array(
      z
        .object({
          prospectId: z.string(),
          dealId: z.string().optional(),
          companyName: z.string(),
          stage: z.string().optional(),
          estimatedValue: z.number().optional(),
        })
        .strict(),
    ),
    agentsWorking: z.array(
      z
        .object({
          agentId: z.string(),
          name: z.string().optional(),
          department: z.string(),
          specialistId: z.string(),
          status: z.string(),
          currentProjectId: z.string().optional(),
          currentTaskId: z.string().optional(),
        })
        .strict(),
    ),
    projectsByAgent: z.record(
      z
        .object({
          agentId: z.string(),
          projectId: z.string(),
          taskId: z.string().optional(),
        })
        .strict(),
    ),
    evidenceSummary: z
      .object({
        totalSealedArtifacts: z.number().nonnegative(),
        testPlanResultsCount: z.number().nonnegative(),
        securityReportsCount: z.number().nonnegative(),
        signedDeliveryOutcomesCount: z.number().nonnegative(),
      })
      .strict(),
    blockedItems: z.array(
      z
        .object({
          type: z.enum(['work_graph_node', 'gate', 'support_case', 'deal']),
          id: z.string(),
          reason: z.string(),
          blockedSince: z.string(),
        })
        .strict(),
    ),
    decisionsNeeded: z.array(
      z
        .object({
          type: z.enum(['deal_approval', 'deployment_approval', 'gate_review', 'incident_review']),
          id: z.string(),
          title: z.string(),
          urgency: z.enum(['low', 'medium', 'high', 'critical']),
          requiredApprovers: z.array(z.string()),
        })
        .strict(),
    ),
    nextActions: z.array(
      z
        .object({
          action: z.string(),
          targetType: z.string(),
          targetId: z.string(),
          priority: z.enum(['low', 'medium', 'high']),
        })
        .strict(),
    ),
    revenueAndOutcomes: z
      .object({
        totalWonRevenue: z.number().nonnegative(),
        recognizedRevenue: z.number().nonnegative(),
        pipelineValue: z.number().nonnegative(),
        averageMarginPercent: z.number(),
        averageCustomerHealthScore: z.number(),
        activeCustomersCount: z.number().nonnegative(),
        completedDeliveriesCount: z.number().nonnegative(),
        recommendedPriceMultiplier: z.number().positive(),
      })
      .strict(),
    generatedAt: z.string().datetime(),
  })
  .strict();
export type CompanyOverview = z.infer<typeof CompanyOverviewSchema>;
