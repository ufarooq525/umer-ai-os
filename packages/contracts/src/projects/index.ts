import { z } from 'zod';
import { withContractHeader } from '../common/envelope.js';
import { ProjectIdSchema } from '../common/ids.js';

/**
 * Project — Work Management's execution-layer operationalization of an
 * Initiative (Execution/WORK_MANAGEMENT_FRAMEWORK.md, Enterprise_Architecture/
 * ENTERPRISE_TAXONOMY.md). This is the FIRST typed contract for this noun —
 * only the `ProjectIdSchema` id brand existed before (already referenced by
 * TaskContract, ExecInstanceContract, RequestContract).
 *
 * NOT the same "project" as @umer/registry's ProjectRecord/ResolvedProject,
 * which is a registered *codebase* (a Laragon folder + stack + category for
 * Engineering intake — see projects/catalog.json). That registry concept
 * predates this one and keeps its own identity; a Work Management Project MAY
 * reference a registered codebase via `registryProjectId`, but the two are
 * never conflated. See implementation/COMPANY_OPERATING_MODEL.md for the full
 * boundary writeup.
 */
export const ProjectStatusSchema = z.enum([
  'Forming',
  'Active',
  'Stabilizing',
  'Closing',
  /**
   * CEO Command Plane control state (PauseProject/ResumeProject) — added for
   * this milestone. No migration involved: Project is in-memory-only today
   * (see sourceOpportunityId doc below), so this is a contract-only addition,
   * not a database change.
   */
  'Paused',
  'Archived',
  'Abandoned',
]);

export const ProjectContractSchema = withContractHeader({
  kind: z.literal('project'),
  projectId: ProjectIdSchema,
  name: z.string().min(1),
  status: ProjectStatusSchema,
  owner: z.string().min(1).optional(),
  /**
   * Opportunity Intelligence id this Project was created to execute, if any.
   * This is currently the ONLY place the Opportunity<->Project relationship
   * is recorded (the reverse — an Opportunity naming its Project — is
   * intentionally not stored on Opportunity; see the doc comment on
   * OpportunityStatusSchema in @umer/contracts/opportunities). It round-trips
   * only as far as this Project record's own store persists (in-memory today
   * — see implementation/COMPANY_OPERATING_MODEL.md §Persistence); it is not
   * a claim about Opportunity Intelligence's MySQL persistence.
   */
  sourceOpportunityId: z.string().min(1).optional(),
  /** @umer/registry codebase this Project delivers against, if any — see doc comment above. */
  registryProjectId: z.string().min(1).optional(),
});

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectContract = z.infer<typeof ProjectContractSchema>;
