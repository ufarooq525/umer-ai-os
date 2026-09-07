import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditContract } from '@umer/contracts';
import type { CeoCommandService, ControlPlaneService } from '@umer/control-plane';
import type { AuditService } from '@umer/audit';
import type { TrustRuntime } from '@umer/trust';
import type { AgentRegistryStore, AgentRunReadModelStore, AgentSnapshot } from '@umer/observability';
import type { OpportunityPersistence } from '@umer/opportunity-intelligence';
import type { ArtifactStore } from '@umer/artifacts';
import type { MessageFabricClient } from '@umer/message-fabric';
import type { PersistentWorkGraph, WorkGraphStore } from '@umer/orchestration';
import { type BusEvent, type BusEventSource, type EventBus, type QaRequestedPayload } from '@umer/event-bus';
import type { ProjectStore } from './project-store.js';
import type { TaskStore } from './task-store.js';
import type { RequirementStore } from './requirement-store.js';
import type { AgentControlStore } from './agent-control-store.js';
import { applyEngToProject, applyQaToProject, applySeoToProject, applySecurityToProject, applyPerfToProject, applyUxToProject, createProjectRegistry, decideEngGate, decideSecurityGateByCategory, decidePerfGateByCategory, hasElevatedSecurityFindings, hasElevatedPerfFindings, planIntakeForControl, type EngApplyResult, type IntakeInstruction, type IntakePlan, type CodeProducer, type ProjectRegistry, type ResolvedProject, type QaApplyResult, type SeoApplyResult, type SecurityApplyResult, type PerfApplyResult, type UxApplyResult } from '@umer/registry';

export type WorkPackageSummary = { workPackageId: string; execId: string; status: string; specialistId: string; stage: string; artifactId?: string; projectId?: string; errorMessage?: string; updatedAt?: string };
export type WorkGraphPlanResult = { created: string[]; skipped: Array<{ nodeId: string; nodeType: string; reason: string }>; occurredAt: string };
export type IntakeTrigger = { eventId: string; correlationId: string; source: BusEventSource };
export type IntakeRecord = { intakeId: string; plan: IntakePlan; createdAt: string; status: 'planned' | 'approved' | 'rejected'; trigger?: IntakeTrigger; applyResult?: SeoApplyResult | QaApplyResult | EngApplyResult | SecurityApplyResult | PerfApplyResult | UxApplyResult };

export type ControlApiState = {
  controlPlane: ControlPlaneService;
  auditService: AuditService;
  workPackages: WorkPackageSummary[];
  projectRegistry: ProjectRegistry;
  intakes: IntakeRecord[];
  bus: EventBus;
  codeProducer?: CodeProducer;
  qaBusShimRegistered?: boolean;
  agentRunReadModel?: AgentRunReadModelStore;
  agentRegistry?: AgentRegistryStore;
  projectStore?: ProjectStore;
  taskStore?: TaskStore;
  requirementStore?: RequirementStore;
  agentControlStore?: AgentControlStore;
  opportunityReader?: OpportunityPersistence;
  trustRuntime?: TrustRuntime;
  commandService?: CeoCommandService;
  artifactStore?: ArtifactStore;
  fabric?: MessageFabricClient;
  workGraphStore?: WorkGraphStore;
  persistentWorkGraph?: PersistentWorkGraph;
  workGraphPlanResults?: Map<string, WorkGraphPlanResult>;
};

export function resolveCatalogPath(): string { const fromEnv = process.env.UMER_PROJECTS_CATALOG; if (fromEnv && fromEnv.length > 0) return fromEnv; const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..'); return join(repoRoot, 'projects', 'catalog.json'); }
export async function loadProjectRegistry(): Promise<ProjectRegistry> { return createProjectRegistry({ catalogPath: resolveCatalogPath() }); }

export async function seedDemoState(state: ControlApiState): Promise<void> {
  state.workPackages.length = 0;
  state.workPackages.push({ workPackageId: 'wp-e2e-1', execId: 'EXEC-001', status: 'AwaitingReview', specialistId: 'eng.app-delivery', stage: 'Development', artifactId: 'art-wp-e2e-1-1', projectId: 'nitrotickets-new' });
  await state.controlPlane.requestGateReview({ gateId: 'gate-dev-qa', execId: 'EXEC-001', workPackageId: 'wp-e2e-1', artifactId: 'art-wp-e2e-1-1', stageFrom: 'Development', stageTo: 'QA', requiredApprovers: ['human.approver'], humanRequired: true }, 'corr-demo-seed');
  await state.auditService.append({ action: 'agent.run.completed', actor: 'eng.app-delivery', resourceType: 'work_package', resourceId: 'wp-e2e-1', outcome: 'success', correlationId: 'corr-e2e-flow', detail: { demo: true, projectId: 'nitrotickets-new', note: 'Bootstrap sample — not a real intake' } }, 'corr-e2e-flow');
  await state.auditService.append({ action: 'artifact.sealed', actor: 'eng.app-delivery', resourceType: 'artifact', resourceId: 'art-wp-e2e-1-1', outcome: 'success', correlationId: 'corr-e2e-flow', detail: { demo: true, projectId: 'nitrotickets-new', note: 'Bootstrap sample — not a real intake' } }, 'corr-e2e-flow');
}
