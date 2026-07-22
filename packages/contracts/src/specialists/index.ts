import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import { CapabilityIdSchema, SpecialistIdSchema } from '../common/ids.js';

/** Specialist Architecture — Authority Class */
export const AuthorityClassSchema = z.enum([
  'Advise',
  'Produce',
  'Verify',
  'Constrain',
  'Enable',
  'ApproveScoped',
  'Orchestrate',
]);

/** Mandate Domain (Axis A) */
export const MandateDomainSchema = z.enum([
  'Executive',
  'Business',
  'Delivery',
  'ControlAssist',
  'EvidenceAssist',
]);

export const InteractionModeSchema = z.enum([
  'SoloProducer',
  'Reviewer',
  'Approver',
  'PairPrimary',
  'PairSecondary',
  'DelegateLead',
  'Integrator',
]);

export const SpecialistLifecycleStatusSchema = z.enum([
  'Proposed',
  'Created',
  'Registered',
  'Active',
  'Suspended',
  'UnderRevision',
  'Retired',
  'Archived',
]);

export const SpecialistContractSchema = withContractHeader({
  kind: z.literal('specialist'),
  specialistId: SpecialistIdSchema,
  name: z.string().min(1),
  department: z.string().min(1),
  mission: z.string().min(1),
  mandateDomain: MandateDomainSchema,
  authorityClass: AuthorityClassSchema,
  interactionMode: InteractionModeSchema,
  status: SpecialistLifecycleStatusSchema,
  capabilityIds: z.array(CapabilityIdSchema).min(1),
  skillBindings: z.array(z.string()).default([]),
  toolAllowlist: z.array(z.string()).default([]),
  nonGoals: z.array(z.string()).default([]),
  specVersion: z.string().min(1),
  specHash: z.string().min(1),
  humanAccountabilityAnchor: z.string().min(1),
});

export type AuthorityClass = z.infer<typeof AuthorityClassSchema>;
export type MandateDomain = z.infer<typeof MandateDomainSchema>;
export type InteractionMode = z.infer<typeof InteractionModeSchema>;
export type SpecialistLifecycleStatus = z.infer<typeof SpecialistLifecycleStatusSchema>;
export type SpecialistContract = z.infer<typeof SpecialistContractSchema>;
