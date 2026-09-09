import { z } from 'zod';
import {
  CustomerIdSchema,
  CaseIdSchema,
  DeliveryOutcomeIdSchema,
  FeedbackIdSchema,
  LearningIdSchema,
  FinancialSummaryIdSchema,
  ProjectIdSchema,
  ContactIdSchema,
  DealIdSchema,
  MemoryIdSchema,
} from '../common/ids.js';

/** Customer Account Status */
export const CustomerAccountStatusSchema = z.enum([
  'onboarding',
  'active',
  'at_risk',
  'churned',
]);
export type CustomerAccountStatus = z.infer<typeof CustomerAccountStatusSchema>;

/** Customer Health Tier */
export const CustomerHealthTierSchema = z.enum(['healthy', 'neutral', 'critical']);
export type CustomerHealthTier = z.infer<typeof CustomerHealthTierSchema>;

/** Customer Account Contract */
export const CustomerAccountSchema = z
  .object({
    id: CustomerIdSchema,
    prospectId: z.string().min(1),
    dealId: DealIdSchema.optional(),
    companyName: z.string().min(1),
    status: CustomerAccountStatusSchema.default('onboarding'),
    healthScore: z.number().min(0).max(100).default(100),
    healthTier: CustomerHealthTierSchema.default('healthy'),
    primaryContactId: ContactIdSchema.optional(),
    activeProjectIds: z.array(ProjectIdSchema).default([]),
    mrr: z.number().nonnegative().default(0),
    lifetimeValue: z.number().nonnegative().default(0),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type CustomerAccount = z.infer<typeof CustomerAccountSchema>;
export type CustomerAccountInput = z.input<typeof CustomerAccountSchema>;

/** Delivery Outcome Status */
export const DeliveryOutcomeStatusSchema = z.enum([
  'successful',
  'partially_successful',
  'failed',
  'delayed',
]);
export type DeliveryOutcomeStatus = z.infer<typeof DeliveryOutcomeStatusSchema>;

/** KPI result metric */
export const DeliveryKpiResultSchema = z
  .object({
    metric: z.string().min(1),
    target: z.number(),
    actual: z.number(),
    achieved: z.boolean(),
  })
  .strict();
export type DeliveryKpiResult = z.infer<typeof DeliveryKpiResultSchema>;

/** Client Signoff */
export const ClientSignoffSchema = z
  .object({
    signedBy: z.string().min(1),
    signedAt: z.string().datetime(),
    clientSatisfactionScore: z.number().min(1).max(5),
  })
  .strict();
export type ClientSignoff = z.infer<typeof ClientSignoffSchema>;

/** Delivery Outcome Contract */
export const DeliveryOutcomeSchema = z
  .object({
    id: DeliveryOutcomeIdSchema,
    projectId: ProjectIdSchema,
    customerId: CustomerIdSchema,
    status: DeliveryOutcomeStatusSchema,
    deliveredAt: z.string().datetime(),
    scopeDeliveredPercent: z.number().min(0).max(100),
    acceptanceCriteriaMet: z.boolean(),
    clientSignoff: ClientSignoffSchema,
    kpiResults: z.array(DeliveryKpiResultSchema).default([]),
    notes: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type DeliveryOutcome = z.infer<typeof DeliveryOutcomeSchema>;
export type DeliveryOutcomeInput = z.input<typeof DeliveryOutcomeSchema>;

/** Support Case Severity & Status */
export const SupportCaseSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type SupportCaseSeverity = z.infer<typeof SupportCaseSeveritySchema>;

export const SupportCaseStatusSchema = z.enum(['open', 'in_progress', 'resolved', 'closed']);
export type SupportCaseStatus = z.infer<typeof SupportCaseStatusSchema>;

/** Support Case Contract */
export const SupportCaseSchema = z
  .object({
    id: CaseIdSchema,
    customerId: CustomerIdSchema,
    projectId: ProjectIdSchema.optional(),
    title: z.string().min(1),
    description: z.string().min(1),
    severity: SupportCaseSeveritySchema,
    status: SupportCaseStatusSchema.default('open'),
    slaHours: z.number().positive(),
    firstResponseAt: z.string().datetime().optional(),
    resolvedAt: z.string().datetime().optional(),
    resolutionSummary: z.string().optional(),
    slaBreached: z.boolean().default(false),
    reportedBy: z.string().min(1),
    assignedSpecialist: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type SupportCase = z.infer<typeof SupportCaseSchema>;
export type SupportCaseInput = z.input<typeof SupportCaseSchema>;

/** Customer Feedback */
export const FeedbackSentimentSchema = z.enum(['positive', 'neutral', 'negative']);
export type FeedbackSentiment = z.infer<typeof FeedbackSentimentSchema>;

export const FeedbackCategorySchema = z.enum([
  'delivery_quality',
  'communication',
  'velocity',
  'pricing',
  'technical_depth',
]);
export type FeedbackCategory = z.infer<typeof FeedbackCategorySchema>;

export const CustomerFeedbackSchema = z
  .object({
    id: FeedbackIdSchema,
    customerId: CustomerIdSchema,
    projectId: ProjectIdSchema,
    npsScore: z.number().min(0).max(10),
    csatScore: z.number().min(1).max(5),
    sentiment: FeedbackSentimentSchema,
    category: FeedbackCategorySchema,
    feedbackText: z.string().min(1),
    actionableQuotes: z.array(z.string()).default([]),
    submittedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type CustomerFeedback = z.infer<typeof CustomerFeedbackSchema>;
export type CustomerFeedbackInput = z.input<typeof CustomerFeedbackSchema>;

/** Financial Costs Breakdown */
export const FinancialCostsSchema = z
  .object({
    computeCost: z.number().nonnegative().default(0),
    tokenCost: z.number().nonnegative().default(0),
    laborHours: z.number().nonnegative().default(0),
    laborCost: z.number().nonnegative().default(0),
    toolingCost: z.number().nonnegative().default(0),
    totalCost: z.number().nonnegative().default(0),
  })
  .strict();
export type FinancialCosts = z.infer<typeof FinancialCostsSchema>;

export const ProfitabilityStatusSchema = z.enum([
  'highly_profitable',
  'profitable',
  'break_even',
  'unprofitable',
]);
export type ProfitabilityStatus = z.infer<typeof ProfitabilityStatusSchema>;

/** Project Financial Summary Contract */
export const ProjectFinancialSummarySchema = z
  .object({
    id: FinancialSummaryIdSchema,
    projectId: ProjectIdSchema,
    customerId: CustomerIdSchema,
    contractRevenue: z.number().nonnegative(),
    recognizedRevenue: z.number().nonnegative().default(0),
    invoicedAmount: z.number().nonnegative().default(0),
    collectedAmount: z.number().nonnegative().default(0),
    costs: FinancialCostsSchema,
    grossMargin: z.number(),
    marginPercent: z.number(),
    profitabilityStatus: ProfitabilityStatusSchema,
    calculatedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type ProjectFinancialSummary = z.infer<typeof ProjectFinancialSummarySchema>;
export type ProjectFinancialSummaryInput = z.input<typeof ProjectFinancialSummarySchema>;

/** Learning Category & Source */
export const LearningSourceTypeSchema = z.enum([
  'delivery_outcome',
  'support_postmortem',
  'customer_feedback',
  'profitability_analysis',
]);
export type LearningSourceType = z.infer<typeof LearningSourceTypeSchema>;

export const LearningCategorySchema = z.enum([
  'pricing_calibration',
  'scope_estimation',
  'technical_pattern',
  'customer_risk',
  'delivery_workflow',
]);
export type LearningCategory = z.infer<typeof LearningCategorySchema>;

export const LearningFutureImpactSchema = z
  .object({
    suggestedPriceMultiplier: z.number().positive().optional(),
    riskFactorAdjustment: z.number().optional(),
    reusableMemoryId: MemoryIdSchema.optional(),
  })
  .strict();
export type LearningFutureImpact = z.infer<typeof LearningFutureImpactSchema>;

/** Learning Record Contract */
export const LearningRecordSchema = z
  .object({
    id: LearningIdSchema,
    sourceType: LearningSourceTypeSchema,
    projectId: ProjectIdSchema.optional(),
    customerId: CustomerIdSchema.optional(),
    opportunityId: z.string().min(1).optional(),
    title: z.string().min(1),
    category: LearningCategorySchema,
    keyInsight: z.string().min(1),
    recommendedActions: z.array(z.string()).min(1),
    impactOnFutureEstimates: LearningFutureImpactSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type LearningRecord = z.infer<typeof LearningRecordSchema>;
export type LearningRecordInput = z.input<typeof LearningRecordSchema>;

/** Opportunity Calibration Data derived from completed work */
export const OpportunityCalibrationSchema = z
  .object({
    completedDeliveriesCount: z.number().nonnegative(),
    successRatePercent: z.number().min(0).max(100),
    averageMarginPercent: z.number(),
    recommendedPriceMultiplier: z.number().positive().default(1.0),
    overallCustomerHealthScore: z.number().min(0).max(100),
    activeLearningsCount: z.number().nonnegative(),
    activeLearnings: z.array(LearningRecordSchema).default([]),
    calibratedAt: z.string().datetime(),
  })
  .strict();
export type OpportunityCalibration = z.infer<typeof OpportunityCalibrationSchema>;
export type OpportunityCalibrationInput = z.input<typeof OpportunityCalibrationSchema>;
