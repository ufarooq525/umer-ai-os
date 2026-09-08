import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import {
  ArtifactIdSchema,
  ExecIdSchema,
  TaskIdSchema,
} from '../common/ids.js';

/** Artifact type registry — Execution/ARTIFACT_CONTRACTS.md */
export const ArtifactTypeSchema = z.enum([
  'Brief',
  'ResearchFinding',
  'ADR',
  'DesignArtifact',
  'Code',
  'TestPlanResults',
  'SEOAudit',
  'MarketingAsset',
  'ReleasePackage',
  'Decision',
  'RequirementsBrief',
  'ProductBrief',
]);

export const ArtifactAcceptanceStatusSchema = z.enum([
  'draft',
  'submitted',
  'accepted',
  'rejected',
]);

export const AcceptanceCriterionEvidenceSchema = z
  .object({
    criterion: z.string().min(1),
    status: z.enum(['VERIFIED', 'FAILED', 'N_A']),
    evidenceRef: z.string().min(1).optional(),
  })
  .strict();

export const ArtifactContractSchema = withContractHeader({
  kind: z.literal('artifact'),
  artifactId: ArtifactIdSchema,
  artifactType: ArtifactTypeSchema,
  version: z.string().min(1),
  producedBy: z.string().min(1),
  producedFor: ExecIdSchema,
  acceptanceStatus: ArtifactAcceptanceStatusSchema,
  acceptanceCriteriaMet: z.array(AcceptanceCriterionEvidenceSchema).default([]),
  sourceTaskId: TaskIdSchema.optional(),
  contentRef: z.string().min(1),
  contentHash: z.string().min(1).optional(),
  supersedesArtifactId: ArtifactIdSchema.optional(),
});

export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;
export type ArtifactAcceptanceStatus = z.infer<typeof ArtifactAcceptanceStatusSchema>;
export type AcceptanceCriterionEvidence = z.infer<typeof AcceptanceCriterionEvidenceSchema>;
export type ArtifactContract = z.infer<typeof ArtifactContractSchema>;
