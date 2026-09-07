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
export async function seedDemoState(state: ControlApiState): Promise<void> { state.workPackages.length = 0; state.workPackages.push({ workPackageId: 'wp-e2e-1', execId: 'EXEC-001', status: 'AwaitingReview', specialistId: 'eng.app-delivery', stage: 'Development', artifactId: 'art-wp-e2e-1-1', projectId: 'nitrotickets-new' }); await state.controlPlane.requestGateReview({ gateId: 'gate-dev-qa', execId: 'EXEC-001', workPackageId: 'wp-e2e-1', artifactId: 'art-wp-e2e-1-1', stageFrom: 'Development', stageTo: 'QA', requiredApprovers: ['human.approver'], humanRequired: true }, 'corr-demo-seed'); await state.auditService.append({ action: 'agent.run.completed', actor: 'eng.app-delivery', resourceType: 'work_package', resourceId: 'wp-e2e-1', outcome: 'success', correlationId: 'corr-e2e-flow', detail: { demo: true, projectId: 'nitrotickets-new', note: 'Bootstrap sample — not a real intake' } }, 'corr-e2e-flow'); await state.auditService.append({ action: 'artifact.sealed', actor: 'eng.app-delivery', resourceType: 'artifact', resourceId: 'art-wp-e2e-1-1', outcome: 'success', correlationId: 'corr-e2e-flow', detail: { demo: true, projectId: 'nitrotickets-new', note: 'Bootstrap sample — not a real intake' } }, 'corr-e2e-flow'); }
export function listProjects(state: ControlApiState): ResolvedProject[] { return state.projectRegistry.list(); }
export async function enrichAgentWithProject(state: ControlApiState, agent: AgentSnapshot): Promise<AgentSnapshot & { currentProjectId?: string }> { const taskId = agent.currentTaskIds?.[0]; if (!taskId || !state.taskStore) return agent; const task = await state.taskStore.get(taskId); return task ? { ...agent, currentProjectId: task.projectId } : agent; }
export async function enrichAgentWithControlState(state: ControlApiState, agent: AgentSnapshot): Promise<AgentSnapshot & { controlState: 'active' | 'paused'; controlReason?: string }> { const record = await state.agentControlStore?.get(agent.agentId); return { ...agent, controlState: record?.controlState ?? 'active', controlReason: record?.reason }; }
export function registerQaBusShim(state: ControlApiState): void { if (state.qaBusShimRegistered) return; state.bus.subscribe('specialist.qa.requested', async (event) => ({ intakeRecord: await executeQaIntake(state, event as BusEvent<'specialist.qa.requested'>) })); state.qaBusShimRegistered = true; }

async function persistRequirementFromIntake(state: ControlApiState, instruction: IntakeInstruction): Promise<void> {
  if (!state.requirementStore) return;
  await state.requirementStore.create({
    projectId: instruction.projectId,
    title: instruction.goal.slice(0, 500),
    problem: instruction.goal,
    desiredOutcome: instruction.doneWhen ?? instruction.goal,
    constraints: instruction.constraints ?? [],
    acceptanceCriteria: [instruction.doneWhen ?? `Complete the requested ${instruction.type} work and provide reviewable evidence.`],
    assumptions: [],
    openQuestions: [],
    source: { kind: 'Request', label: `control-api ${instruction.type} intake` },
  });
}

export async function publishQaViaBus(state: ControlApiState, input: { projectId: string; goal: string; doneWhen?: string; constraints?: string[]; source: BusEventSource; correlationId?: string }): Promise<IntakeRecord> { const result = await state.bus.publishNew({ type: 'specialist.qa.requested', projectId: input.projectId, source: input.source, correlationId: input.correlationId, payload: { goal: input.goal, doneWhen: input.doneWhen, constraints: input.constraints } satisfies QaRequestedPayload }); if (result.handlerCount < 1) throw new Error('No subscriber for specialist.qa.requested — QA bus shim not registered'); const first = result.results[0] as { intakeRecord?: IntakeRecord } | undefined; if (!first?.intakeRecord) throw new Error('QA bus shim returned no intake record'); return first.intakeRecord; }
export async function executeQaIntake(state: ControlApiState, event: BusEvent<'specialist.qa.requested'>): Promise<IntakeRecord> { const instruction = { projectId: event.projectId, type: 'qa', goal: event.payload.goal, doneWhen: event.payload.doneWhen, constraints: event.payload.constraints } as IntakeInstruction; await persistRequirementFromIntake(state, instruction); const plan = await planIntakeForControl(state.projectRegistry, instruction); const intakeId = `intake-${Date.now()}`; const record: IntakeRecord = { intakeId, plan, createdAt: new Date().toISOString(), status: 'planned', trigger: { eventId: event.eventId, correlationId: event.correlationId, source: event.source } }; state.intakes.unshift(record); const workPackageId = `wp-${intakeId}`; state.workPackages.unshift({ workPackageId, execId: 'EXEC-9200', status: 'AwaitingReview', specialistId: 'qa.verify', stage: 'QA Verify', projectId: plan.projectId }); await state.controlPlane.requestGateReview({ gateId: `gate-qa-${plan.projectId}`, execId: 'EXEC-9200', workPackageId, stageFrom: 'QA Verify', stageTo: 'Dispatch', requiredApprovers: ['human.approver'], humanRequired: true }, event.correlationId); return record; }

export async function submitIntake(state: ControlApiState, instruction: IntakeInstruction): Promise<IntakeRecord> {
  await persistRequirementFromIntake(state, instruction);
  if (instruction.type === 'qa') return publishQaViaBus(state, { projectId: instruction.projectId, goal: instruction.goal, doneWhen: instruction.doneWhen, constraints: instruction.constraints, source: { kind: 'human.intake', actorId: 'human.operator', channel: 'control-api' } });
  const plan = await planIntakeForControl(state.projectRegistry, instruction, { codeProducer: state.codeProducer }); const intakeId = `intake-${Date.now()}`; const record: IntakeRecord = { intakeId, plan, createdAt: new Date().toISOString(), status: 'planned' }; state.intakes.unshift(record);
  const cfgMap: Record<string, { execId: string; specialistId: string; stage: string; gatePrefix: string }> = { seo: { execId: 'EXEC-9100', specialistId: 'seo.audit', stage: 'SEO Audit', gatePrefix: 'gate-seo-' }, security: { execId: 'EXEC-9400', specialistId: 'security.review', stage: 'Security Review', gatePrefix: 'gate-security-' }, perf: { execId: 'EXEC-9500', specialistId: 'perf.optimize', stage: 'Perf Optimize', gatePrefix: 'gate-perf-' }, ux: { execId: 'EXEC-9600', specialistId: 'ux.design', stage: 'UX Audit', gatePrefix: 'gate-ux-' }, feature: { execId: 'EXEC-9300', specialistId: 'eng.app-delivery', stage: 'Eng Delivery', gatePrefix: 'gate-eng-' }, bug: { execId: 'EXEC-9300', specialistId: 'eng.app-delivery', stage: 'Eng Delivery', gatePrefix: 'gate-eng-' } };
  const cfg = cfgMap[instruction.type] ?? { execId: 'EXEC-9000', specialistId: 'pm.intake', stage: 'Intake', gatePrefix: 'gate-intake-' }; const wp = `wp-${intakeId}`;
  if ((instruction.type === 'feature' || instruction.type === 'bug') && plan.engDelivery) { const project = state.projectRegistry.requireActive(plan.projectId); const gate = decideEngGate({ category: project.category, autoApplyEng: project.autoApplyEng === true, package: plan.engDelivery }); if (gate.autoApply) { const result = await applyEngToProject({ project, report: plan.engDelivery, approval: { kind: 'auto', reason: gate.reason } }); state.workPackages.unshift({ workPackageId: wp, execId: cfg.execId, status: 'Accepted', specialistId: cfg.specialistId, stage: cfg.stage, projectId: plan.projectId }); record.status = 'approved'; record.applyResult = result; return record; } }
  const project = (instruction.type === 'security' || instruction.type === 'perf') ? state.projectRegistry.requireActive(plan.projectId) : undefined; const humanRequired = instruction.type === 'security' ? hasElevatedSecurityFindings(plan.securityAudit?.findings ?? []) || decideSecurityGateByCategory(project!.category).humanRequired : instruction.type === 'perf' ? hasElevatedPerfFindings(plan.perfAudit?.findings ?? []) || decidePerfGateByCategory(project!.category).humanRequired : true;
  state.workPackages.unshift({ workPackageId: wp, execId: cfg.execId, status: 'AwaitingReview', specialistId: cfg.specialistId, stage: cfg.stage, projectId: plan.projectId }); await state.controlPlane.requestGateReview({ gateId: `${cfg.gatePrefix}${plan.projectId}`, execId: cfg.execId, workPackageId: wp, stageFrom: cfg.stage, stageTo: 'Dispatch', requiredApprovers: ['human.approver'], humanRequired }, `corr-${intakeId}`); return record;
}

async function applyGate(state: ControlApiState, input: { workPackageId: string; gateId: string; rationale: string; approver?: string }) { const intake = state.intakes.find((item) => `wp-${item.intakeId}` === input.workPackageId); if (!intake) return undefined; const project = state.projectRegistry.requireActive(intake.plan.projectId); if (input.gateId.startsWith('gate-perf-') && intake.plan.perfAudit) return applyPerfToProject({ project, report: intake.plan.perfAudit, rationale: input.rationale }); if (input.gateId.startsWith('gate-ux-') && intake.plan.uxAudit) return applyUxToProject({ project, report: intake.plan.uxAudit, rationale: input.rationale }); if (input.gateId.startsWith('gate-security-') && intake.plan.securityAudit) return applySecurityToProject({ project, audit: intake.plan.securityAudit, rationale: input.rationale }); if (input.gateId.startsWith('gate-seo-') && intake.plan.seoAudit) return applySeoToProject({ project, audit: intake.plan.seoAudit, rationale: input.rationale }); if (input.gateId.startsWith('gate-qa-') && intake.plan.qaAudit) return applyQaToProject({ project, audit: intake.plan.qaAudit, rationale: input.rationale }); if (input.gateId.startsWith('gate-eng-') && intake.plan.engDelivery) return applyEngToProject({ project, report: intake.plan.engDelivery, approval: { kind: 'human-gate', gateId: input.gateId, approver: input.approver ?? 'human.approver', rationale: input.rationale } }); return undefined; }
export const applyPerfOnGatePass = (state: ControlApiState, input: { workPackageId: string; gateId: string; rationale: string }) => input.gateId.startsWith('gate-perf-') ? applyGate(state, input) : Promise.resolve(undefined);
export const applyUxOnGatePass = (state: ControlApiState, input: { workPackageId: string; gateId: string; rationale: string }) => input.gateId.startsWith('gate-ux-') ? applyGate(state, input) : Promise.resolve(undefined);
export const applySecurityOnGatePass = (state: ControlApiState, input: { workPackageId: string; gateId: string; rationale: string }) => input.gateId.startsWith('gate-security-') ? applyGate(state, input) : Promise.resolve(undefined);
export const applySeoOnGatePass = (state: ControlApiState, input: { workPackageId: string; gateId: string; rationale: string }) => input.gateId.startsWith('gate-seo-') ? applyGate(state, input) : Promise.resolve(undefined);
export const applyQaOnGatePass = (state: ControlApiState, input: { workPackageId: string; gateId: string; rationale: string }) => input.gateId.startsWith('gate-qa-') ? applyGate(state, input) : Promise.resolve(undefined);
export const applyEngOnGatePass = (state: ControlApiState, input: { workPackageId: string; gateId: string; rationale: string; approver: string }) => input.gateId.startsWith('gate-eng-') ? applyGate(state, input) : Promise.resolve(undefined);
export async function listRecentAudit(state: ControlApiState): Promise<AuditContract[]> { return state.auditService.query(); }
