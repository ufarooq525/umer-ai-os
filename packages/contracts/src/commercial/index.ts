import { z } from 'zod';
import {
  AttributionIdSchema,
  ContactIdSchema,
  DealIdSchema,
  ProposalIdSchema,
} from '../common/ids.js';
import { OutreachChannelSchema } from '../opportunities/index.js';

export const ContactProvenanceSchema = z
  .object({
    sourceUrl: z.string().url(),
    observedAt: z.string().datetime(),
    method: z.enum(['directory', 'website_scrape', 'manual', 'referral', 'other']),
    rawText: z.string().optional(),
  })
  .strict();

export const ContactVerificationStatusSchema = z.enum(['unverified', 'verified', 'bounced']);

export const ContactSchema = z
  .object({
    id: ContactIdSchema,
    prospectId: z.string().min(1),
    name: z.string().min(1),
    role: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    linkedinUrl: z.string().url().optional(),
    isPrimary: z.boolean().default(false),
    verificationStatus: ContactVerificationStatusSchema.default('unverified'),
    provenance: ContactProvenanceSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const OpportunityProspectRoleSchema = z.enum(['primary', 'secondary', 'competitor', 'partner']);

export const OpportunityProspectLinkSchema = z
  .object({
    id: z.string().min(1),
    opportunityId: z.string().min(1),
    prospectId: z.string().min(1),
    role: OpportunityProspectRoleSchema.default('primary'),
    linkedAt: z.string().datetime(),
  })
  .strict();

export const OutreachEventSchema = z
  .object({
    id: z.string().min(1),
    dealId: DealIdSchema,
    contactId: ContactIdSchema,
    channel: OutreachChannelSchema,
    templateId: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().min(1),
    sentAt: z.string().datetime(),
    senderAgentId: z.string().optional(),
  })
  .strict();

export const OutreachSentimentSchema = z.enum(['positive', 'neutral', 'negative', 'objection', 'unresponsive']);

export const OutreachResponseSchema = z
  .object({
    id: z.string().min(1),
    outreachEventId: z.string().min(1),
    dealId: DealIdSchema,
    contactId: ContactIdSchema,
    sentiment: OutreachSentimentSchema,
    content: z.string().min(1),
    receivedAt: z.string().datetime(),
  })
  .strict();

export const CommercialQualificationSchema = z
  .object({
    dealId: DealIdSchema,
    evaluatedAt: z.string().datetime(),
    budget: z.object({
      confirmed: z.boolean(),
      amount: z.number().optional(),
      currency: z.string().default('USD'),
      notes: z.string().optional(),
    }),
    authority: z.object({
      decisionMakerIdentified: z.boolean(),
      decisionMakerContactId: ContactIdSchema.optional(),
      notes: z.string().optional(),
    }),
    need: z.object({
      problemValidated: z.boolean(),
      urgency: z.enum(['immediate', 'this_quarter', 'future', 'unknown']),
      notes: z.string().optional(),
    }),
    timeline: z.object({
      expectedCloseDate: z.string().datetime().optional(),
      implementationDeadline: z.string().datetime().optional(),
      notes: z.string().optional(),
    }),
    score: z.number().min(0).max(100),
    qualified: z.boolean(),
  })
  .strict();

export const SalesStageSchema = z.enum([
  'lead',
  'contacted',
  'engaged',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
]);

export const DealStageTransitionSchema = z
  .object({
    fromStage: SalesStageSchema.nullable(),
    toStage: SalesStageSchema,
    timestamp: z.string().datetime(),
    actor: z.string().min(1),
    reason: z.string().optional(),
  })
  .strict();

export const DealContractSchema = z
  .object({
    id: DealIdSchema,
    opportunityId: z.string().min(1),
    primaryProspectId: z.string().min(1),
    title: z.string().min(1),
    stage: SalesStageSchema,
    estimatedValue: z.number().nonnegative().optional(),
    currency: z.string().min(3).max(3).default('USD'),
    probability: z.number().min(0).max(1).default(0.2),
    qualification: CommercialQualificationSchema.optional(),
    stageHistory: z.array(DealStageTransitionSchema).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const ProposalPricingModelSchema = z.enum(['fixed', 'milestone', 'retainer', 'time_and_materials']);
export const ProposalStatusSchema = z.enum(['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'rejected']);

export const ProposalContractSchema = z
  .object({
    id: ProposalIdSchema,
    dealId: DealIdSchema,
    opportunityId: z.string().min(1),
    title: z.string().min(1),
    scope: z.string().min(1),
    deliverables: z.array(z.string().min(1)).min(1),
    pricingModel: ProposalPricingModelSchema,
    totalAmount: z.number().positive(),
    currency: z.string().min(3).max(3).default('USD'),
    discountPercent: z.number().min(0).max(100).default(0),
    requiresCeoApproval: z.boolean().default(false),
    ceoApprovalId: z.string().optional(),
    status: ProposalStatusSchema,
    validUntil: z.string().datetime(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const RevenueAttributionStatusSchema = z.enum(['pipeline', 'won', 'billed', 'collected']);

export const RevenueAttributionSchema = z
  .object({
    id: AttributionIdSchema,
    dealId: DealIdSchema,
    opportunityId: z.string().min(1),
    projectId: z.string().min(1),
    recognizedAmount: z.number().positive(),
    currency: z.string().min(3).max(3).default('USD'),
    attributionDate: z.string().datetime(),
    salesAgentId: z.string().optional(),
    status: RevenueAttributionStatusSchema,
  })
  .strict();

export type ContactProvenance = z.infer<typeof ContactProvenanceSchema>;
export type ContactVerificationStatus = z.infer<typeof ContactVerificationStatusSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type OpportunityProspectRole = z.infer<typeof OpportunityProspectRoleSchema>;
export type OpportunityProspectLink = z.infer<typeof OpportunityProspectLinkSchema>;
export type OutreachEvent = z.infer<typeof OutreachEventSchema>;
export type OutreachSentiment = z.infer<typeof OutreachSentimentSchema>;
export type OutreachResponse = z.infer<typeof OutreachResponseSchema>;
export type CommercialQualification = z.infer<typeof CommercialQualificationSchema>;
export type CommercialQualificationInput = z.input<typeof CommercialQualificationSchema>;
export type SalesStage = z.infer<typeof SalesStageSchema>;
export type DealStageTransition = z.infer<typeof DealStageTransitionSchema>;
export type DealContract = z.infer<typeof DealContractSchema>;
export type ProposalPricingModel = z.infer<typeof ProposalPricingModelSchema>;
export type ProposalStatus = z.infer<typeof ProposalStatusSchema>;
export type ProposalContract = z.infer<typeof ProposalContractSchema>;
export type RevenueAttributionStatus = z.infer<typeof RevenueAttributionStatusSchema>;
export type RevenueAttribution = z.infer<typeof RevenueAttributionSchema>;
