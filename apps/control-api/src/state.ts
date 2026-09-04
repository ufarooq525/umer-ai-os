import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuditContract } from '@umer/contracts';
import type { CeoCommandService, ControlPlaneService } from '@umer/control-plane';
import type { AuditService } from '@umer/audit';
import type { TrustRuntime } from '@umer/trust';
import type { AgentRegistryStore, AgentRunReadModelStore, AgentSnapshot } from '@umer/observability';
import type { OpportunityPersistence } from '@umer/opportunity-intelligence';
import type { ArtifactStore } from '@umer/artifacts';
import {
  type BusEvent,
  type BusEventSource,
  type EventBus,
  type QaRequestedPayload,
} from '@umer/event-bus';
import type { ProjectStore } from './project-store.js';
import type { TaskStore } from './task-store.js';
import type { AgentControlStore } from './agent-control-store.js';
import {
  applyEngToProject,
  applyQaToProject,
  applySeoToProject,
  applySecurityToProject,
  applyPerfToProject,
  applyUxToProject,
  createProjectRegistry,
  decideEngGate,
  decideSecurityGateByCategory,
  decidePerfGateByCategory,
  hasElevatedSecurityFindings,
  hasElevatedPerfFindings,
  planIntakeForControl,
  type EngApplyResult,
  type IntakeInstruction,
  type IntakePlan,
  type CodeProducer,
  type ProjectRegistry,
  type ResolvedProject,
  type QaApplyResult,
  type SeoApplyResult,
  type SecurityApplyResult,
  type PerfApplyResult,
  type UxApplyResult,
} from '@umer/registry';

export type WorkPackageSummary = {
  workPackageId: string;
  execId: string;
  status: string;
  specialistId: string;
  stage: string;
  artifactId?: string;
  projectId?: string;
};

export type IntakeTrigger = {
  eventId: string;
  correlationId: string;
  source: BusEventSource;
};

export type IntakeRecord = {
  intakeId: string;
  plan: IntakePlan;
  createdAt: string;
  status: 'planned' | 'approved' | 'rejected';
  /** Present when this intake was driven through the shim bus (QA v1). */
  trigger?: IntakeTrigger;
  applyResult?:
    | SeoApplyResult
    | QaApplyResult
    | EngApplyResult
    | SecurityApplyResult
    | PerfApplyResult
    | UxApplyResult;
};

export type ControlApiState = {
  controlPlane: ControlPlaneService;
  auditService: AuditService;
  workPackages: WorkPackageSummary[];
  projectRegistry: ProjectRegistry;
  intakes: IntakeRecord[];
  /** In-process shim bus — QA requests publish here; Fabric remains future substrate. */
  bus: EventBus;
  /** Authors eng change-sets when intake did not supply one. */
  codeProducer?: CodeProducer;
  /** Internal: QA shim subscribed once. */
  qaBusShimRegistered?: boolean;
  /**
   * Agent Run read model (Runtime Observability domain) — control-api is the
   * blueprint's designated read-model owner. Always present and safe to read
   * even when no live Message Fabric subscription is wired (see main.ts):
   * it just stays empty. Optional only so hand-built ControlApiState literals
   * in existing tests don't need to set it.
   */
  agentRunReadModel?: AgentRunReadModelStore;
  /** Agent Registry (Runtime Observability domain) — see agentRunReadModel doc above; same optionality reasoning. */
  agentRegistry?: AgentRegistryStore;
  /** Work Management Project store — see project-store.ts. Optional for the same test-compatibility reason. */
  projectStore?: ProjectStore;
  /** Work Management Task store — see task-store.ts. */
  taskStore?: TaskStore;
  /** Agent control-state store (CEO Command Plane) — see agent-control-store.ts. */
  agentControlStore?: AgentControlStore;
  /**
   * Opportunity Intelligence access (packages/opportunity-intelligence).
   * In-memory by default; main.ts swaps in the real MySQL-backed adapter when
   * reachable, same fail-open pattern as agentRunReadModel's NATS wiring.
   * Opportunity Intelligence remains the sole owner of this schema/logic —
   * control-api never writes here ad hoc. The one sanctioned write path is
   * the CEO Command Plane's Opportunity command handlers (SelectOpportunity /
   * RejectOpportunity / CreateProjectFromOpportunity), which call
   * `saveOpportunity` through this same instance via `commandService`.
   */
  opportunityReader?: OpportunityPersistence;
  /** Trust Runtime (@umer/trust) — authorizes CEO Command Plane commands. */
  trustRuntime?: TrustRuntime;
  /** CEO Command & Decision Plane dispatcher — see @umer/control-plane's commands module. */
  commandService?: CeoCommandService;
  /**
   * Artifact Runtime store (@umer/artifacts) — read-only from control-api's
   * perspective. Artifacts are sealed by whichever ArtifactEngine instance
   * the agent worker/runtime uses (see packages/agent-runtime); this store
   * is control-api's own in-memory instance, so it starts empty until wired
   * to the same engine a live worker uses. Optional for the same
   * test-compatibility reason as the stores above.
   */
  artifactStore?: ArtifactStore;
};

export function resolveCatalogPath(): string {
  const fromEnv = process.env.UMER_PROJECTS_CATALOG;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
  return join(repoRoot, 'projects', 'catalog.json');
}

export async function loadProjectRegistry(): Promise<ProjectRegistry> {
  return createProjectRegistry({ catalogPath: resolveCatalogPath() });
}

export async function seedDemoState(state: ControlApiState): Promise<void> {
  state.workPackages.length = 0;
  state.workPackages.push({
    workPackageId: 'wp-e2e-1',
    execId: 'EXEC-001',
    status: 'AwaitingReview',
    specialistId: 'eng.app-delivery',
    stage: 'Development',
    artifactId: 'art-wp-e2e-1-1',
    projectId: 'nitrotickets-new',
  });

  await state.controlPlane.requestGateReview(
    {
      gateId: 'gate-dev-qa',
      execId: 'EXEC-001',
      workPackageId: 'wp-e2e-1',
      artifactId: 'art-wp-e2e-1-1',
      stageFrom: 'Development',
      stageTo: 'QA',
      requiredApprovers: ['human.approver'],
      humanRequired: true,
    },
    'corr-demo-seed',
  );

  await state.auditService.append(
    {
      action: 'agent.run.completed',
      actor: 'eng.app-delivery',
      resourceType: 'work_package',
      resourceId: 'wp-e2e-1',
      outcome: 'success',
      correlationId: 'corr-e2e-flow',
      detail: {
        demo: true,
        projectId: 'nitrotickets-new',
        note: 'Bootstrap sample — not a real intake',
      },
    },
    'corr-e2e-flow',
  );
  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'eng.app-delivery',
      resourceType: 'artifact',
      resourceId: 'art-wp-e2e-1-1',
      outcome: 'success',
      correlationId: 'corr-e2e-flow',
      detail: {
        demo: true,
        projectId: 'nitrotickets-new',
        note: 'Bootstrap sample — not a real intake',
      },
    },
    'corr-e2e-flow',
  );
}

export function listProjects(state: ControlApiState): ResolvedProject[] {
  return state.projectRegistry.list();
}

/**
 * Resolves an Agent snapshot's `currentProjectId` by joining its first
 * current Task id against the Task store — computed at read time, never
 * stored on the runtime read-model itself (Phase D: "don't put
 * business-domain data into the runtime reducer unnecessarily").
 */
export async function enrichAgentWithProject(
  state: ControlApiState,
  agent: AgentSnapshot,
): Promise<AgentSnapshot & { currentProjectId?: string }> {
  const firstTaskId = agent.currentTaskIds?.[0];
  if (!firstTaskId || !state.taskStore) {
    return agent;
  }
  const task = await state.taskStore.get(firstTaskId);
  return task ? { ...agent, currentProjectId: task.projectId } : agent;
}

/**
 * Resolves an Agent snapshot's CEO Command Plane control state (paused via
 * PauseAgent, or the default 'active') — computed at read time from
 * agentControlStore, same pattern as enrichAgentWithProject above. This is
 * how PauseAgent/ResumeAgent become observable on GET /v1/agents(/:id)
 * without duplicating state onto the runtime-events-derived AgentSnapshot.
 */
export async function enrichAgentWithControlState(
  state: ControlApiState,
  agent: AgentSnapshot,
): Promise<AgentSnapshot & { controlState: 'active' | 'paused'; controlReason?: string }> {
  const record = await state.agentControlStore?.get(agent.agentId);
  return {
    ...agent,
    controlState: record?.controlState ?? 'active',
    controlReason: record?.reason,
  };
}

/**
 * Register the QA shim once per control-api state.
 * Subscriber executes the same gate path as today's direct QA intake.
 */
export function registerQaBusShim(state: ControlApiState): void {
  if (state.qaBusShimRegistered) return;
  state.bus.subscribe('specialist.qa.requested', async (event) => {
    const record = await executeQaIntake(state, event as BusEvent<'specialist.qa.requested'>);
    return { intakeRecord: record };
  });
  state.qaBusShimRegistered = true;
}

/**
 * Watchdog / system entry: publish a QA request through the bus.
 * Human `/v1/intake` type=qa also uses this path via {@link submitIntake}.
 */
export async function publishQaViaBus(
  state: ControlApiState,
  input: {
    projectId: string;
    goal: string;
    doneWhen?: string;
    constraints?: string[];
    source: BusEventSource;
    correlationId?: string;
  },
): Promise<IntakeRecord> {
  const result = await state.bus.publishNew({
    type: 'specialist.qa.requested',
    projectId: input.projectId,
    source: input.source,
    correlationId: input.correlationId,
    payload: {
      goal: input.goal,
      doneWhen: input.doneWhen,
      constraints: input.constraints,
    } satisfies QaRequestedPayload,
  });

  if (result.handlerCount < 1) {
    throw new Error('No subscriber for specialist.qa.requested — QA bus shim not registered');
  }

  const first = result.results[0] as { intakeRecord?: IntakeRecord } | undefined;
  if (!first?.intakeRecord) {
    throw new Error('QA bus shim returned no intake record');
  }
  return first.intakeRecord;
}

/**
 * QA executor used by the bus shim. Same plan → work package → gate-qa-* behavior
 * as the pre-bus direct path; carries source onto the intake + audit detail.
 */
export async function executeQaIntake(
  state: ControlApiState,
  event: BusEvent<'specialist.qa.requested'>,
): Promise<IntakeRecord> {
  const instruction: IntakeInstruction = {
    projectId: event.projectId,
    type: 'qa',
    goal: event.payload.goal,
    doneWhen: event.payload.doneWhen,
    constraints: event.payload.constraints,
  };

  const plan = await planIntakeForControl(state.projectRegistry, instruction);
  const intakeId = `intake-${Date.now()}`;
  const record: IntakeRecord = {
    intakeId,
    plan,
    createdAt: new Date().toISOString(),
    status: 'planned',
    trigger: {
      eventId: event.eventId,
      correlationId: event.correlationId,
      source: event.source,
    },
  };
  state.intakes.unshift(record);

  const execId = 'EXEC-9200';
  const specialistId = 'qa.verify';
  const stage = 'QA Verify';
  const gateId = `gate-qa-${plan.projectId}`;
  const workPackageId = `wp-${intakeId}`;

  state.workPackages.unshift({
    workPackageId,
    execId,
    status: 'AwaitingReview',
    specialistId,
    stage,
    projectId: plan.projectId,
  });

  await state.controlPlane.requestGateReview(
    {
      gateId,
      execId,
      workPackageId,
      stageFrom: stage,
      stageTo: 'Dispatch',
      requiredApprovers: ['human.approver'],
      humanRequired: true,
    },
    event.correlationId,
  );

  await state.auditService.append(
    {
      action: 'control.approval.requested',
      actor: specialistId,
      resourceType: 'project',
      resourceId: plan.projectId,
      outcome: 'success',
      correlationId: event.correlationId,
      detail: {
        intakeId,
        type: plan.type,
        goal: plan.goal,
        qaItemCount: plan.qaAudit?.items.length ?? 0,
        triggerEventId: event.eventId,
        source: event.source,
      },
    },
    event.correlationId,
  );

  return record;
}

export async function submitIntake(
  state: ControlApiState,
  instruction: IntakeInstruction,
): Promise<IntakeRecord> {
  // QA goes through the shim bus so human intake and watchdogs share one executor.
  if (instruction.type === 'qa') {
    return publishQaViaBus(state, {
      projectId: instruction.projectId,
      goal: instruction.goal,
      doneWhen: instruction.doneWhen,
      constraints: instruction.constraints,
      source: {
        kind: 'human.intake',
        actorId: 'human.operator',
        channel: 'control-api',
      },
    });
  }

  // planIntakeForControl: eng / seo / security / perf / ux async; else sync.
  // SEO/security/perf/ux never auto-apply (autoApplyEng is eng-only).
  const plan = await planIntakeForControl(state.projectRegistry, instruction, {
    codeProducer: state.codeProducer,
  });
  const intakeId = `intake-${Date.now()}`;
  const record: IntakeRecord = {
    intakeId,
    plan,
    createdAt: new Date().toISOString(),
    status: 'planned',
  };
  state.intakes.unshift(record);

  const isSeo = instruction.type === 'seo';
  const isSecurity = instruction.type === 'security' && Boolean(plan.securityAudit);
  const isPerf = instruction.type === 'perf' && Boolean(plan.perfAudit);
  const isUx = instruction.type === 'ux' && Boolean(plan.uxAudit);
  const isEng =
    (instruction.type === 'feature' || instruction.type === 'bug') && Boolean(plan.engDelivery);

  if (isUx && plan.uxAudit) {
    const execId = 'EXEC-9600';
    const specialistId = 'ux.design';
    const stage = 'UX Audit';
    const workPackageId = `wp-${intakeId}`;
    const gateId = `gate-ux-${plan.projectId}`;
    const items = plan.uxAudit.items;
    const p0 = items.filter((i) => i.priority === 'P0').length;
    const p1 = items.filter((i) => i.priority === 'P1').length;
    const p2 = items.filter((i) => i.priority === 'P2').length;

    state.workPackages.unshift({
      workPackageId,
      execId,
      status: 'AwaitingReview',
      specialistId,
      stage,
      projectId: plan.projectId,
    });

    await state.controlPlane.requestGateReview(
      {
        gateId,
        execId,
        workPackageId,
        stageFrom: stage,
        stageTo: 'Dispatch',
        requiredApprovers: ['human.approver'],
        humanRequired: true,
      },
      `corr-${intakeId}`,
    );

    await state.auditService.append(
      {
        action: 'control.approval.requested',
        actor: specialistId,
        resourceType: 'project',
        resourceId: plan.projectId,
        outcome: 'success',
        correlationId: `corr-${intakeId}`,
        detail: {
          intakeId,
          type: plan.type,
          goal: plan.goal,
          uxRunId: plan.uxAudit.runId,
          uxItemCount: items.length,
          uxPriorityCounts: { P0: p0, P1: p1, P2: p2 },
          humanRequired: true,
          proposedDiff: plan.uxAudit.proposedDiff,
        },
      },
      `corr-${intakeId}`,
    );

    return record;
  }

  if (isPerf && plan.perfAudit) {
    const project = state.projectRegistry.requireActive(plan.projectId);
    const findings = plan.perfAudit.findings;
    const execId = 'EXEC-9500';
    const specialistId = 'perf.optimize';
    const stage = 'Perf Optimize';
    const workPackageId = `wp-${intakeId}`;
    const gateId = `gate-perf-${plan.projectId}`;

    // Severity BEFORE category — never consult category / autoApplyEng when elevated.
    let humanRequired: boolean;
    let gateReason: string;
    let forcedBySeverity: boolean;
    if (hasElevatedPerfFindings(findings)) {
      humanRequired = true;
      forcedBySeverity = true;
      gateReason =
        'critical/high performance findings force an explicit human gate (never skipped by category or autoApplyEng)';
    } else {
      const byCategory = decidePerfGateByCategory(project.category);
      humanRequired = byCategory.humanRequired;
      forcedBySeverity = false;
      gateReason = byCategory.reason;
    }

    // Perf never auto-applies — always create a gate (like security/SEO).
    state.workPackages.unshift({
      workPackageId,
      execId,
      status: 'AwaitingReview',
      specialistId,
      stage,
      projectId: plan.projectId,
    });

    await state.controlPlane.requestGateReview(
      {
        gateId,
        execId,
        workPackageId,
        stageFrom: stage,
        stageTo: 'Dispatch',
        requiredApprovers: ['human.approver'],
        humanRequired,
      },
      `corr-${intakeId}`,
    );

    await state.auditService.append(
      {
        action: 'control.approval.requested',
        actor: specialistId,
        resourceType: 'project',
        resourceId: plan.projectId,
        outcome: 'success',
        correlationId: `corr-${intakeId}`,
        detail: {
          intakeId,
          type: plan.type,
          goal: plan.goal,
          perfRunId: plan.perfAudit.runId,
          targetUrl: plan.perfAudit.targetUrl,
          findingCount: findings.length,
          severityCounts: plan.perfAudit.severityCounts,
          metrics: plan.perfAudit.metrics,
          forcesGate: plan.perfAudit.forcesGate,
          forcedBySeverity,
          humanRequired,
          gateDecision: gateReason,
        },
      },
      `corr-${intakeId}`,
    );

    return record;
  }

  if (isSecurity && plan.securityAudit) {
    const project = state.projectRegistry.requireActive(plan.projectId);
    const findings = plan.securityAudit.findings;
    const execId = 'EXEC-9400';
    const specialistId = 'security.review';
    const stage = 'Security Review';
    const workPackageId = `wp-${intakeId}`;
    const gateId = `gate-security-${plan.projectId}`;

    // Severity BEFORE category — never consult category / autoApplyEng when elevated.
    let humanRequired: boolean;
    let gateReason: string;
    let forcedBySeverity: boolean;
    if (hasElevatedSecurityFindings(findings)) {
      humanRequired = true;
      forcedBySeverity = true;
      gateReason =
        'critical/high security findings force an explicit human gate (never skipped by category or autoApplyEng)';
    } else {
      const byCategory = decideSecurityGateByCategory(project.category);
      humanRequired = byCategory.humanRequired;
      forcedBySeverity = false;
      gateReason = byCategory.reason;
    }

    // Security never auto-applies — always create a gate (like SEO).
    state.workPackages.unshift({
      workPackageId,
      execId,
      status: 'AwaitingReview',
      specialistId,
      stage,
      projectId: plan.projectId,
    });

    await state.controlPlane.requestGateReview(
      {
        gateId,
        execId,
        workPackageId,
        stageFrom: stage,
        stageTo: 'Dispatch',
        requiredApprovers: ['human.approver'],
        humanRequired,
      },
      `corr-${intakeId}`,
    );

    await state.auditService.append(
      {
        action: 'control.approval.requested',
        actor: specialistId,
        resourceType: 'project',
        resourceId: plan.projectId,
        outcome: 'success',
        correlationId: `corr-${intakeId}`,
        detail: {
          intakeId,
          type: plan.type,
          goal: plan.goal,
          securityRunId: plan.securityAudit.runId,
          findingCount: findings.length,
          severityCounts: plan.securityAudit.severityCounts,
          forcesGate: plan.securityAudit.forcesGate,
          forcedBySeverity,
          humanRequired,
          gateDecision: gateReason,
        },
      },
      `corr-${intakeId}`,
    );

    return record;
  }

  if (isEng && plan.engDelivery) {
    const project = state.projectRegistry.requireActive(plan.projectId);
    const gateDecision = decideEngGate({
      category: project.category,
      autoApplyEng: project.autoApplyEng === true,
      package: plan.engDelivery,
    });

    const execId = 'EXEC-9300';
    const specialistId = 'eng.app-delivery';
    const stage = 'Eng Delivery';
    const workPackageId = `wp-${intakeId}`;

    if (gateDecision.autoApply) {
      // Apply first — only then mark Accepted / approved (do not pre-claim success).
      const applyResult = await applyEngToProject({
        project,
        report: plan.engDelivery,
        approval: {
          kind: 'auto',
          reason: gateDecision.reason,
        },
      });

      state.workPackages.unshift({
        workPackageId,
        execId,
        status: 'Accepted',
        specialistId,
        stage,
        projectId: plan.projectId,
      });
      record.status = 'approved';
      record.applyResult = applyResult;

      await state.auditService.append(
        {
          action: 'artifact.sealed',
          actor: specialistId,
          resourceType: 'project',
          resourceId: plan.projectId,
          outcome: 'success',
          correlationId: `corr-${intakeId}`,
          detail: {
            intakeId,
            type: plan.type,
            goal: plan.goal,
            autoApply: true,
            approval: { kind: 'auto', reason: gateDecision.reason },
            gateDecision: gateDecision.reason,
            summary: applyResult.summary,
            evidenceDir: applyResult.evidenceDir,
            files: applyResult.files.map((f) => f.path),
          },
        },
        `corr-${intakeId}`,
      );

      return record;
    }

    const gateId = `gate-eng-${plan.projectId}`;
    state.workPackages.unshift({
      workPackageId,
      execId,
      status: 'AwaitingReview',
      specialistId,
      stage,
      projectId: plan.projectId,
    });

    await state.controlPlane.requestGateReview(
      {
        gateId,
        execId,
        workPackageId,
        stageFrom: stage,
        stageTo: 'Dispatch',
        requiredApprovers: ['human.approver'],
        // client-task / ineligible digital-product / seo-project: always human.
        humanRequired: true,
      },
      `corr-${intakeId}`,
    );

    await state.auditService.append(
      {
        action: 'control.approval.requested',
        actor: specialistId,
        resourceType: 'project',
        resourceId: plan.projectId,
        outcome: 'success',
        correlationId: `corr-${intakeId}`,
        detail: {
          intakeId,
          type: plan.type,
          goal: plan.goal,
          engRunId: plan.engDelivery.runId,
          engStatus: plan.engDelivery.status,
          humanRequired: true,
          gateDecision: gateDecision.reason,
          codeProducer: plan.engDelivery.production?.producerId,
          codeProducerStatus: plan.engDelivery.production?.status,
          routingNote: plan.routing?.note,
        },
      },
      `corr-${intakeId}`,
    );

    return record;
  }

  const execId = isSeo ? 'EXEC-9100' : 'EXEC-9000';
  const specialistId = isSeo ? 'seo.audit' : 'pm.intake';
  const stage = isSeo ? 'SEO Audit' : 'Intake';
  const gateId = isSeo ? `gate-seo-${plan.projectId}` : `gate-intake-${plan.projectId}`;

  state.workPackages.unshift({
    workPackageId: `wp-${intakeId}`,
    execId,
    status: 'AwaitingReview',
    specialistId,
    stage,
    projectId: plan.projectId,
  });

  await state.controlPlane.requestGateReview(
    {
      gateId,
      execId,
      workPackageId: `wp-${intakeId}`,
      stageFrom: stage,
      stageTo: 'Dispatch',
      requiredApprovers: ['human.approver'],
      humanRequired: true,
    },
    `corr-${intakeId}`,
  );

  await state.auditService.append(
    {
      action: 'control.approval.requested',
      actor: specialistId,
      resourceType: 'project',
      resourceId: plan.projectId,
      outcome: 'success',
      correlationId: `corr-${intakeId}`,
      detail: {
        intakeId,
        type: plan.type,
        goal: plan.goal,
        seoItemCount: plan.seoAudit?.items.length ?? 0,
      },
    },
    `corr-${intakeId}`,
  );

  return record;
}

export async function applyPerfOnGatePass(
  state: ControlApiState,
  input: {
    workPackageId: string;
    gateId: string;
    rationale: string;
  },
): Promise<PerfApplyResult | undefined> {
  if (!input.gateId.startsWith('gate-perf-')) {
    return undefined;
  }
  const intake = state.intakes.find((item) => `wp-${item.intakeId}` === input.workPackageId);
  if (!intake?.plan.perfAudit) {
    return undefined;
  }
  const project = state.projectRegistry.requireActive(intake.plan.projectId);
  const applyResult = await applyPerfToProject({
    project,
    report: intake.plan.perfAudit,
    rationale: input.rationale,
  });
  intake.status = 'approved';
  intake.applyResult = applyResult;

  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'perf.optimize',
      resourceType: 'project',
      resourceId: project.projectId,
      outcome: 'success',
      correlationId: `corr-apply-${intake.intakeId}`,
      detail: {
        intakeId: intake.intakeId,
        summary: applyResult.summary,
        evidenceDir: applyResult.evidenceDir,
        files: applyResult.files.map((f) => f.path),
        findingCount: applyResult.findingCount,
        forcesGate: applyResult.forcesGate,
      },
    },
    `corr-apply-${intake.intakeId}`,
  );

  return applyResult;
}

export async function applyUxOnGatePass(
  state: ControlApiState,
  input: {
    workPackageId: string;
    gateId: string;
    rationale: string;
  },
): Promise<UxApplyResult | undefined> {
  if (!input.gateId.startsWith('gate-ux-')) {
    return undefined;
  }
  const intake = state.intakes.find((item) => `wp-${item.intakeId}` === input.workPackageId);
  if (!intake?.plan.uxAudit) {
    return undefined;
  }
  const project = state.projectRegistry.requireActive(intake.plan.projectId);
  const applyResult = await applyUxToProject({
    project,
    report: intake.plan.uxAudit,
    rationale: input.rationale,
  });
  intake.status = 'approved';
  intake.applyResult = applyResult;

  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'ux.design',
      resourceType: 'project',
      resourceId: project.projectId,
      outcome: 'success',
      correlationId: `corr-apply-${intake.intakeId}`,
      detail: {
        intakeId: intake.intakeId,
        summary: applyResult.summary,
        evidenceDir: applyResult.evidenceDir,
        files: applyResult.files.map((f) => f.path),
        itemCount: applyResult.itemCount,
      },
    },
    `corr-apply-${intake.intakeId}`,
  );

  return applyResult;
}

export async function applySecurityOnGatePass(
  state: ControlApiState,
  input: {
    workPackageId: string;
    gateId: string;
    rationale: string;
  },
): Promise<SecurityApplyResult | undefined> {
  if (!input.gateId.startsWith('gate-security-')) {
    return undefined;
  }
  const intake = state.intakes.find((item) => `wp-${item.intakeId}` === input.workPackageId);
  if (!intake?.plan.securityAudit) {
    return undefined;
  }
  const project = state.projectRegistry.requireActive(intake.plan.projectId);
  const applyResult = await applySecurityToProject({
    project,
    report: intake.plan.securityAudit,
    rationale: input.rationale,
  });
  intake.status = 'approved';
  intake.applyResult = applyResult;

  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'security.review',
      resourceType: 'project',
      resourceId: project.projectId,
      outcome: 'success',
      correlationId: `corr-apply-${intake.intakeId}`,
      detail: {
        intakeId: intake.intakeId,
        summary: applyResult.summary,
        evidenceDir: applyResult.evidenceDir,
        files: applyResult.files.map((f) => f.path),
        findingCount: applyResult.findingCount,
        forcesGate: applyResult.forcesGate,
      },
    },
    `corr-apply-${intake.intakeId}`,
  );

  return applyResult;
}

export async function applySeoOnGatePass(
  state: ControlApiState,
  input: {
    workPackageId: string;
    gateId: string;
    rationale: string;
  },
): Promise<SeoApplyResult | undefined> {
  if (!input.gateId.startsWith('gate-seo-')) {
    return undefined;
  }
  const intake = state.intakes.find((item) => `wp-${item.intakeId}` === input.workPackageId);
  if (!intake?.plan.seoAudit) {
    return undefined;
  }
  const project = state.projectRegistry.requireActive(intake.plan.projectId);
  const applyResult = await applySeoToProject({
    project,
    audit: intake.plan.seoAudit,
    rationale: input.rationale,
  });
  intake.status = 'approved';
  intake.applyResult = applyResult;

  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'seo.audit',
      resourceType: 'project',
      resourceId: project.projectId,
      outcome: 'success',
      correlationId: `corr-apply-${intake.intakeId}`,
      detail: {
        intakeId: intake.intakeId,
        summary: applyResult.summary,
        files: applyResult.files.map((f) => f.path),
        stillManual: applyResult.stillManual.length,
      },
    },
    `corr-apply-${intake.intakeId}`,
  );

  return applyResult;
}

export async function applyQaOnGatePass(
  state: ControlApiState,
  input: {
    workPackageId: string;
    gateId: string;
    rationale: string;
  },
): Promise<QaApplyResult | undefined> {
  if (!input.gateId.startsWith('gate-qa-')) {
    return undefined;
  }
  const intake = state.intakes.find((item) => `wp-${item.intakeId}` === input.workPackageId);
  if (!intake?.plan.qaAudit) {
    return undefined;
  }
  const project = state.projectRegistry.requireActive(intake.plan.projectId);
  const applyResult = await applyQaToProject({
    project,
    audit: intake.plan.qaAudit,
    rationale: input.rationale,
  });
  intake.status = 'approved';
  intake.applyResult = applyResult;

  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'qa.verify',
      resourceType: 'project',
      resourceId: project.projectId,
      outcome: 'success',
      correlationId: `corr-apply-${intake.intakeId}`,
      detail: {
        intakeId: intake.intakeId,
        summary: applyResult.summary,
        files: applyResult.files.map((f) => f.path),
        stillManual: applyResult.stillManual.length,
        recommendedCommand: applyResult.recommendedCommand,
      },
    },
    `corr-apply-${intake.intakeId}`,
  );

  return applyResult;
}

export async function applyEngOnGatePass(
  state: ControlApiState,
  input: {
    workPackageId: string;
    gateId: string;
    rationale: string;
    approver: string;
  },
): Promise<EngApplyResult | undefined> {
  if (!input.gateId.startsWith('gate-eng-')) {
    return undefined;
  }
  const intake = state.intakes.find((item) => `wp-${item.intakeId}` === input.workPackageId);
  if (!intake?.plan.engDelivery) {
    return undefined;
  }
  const project = state.projectRegistry.requireActive(intake.plan.projectId);
  const applyResult = await applyEngToProject({
    project,
    report: intake.plan.engDelivery,
    approval: {
      kind: 'human-gate',
      gateId: input.gateId,
      approver: input.approver,
      rationale: input.rationale,
    },
  });
  intake.status = 'approved';
  intake.applyResult = applyResult;

  await state.auditService.append(
    {
      action: 'artifact.sealed',
      actor: 'eng.app-delivery',
      resourceType: 'project',
      resourceId: project.projectId,
      outcome: 'success',
      correlationId: `corr-apply-${intake.intakeId}`,
      detail: {
        intakeId: intake.intakeId,
        summary: applyResult.summary,
        evidenceDir: applyResult.evidenceDir,
        files: applyResult.files.map((f) => f.path),
        changedFiles: applyResult.changedFiles,
        approval: {
          kind: 'human-gate',
          gateId: input.gateId,
          approver: input.approver,
        },
      },
    },
    `corr-apply-${intake.intakeId}`,
  );

  return applyResult;
}

export async function listRecentAudit(state: ControlApiState): Promise<AuditContract[]> {
  return state.auditService.query();
}
