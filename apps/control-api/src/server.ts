import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { healthCheck } from '@umer/kernel';
import { loadEnv } from '@umer/config';
import {
  createCeoCommandService,
  createControlPlaneService,
  CommandError,
  InMemorySpecialistControlStore,
  type ControlPlaneService,
} from '@umer/control-plane';
import { createAuditService } from '@umer/audit';
import { createTrustRuntime } from '@umer/trust';
import { createEventBus } from '@umer/event-bus';
import { createCommandEnvelope, SUBJECTS } from '@umer/message-fabric';
import {
  applyRequirementDecomposition,
  applyStandaloneAuditNode,
  InMemoryWorkGraphStore,
  ORCHESTRATION_COMMANDS,
  PersistentWorkGraph,
  type StandaloneAuditNodeType,
} from '@umer/orchestration';
import {
  SCHEMA_VERSION,
  type ActorKind,
  type CeoCommandEnvelope,
  type CeoCommandName,
  type CommandTarget,
  type ProjectStatus,
  type TaskStatus,
  type RequirementStatus,
  type RequirementContract,
  type ContactVerificationStatus,
  type SalesStage,
  type CustomerId,
  type CaseId,
  type ProjectId,
  CustomerIdSchema,
  CaseIdSchema,
  ProjectIdSchema,
  DealIdSchema,
  ContactIdSchema,
  type DeliveryOutcomeStatus,
  type SupportCaseSeverity,
  type FeedbackSentiment,
  type FeedbackCategory,
  type LearningCategory,
  type LearningSourceType,
  type ClientSignoff,
  type DeliveryKpiResult,
  type FinancialCosts,
} from '@umer/contracts';
import {
  createLogger,
  InMemoryAgentRegistryStore,
  InMemoryAgentRunReadModelStore,
} from '@umer/observability';
import {
  AutonomousCompanyLoop,
  type RunCycleInput,
  type OpportunityPersistence,
  CommercialPipelineEngine,
  CustomerSuccessEngine,
  InMemoryOpportunityPersistence,
  buildBusinessIdentity,
} from '@umer/opportunity-intelligence';
import type { DiscoveryCandidateRecord } from '@umer/contracts';
import { InMemoryArtifactStore } from '@umer/artifacts';
import { routeIntakeGoal, type IntakeInstruction, DeploymentEngine } from '@umer/registry';
import type { DeploymentStrategy, Environment, RollbackPlan } from '@umer/contracts';
import { InMemoryProjectStore } from './project-store.js';
import { InMemoryTaskStore } from './task-store.js';
import { RequirementAlreadyDecidedError } from './requirement-store.js';
import { InMemoryAgentControlStore } from './agent-control-store.js';
import {
  type ControlApiState,
  applyEngOnGatePass,
  applyQaOnGatePass,
  applySecurityOnGatePass,
  applyPerfOnGatePass,
  applyUxOnGatePass,
  applySeoOnGatePass,
  enrichAgentWithControlState,
  getSpecialistControlState,
  enrichAgentWithProject,
  listProjects,
  listRecentAudit,
  loadProjectRegistry,
  registerQaBusShim,
  seedDemoState,
  submitIntake,
} from './state.js';
import { runQaNightlyWatchdog } from './qa-nightly-watchdog.js';
import { filterWatchdogPendingFindings } from './watchdog-findings.js';
import { buildGateReview } from './gate-review.js';
import { listCodeProducers, resolveCodeProducer } from './code-producer.js';
import { buildCompanyGraph, type GraphFilterOptions, type GraphNodeType } from './company-graph-projection.js';

const SERVICE_NAME = 'control-api';
const log = createLogger(SERVICE_NAME);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

export type ControlApiStateOptions = {
  deploymentEngine?: DeploymentEngine;
};

export async function createControlApiState(options?: ControlApiStateOptions): Promise<ControlApiState> {
  const { producer, fallbackReason } = resolveCodeProducer();
  if (fallbackReason) {
    // Surface a misconfigured producer instead of silently writing nothing forever.
    console.warn(`[control-api] ${fallbackReason}`);
  }
  const env = loadEnv();
  const auditService = createAuditService();
  const trustRuntime = createTrustRuntime();
  // CEO Command Plane authority: only this principal (human by default) may
  // execute ceo.command.* actions until a real auth layer exists (@umer/auth
  // is a skeleton — see COMPANY_OPERATING_MODEL milestone notes). Every other
  // principal (agents included) is denied by TrustRuntime's default-deny.
  await trustRuntime.registerGrant({
    grantId: `grant-ceo-${randomUUID()}`,
    principalId: env.CEO_PRINCIPAL_ID,
    action: '*',
    resourceType: 'command',
    effect: 'allow',
  });

  const state: ControlApiState = {
    workPackages: [],
    intakes: [],
    auditService,
    projectRegistry: await loadProjectRegistry(),
    controlPlane: null as unknown as ControlPlaneService,
    bus: createEventBus(),
    codeProducer: producer,
    agentRunReadModel: new InMemoryAgentRunReadModelStore(),
    agentRegistry: new InMemoryAgentRegistryStore(),
    projectStore: new InMemoryProjectStore(),
    taskStore: new InMemoryTaskStore(),
    agentControlStore: new InMemoryAgentControlStore(),
    specialistControlStore: new InMemorySpecialistControlStore(),
    opportunityReader: new InMemoryOpportunityPersistence(),
    artifactStore: new InMemoryArtifactStore(),
    workGraphStore: new InMemoryWorkGraphStore(),
    deploymentEngine: options?.deploymentEngine ?? new DeploymentEngine(),
    trustRuntime,
  };
  state.persistentWorkGraph = new PersistentWorkGraph(state.workGraphStore!);
  state.commandService = createCeoCommandService(
    {
      // Delegates through `state.opportunityReader` on every call rather than
      // capturing today's instance: main.ts's connectOpportunityReader() runs
      // AFTER createControlApiState() returns and best-effort swaps
      // state.opportunityReader from the in-memory default to the real
      // MySQL-backed adapter. Capturing the reference here would have frozen
      // Opportunity commands onto the pre-swap (empty) in-memory store even
      // once GET /v1/opportunities was reading real MySQL data.
      opportunities: {
        getOpportunity: (id) => state.opportunityReader!.getOpportunity(id),
        saveOpportunity: (opportunity) => state.opportunityReader!.saveOpportunity(opportunity),
      },
      // Same delegation reasoning as `opportunities` above: connectTaskProjectStores()
      // (main.ts) best-effort-swaps state.projectStore/state.taskStore to the
      // MySQL-backed adapters after this function returns. Capturing the
      // stores directly here would have frozen CreateProject/CreateTask/etc.
      // onto the pre-swap in-memory instances even once GET /v1/work-projects
      // and GET /v1/tasks were reading real MySQL data.
      projects: {
        get: (id) => state.projectStore!.get(id),
        create: (input, correlationId) => state.projectStore!.create(input, correlationId),
        list: (filter) => state.projectStore!.list(filter),
        updateStatus: (id, status, correlationId) => state.projectStore!.updateStatus(id, status, correlationId),
      },
      tasks: {
        get: (id) => state.taskStore!.get(id),
        create: (input, correlationId) => state.taskStore!.create(input, correlationId),
        assign: (taskId, agentId, correlationId) => state.taskStore!.assign(taskId, agentId, correlationId),
        reassign: (taskId, agentId, correlationId) => state.taskStore!.reassign(taskId, agentId, correlationId),
        updateStatus: (taskId, status, correlationId) => state.taskStore!.updateStatus(taskId, status, correlationId),
      },
      agentControl: state.agentControlStore!,
      // Same delegation reasoning as `opportunities`/`projects`/`tasks` above:
      // connectSpecialistControlStore() (main.ts) best-effort-swaps
      // state.specialistControlStore to the MySQL-backed store after this
      // function returns.
      specialistControl: {
        get: (specialistId) => state.specialistControlStore!.get(specialistId),
        suspend: (specialistId, reason, correlationId) => state.specialistControlStore!.suspend(specialistId, reason, correlationId),
        activate: (specialistId, correlationId) => state.specialistControlStore!.activate(specialistId, correlationId),
        list: () => state.specialistControlStore!.list(),
      },
    },
    { trust: trustRuntime, auditService },
  );
  state.commercialPipeline = new CommercialPipelineEngine({
    opportunities: {
      getOpportunity: (id) => state.opportunityReader!.getOpportunity(id),
      saveOpportunity: (opportunity) => state.opportunityReader!.saveOpportunity(opportunity),
    },
    projects: {
      create: (input, correlationId) => state.projectStore!.create(input, correlationId),
      get: (id) => state.projectStore!.get(id),
    },
  });
  state.customerSuccess = new CustomerSuccessEngine({
    projects: {
      get: (id) => state.projectStore!.get(id),
      list: () => state.projectStore!.list(),
    },
    opportunities: {
      get: (id) => state.opportunityReader!.getOpportunity(id),
    },
  });
  state.companyLoop = new AutonomousCompanyLoop({
    commercialPipeline: new Proxy({} as CommercialPipelineEngine, {
      get(_target, prop) {
        const pipeline = state.commercialPipeline;
        if (!pipeline) return undefined;
        const val = Reflect.get(pipeline, prop);
        return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(pipeline) : val;
      },
    }),
    customerSuccess: new Proxy({} as CustomerSuccessEngine, {
      get(_target, prop) {
        const cs = state.customerSuccess;
        if (!cs) return undefined;
        const val = Reflect.get(cs, prop);
        return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(cs) : val;
      },
    }),
    opportunityPersistence: new Proxy({} as OpportunityPersistence, {
      get(_target, prop) {
        const store = state.opportunityReader;
        if (!store) return undefined;
        const val = Reflect.get(store, prop);
        return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(store) : val;
      },
    }),
    projects: {
      create: (input, correlationId) => {
        if (!state.projectStore) throw new Error('Project store unavailable');
        return state.projectStore.create(input, correlationId);
      },
      get: (id) => state.projectStore ? state.projectStore.get(id) : Promise.resolve(undefined),
      list: () => state.projectStore ? state.projectStore.list() : Promise.resolve([]),
    },
    requirements: {
      create: async (input) => {
        if (!state.requirementStore) return undefined;
        return state.requirementStore.create({
          ...input,
          source: input.source ?? { kind: 'Opportunity', id: input.opportunityId ?? 'unknown', label: 'company-loop' },
        });
      },
      get: (id) => state.requirementStore ? state.requirementStore.get(id) : Promise.resolve(undefined),
      list: () => state.requirementStore ? state.requirementStore.list() : Promise.resolve([]),
    },
    deployments: {
      prepareRelease: (input) => {
        if (!state.deploymentEngine) throw new Error('Deployment engine unavailable');
        return state.deploymentEngine.prepareRelease({
          ...input,
          environment: input.environment ?? 'production',
          rollbackPlan: input.rollbackPlan ?? { strategy: 'helm', targetVersion: '0.9.0', steps: [], verificationCriteria: [] },
        });
      },
      executeDeployment: async (id, correlationId) => {
        if (!state.deploymentEngine) throw new Error('Deployment engine unavailable');
        await state.deploymentEngine.approveDeployment(id, 'human.approver');
        return state.deploymentEngine.executeDeployment({ deploymentId: id, executedBy: correlationId });
      },
      listDeployments: () => {
        if (!state.deploymentEngine) return [];
        const byId = (state.deploymentEngine as unknown as { deploymentsById?: Map<string, unknown> })?.deploymentsById;
        return byId ? Array.from(byId.values()) : [];
      },
      getProductionStatus: async () => {
        if (!state.deploymentEngine) return { status: 'offline' };
        const projects = await state.projectStore?.list();
        const first = projects?.[0]?.projectId ?? 'system-core';
        const status = state.deploymentEngine.getProductionStatus(first);
        return status ?? { status: 'healthy' };
      },
    },
    gates: {
      listPending: async () => {
        return state.workPackages
          .filter((wp) => wp.status === 'AwaitingReview')
          .map((wp) => ({
            gateId: `gate-${wp.workPackageId}`,
            stageFrom: wp.stage,
            stageTo: 'Dispatch',
            requiredApprovers: ['human.approver'],
          }));
      },
    },
    agents: {
      list: async () => {
        if (!state.agentRegistry) return [];
        const snapshots = await state.agentRegistry.list();
        return Promise.all(snapshots.map((ag) => enrichAgentWithProject(state, ag)));
      },
    },
    artifacts: {
      count: async () => {
        return state.artifactStore ? (await state.artifactStore.list()).length : 0;
      },
      list: async () => {
        if (!state.artifactStore) return [];
        const items = await state.artifactStore.list();
        return items.map((a) => ({ id: a.artifactId, type: a.artifactType, artifactType: a.artifactType }));
      },
      countByType: async (type: string) => {
        if (!state.artifactStore) return 0;
        const items = await state.artifactStore.list();
        return items.filter((a) => a.artifactType === type).length;
      },
    },
    specialists: {
      executeProductDefinition: async (input) => ({
        artifactId: `art-prod-${input.projectId}`,
        scope: `Autonomous delivery specification for ${input.projectId}`,
        functionalCriteriaCount: 5,
        nonFunctionalSLAs: ['99.9% uptime', '<200ms p95 latency'],
        verified: true,
      }),
      executeArchitectureUx: async (input) => ({
        architectureArtifactId: `art-arch-${input.projectId}`,
        uxArtifactId: `art-ux-${input.projectId}`,
        architectureReviewPassed: true,
        uxComponentDesignTokensValidated: true,
        dataModelApproved: true,
        verified: true,
      }),
      executeEngineeringDelivery: async (input) => ({
        artifactId: `art-code-${input.projectId}`,
        packagesCompiled: 1,
        testSuitesPassed: true,
        gitCommitSealed: true,
        diffSummary: 'Core services built and staged cleanly',
        verified: true,
      }),
      executeQaSecurityGates: async (input) => ({
        qaArtifactId: `art-qa-${input.projectId}`,
        securityArtifactId: `art-sec-${input.projectId}`,
        testPlanCompleted: true,
        criticalVulnerabilitiesFound: 0,
        regressionSuiteGreen: true,
        complianceStatus: 'cleared',
        verified: true,
      }),
    },
  });
  state.controlPlane = createControlPlaneService({
    workPackagesAwaitingReview: () =>
      state.workPackages.filter((wp) => wp.status === 'AwaitingReview').length,
    // Gives every gate-review lifecycle event (control.gate.wait,
    // control.approval.requested, ...) a durable, queryable audit trail entry
    // so a triggering bus event's provenance survives past in-memory gate state.
    events: {
      publish: async (name, correlationId, payload) => {
        await auditService.append(
          {
            action: name,
            actor: 'system.control-plane',
            resourceType: 'gate',
            resourceId: String(payload.gateId ?? payload.waitId ?? 'unknown'),
            outcome: 'success',
            correlationId,
            detail: payload,
          },
          correlationId,
        );
      },
    },
  });
  registerQaBusShim(state);
  return state;
}

export function createControlApiServer(state: ControlApiState) {
  return createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (path === '/health' && req.method === 'GET') {
      const body = await healthCheck(SERVICE_NAME);
      sendJson(res, 200, body);
      return;
    }

    if (path === '/v1/dashboard' && req.method === 'GET') {
      const summary = await state.controlPlane.dashboard();
      const pending = await state.controlPlane.listPending();
      const watchdogFindings = filterWatchdogPendingFindings({
        pendingGates: pending,
        intakes: state.intakes,
      });
      sendJson(res, 200, {
        ...summary,
        watchdogFindingsAwaitingReview: watchdogFindings.length,
        watchdogFindings,
      });
      return;
    }

    if (path === '/v1/watchdogs/qa-nightly/run' && req.method === 'POST') {
      try {
        const result = await runQaNightlyWatchdog(state);
        sendJson(res, 201, {
          projectId: result.projectId,
          tickId: result.tickId,
          scheduleId: result.scheduleId,
          intakeId: result.intake.intakeId,
          trigger: result.intake.trigger,
          gateId: `gate-qa-${result.projectId}`,
        });
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (path === '/v1/projects' && req.method === 'GET') {
      sendJson(res, 200, {
        projectsRoot: state.projectRegistry.getProjectsRoot(),
        projects: listProjects(state),
      });
      return;
    }

    if (path === '/v1/intake' && req.method === 'GET') {
      sendJson(res, 200, { intakes: state.intakes });
      return;
    }

    if (path === '/v1/intake' && req.method === 'POST') {
      const body = await readJsonBody<Partial<IntakeInstruction>>(req);
      try {
        const record = await submitIntake(state, body as IntakeInstruction);
        sendJson(res, 201, record);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    // Canonical Requirements: read model + CEO decision over records the
    // intake pipeline already persisted via persistRequirementFromIntake.
    // No write path here beyond decide() — requirements are only ever
    // created as a side effect of a real intake, never fabricated via this API.
    if (path === '/v1/requirements' && req.method === 'GET') {
      if (!state.requirementStore) {
        sendJson(res, 200, { requirements: [] });
        return;
      }
      const projectId = url.searchParams.get('projectId') ?? undefined;
      const requestId = url.searchParams.get('requestId') ?? undefined;
      const status = url.searchParams.get('status') ?? undefined;
      const requirements = await state.requirementStore.list({
        projectId,
        requestId,
        status: status as RequirementStatus | undefined,
      });
      sendJson(res, 200, { requirements });
      return;
    }

    const requirementGetMatch = path.match(/^\/v1\/requirements\/([^/]+)$/);
    if (requirementGetMatch && req.method === 'GET') {
      const requirementId = decodeURIComponent(requirementGetMatch[1]!);
      const requirement = await state.requirementStore?.get(requirementId);
      if (!requirement) {
        sendJson(res, 404, { error: `requirement ${requirementId} not found` });
        return;
      }
      sendJson(res, 200, requirement);
      return;
    }

    const requirementDecideMatch = path.match(/^\/v1\/requirements\/([^/]+)\/decide$/);
    if (requirementDecideMatch && req.method === 'POST') {
      const requirementId = decodeURIComponent(requirementDecideMatch[1]!);
      const body = await readJsonBody<{ decision?: 'Approved' | 'Rejected'; decidedBy?: string; reason?: string }>(req);
      if (body.decision !== 'Approved' && body.decision !== 'Rejected') {
        sendJson(res, 400, { error: 'decision must be "Approved" or "Rejected"' });
        return;
      }
      if (!body.decidedBy) {
        sendJson(res, 400, { error: 'decidedBy is required' });
        return;
      }
      const existing = await state.requirementStore?.get(requirementId);
      if (!existing) {
        sendJson(res, 404, { error: `requirement ${requirementId} not found` });
        return;
      }
      let requirement: RequirementContract | undefined;
      try {
        requirement = await state.requirementStore!.decide(requirementId, {
          decision: body.decision,
          decidedBy: body.decidedBy,
          reason: body.reason,
          decidedAt: new Date().toISOString(),
        });
      } catch (err) {
        if (err instanceof RequirementAlreadyDecidedError) {
          sendJson(res, 409, { error: err.message });
          return;
        }
        throw err;
      }
      await state.auditService.append(
        {
          action: body.decision === 'Approved' ? 'requirement.accepted' : 'requirement.rejected',
          actor: body.decidedBy,
          resourceType: 'requirement',
          resourceId: requirementId,
          outcome: 'success',
          correlationId: `corr-requirement-decide-${requirementId}-${Date.now()}`,
          detail: { reason: body.reason ?? null },
        },
        `corr-requirement-decide-${requirementId}-${Date.now()}`,
      );
      sendJson(res, 200, requirement);
      return;
    }

    // PM's read of a goal, before anything is submitted. Suggestion only.
    if (path === '/v1/intake/route' && req.method === 'POST') {
      const body = await readJsonBody<{
        goal?: string;
        doneWhen?: string;
        constraints?: string[];
      }>(req);
      const goal = body.goal?.trim() ?? '';
      if (goal.length < 8) {
        sendJson(res, 400, { error: 'goal must be at least 8 characters' });
        return;
      }
      sendJson(res, 200, {
        routing: routeIntakeGoal({
          goal,
          doneWhen: body.doneWhen,
          constraints: body.constraints,
        }),
        codeProducers: listCodeProducers(),
        activeCodeProducer: state.codeProducer?.id ?? null,
      });
      return;
    }

    if (path === '/v1/work-packages' && req.method === 'GET') {
      sendJson(res, 200, { workPackages: state.workPackages });
      return;
    }

    // Work Graph (Requirements → Product → Architecture → UX → Implementation
    // → QA → Security → Release → Operations) — @umer/orchestration. Real
    // persisted nodes/edges only; an unknown project returns an honest empty
    // graph, never a fabricated one.
    const workGraphMatch = path.match(/^\/v1\/work-graph\/([^/]+)$/);
    if (workGraphMatch && req.method === 'GET') {
      const projectId = decodeURIComponent(workGraphMatch[1]!);
      const graph = await state.persistentWorkGraph!.load(projectId);
      sendJson(res, 200, {
        projectId,
        nodes: graph.listNodes(projectId),
        edges: graph.listEdges(projectId),
        // Cross-process, eventually-consistent — see WorkGraphPlanResult's doc
        // comment on state.ts. Absent means "no plan has reported back yet",
        // not "nothing is ready" — check nodes' own status for that.
        lastPlanResult: state.workGraphPlanResults?.get(projectId) ?? null,
      });
      return;
    }

    const workGraphDecomposeMatch = path.match(/^\/v1\/work-graph\/([^/]+)\/decompose$/);
    if (workGraphDecomposeMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(workGraphDecomposeMatch[1]!);
      const body = await readJsonBody<{ slug?: string }>(req);
      try {
        const graph = await applyRequirementDecomposition(state.persistentWorkGraph!, {
          projectId,
          slug: body.slug,
        });
        await state.auditService.append(
          {
            action: 'work_graph.decomposed',
            actor: 'ceo.command-plane',
            resourceType: 'project',
            resourceId: projectId,
            outcome: 'success',
            correlationId: `corr-decompose-${projectId}-${Date.now()}`,
            detail: { slug: body.slug ?? projectId, nodeCount: graph.listNodes(projectId).length },
          },
          `corr-decompose-${projectId}-${Date.now()}`,
        );
        sendJson(res, 200, { projectId, nodes: graph.listNodes(projectId), edges: graph.listEdges(projectId) });
      } catch (err) {
        // Most likely a duplicate decomposition (same slug already applied to this project) —
        // WorkGraph's own validation (duplicate node/edge ids) is the source of truth here.
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // Seeds a single, edge-free UX/QA/Security node onto a project's graph —
    // the only 3 node types with a real dispatchable Specialist today (see
    // apps/orchestration-worker/src/main.ts's NODE_TYPE_SPECIALISTS) — so an
    // operator can request a one-off audit without running the full
    // Requirements -> Product -> Architecture decomposition first (which has
    // no dispatchable Specialist of its own and so never reaches UX/QA/
    // Security on its own). The node comes out Ready immediately; the
    // existing POST /v1/work-graph/:projectId/plan route is what actually
    // turns it into a dispatched Work Package.
    const workGraphAuditMatch = path.match(/^\/v1\/work-graph\/([^/]+)\/audit$/);
    if (workGraphAuditMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(workGraphAuditMatch[1]!);
      const body = await readJsonBody<{ type?: string; title?: string; requestedBy?: string }>(req);
      const AUDIT_NODE_TYPES: ReadonlySet<string> = new Set(['UX', 'QA', 'Security']);
      if (!body.type || !AUDIT_NODE_TYPES.has(body.type)) {
        sendJson(res, 400, { error: 'type must be one of "UX", "QA", or "Security"' });
        return;
      }
      if (!body.requestedBy) {
        sendJson(res, 400, { error: 'requestedBy is required' });
        return;
      }
      const project = await state.projectStore?.get(projectId);
      if (!project) {
        sendJson(res, 404, { error: `project ${projectId} not found` });
        return;
      }
      try {
        const { graph, node } = await applyStandaloneAuditNode(state.persistentWorkGraph!, {
          projectId,
          type: body.type as StandaloneAuditNodeType,
          title: body.title,
        });
        const correlationId = `corr-audit-${projectId}-${Date.now()}`;
        await state.auditService.append(
          {
            action: 'work_graph.audit_node_seeded',
            actor: body.requestedBy,
            resourceType: 'project',
            resourceId: projectId,
            outcome: 'success',
            correlationId,
            detail: { nodeId: node.nodeId, type: node.type, title: node.title },
          },
          correlationId,
        );
        sendJson(res, 201, { projectId, node, nodes: graph.listNodes(projectId) });
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // Real, persisted-Requirement-grounded instruction for the five node
    // types (Requirements, Product, Architecture, UX, Implementation) whose Specialist works from the
    // Requirement's context — see
    // requirements.formalize/product.definition/architecture.design/ux.design/eng.app-delivery in
    // orchestration-worker's NODE_TYPE_SPECIALISTS. Returns undefined (falls
    // back to the generic boilerplate below) when there's no requirementId
    // annotation, no requirementStore connected, or the Requirement itself
    // can't be found — never fabricates Requirement content that doesn't exist.
    async function buildRequirementGroundedTask(
      nodeType: string,
      requirementId: string | undefined,
      projectId?: string,
    ): Promise<{ description: string; acceptanceCriteria: string[] } | undefined> {
      if (!requirementId || !state.requirementStore) return undefined;
      if (
        nodeType !== 'Requirements' &&
        nodeType !== 'Product' &&
        nodeType !== 'Architecture' &&
        nodeType !== 'UX' &&
        nodeType !== 'Implementation' &&
        nodeType !== 'QA' &&
        nodeType !== 'Security' &&
        nodeType !== 'Release' &&
        nodeType !== 'Operations'
      )
        return undefined;
      const requirement = await state.requirementStore.get(requirementId);
      if (!requirement) return undefined;

      const lines = [
        `Problem: ${requirement.problem}`,
        `Desired outcome: ${requirement.desiredOutcome}`,
        requirement.constraints.length > 0 ? `Constraints: ${requirement.constraints.join('; ')}` : undefined,
        `Acceptance criteria: ${requirement.acceptanceCriteria.join('; ')}`,
        requirement.assumptions.length > 0 ? `Assumptions: ${requirement.assumptions.join('; ')}` : undefined,
        requirement.openQuestions.length > 0 ? `Open questions: ${requirement.openQuestions.join('; ')}` : undefined,
      ].filter((line): line is string => Boolean(line));

      // If planning Architecture, UX, Implementation, QA, Security, Release, or Operations and prior tasks exist for this project,
      // include them for context so downstream stages build on real upstream work.
      if (
        (nodeType === 'Architecture' ||
          nodeType === 'UX' ||
          nodeType === 'Implementation' ||
          nodeType === 'QA' ||
          nodeType === 'Security' ||
          nodeType === 'Release' ||
          nodeType === 'Operations') &&
        projectId &&
        state.taskStore
      ) {
        try {
          const tasks = await state.taskStore.list({ projectId });
          const productTask = tasks.find(
            (t) => t.title.toLowerCase().includes('product') && t.description.length > 0,
          );
          if (productTask) {
            lines.push(`Product context: ${productTask.description}`);
          }
          if (
            nodeType === 'Implementation' ||
            nodeType === 'QA' ||
            nodeType === 'Security' ||
            nodeType === 'Release' ||
            nodeType === 'Operations'
          ) {
            const archTask = tasks.find(
              (t) => t.title.toLowerCase().includes('architecture') && t.description.length > 0,
            );
            if (archTask) {
              lines.push(`Architecture context: ${archTask.description}`);
            }
            const uxTask = tasks.find(
              (t) => t.title.toLowerCase().includes('ux') && t.description.length > 0,
            );
            if (uxTask) {
              lines.push(`UX context: ${uxTask.description}`);
            }
          }
          if (
            nodeType === 'QA' ||
            nodeType === 'Security' ||
            nodeType === 'Release' ||
            nodeType === 'Operations'
          ) {
            const implTask = tasks.find(
              (t) =>
                (t.title === 'Implementation' ||
                  t.title.toLowerCase().startsWith('implementation:') ||
                  t.title.toLowerCase().startsWith('implementation ')) &&
                t.description.length > 0,
            );
            if (implTask) {
              lines.push(`Implementation context: ${implTask.description}`);
            }
          }
          if (nodeType === 'Release' || nodeType === 'Operations') {
            const qaTask = tasks.find(
              (t) =>
                (t.title === 'QA' ||
                  t.title.toLowerCase().startsWith('qa:') ||
                  t.title.toLowerCase().startsWith('qa ')) &&
                t.description.length > 0,
            );
            if (qaTask) {
              lines.push(`QA context: ${qaTask.description}`);
            }
            const secTask = tasks.find(
              (t) =>
                (t.title === 'Security Review' ||
                  t.title.toLowerCase().startsWith('security:') ||
                  t.title.toLowerCase().startsWith('security ') ||
                  t.title.toLowerCase().startsWith('sec:')) &&
                t.description.length > 0,
            );
            if (secTask) {
              lines.push(`Security context: ${secTask.description}`);
            }
          }
          if (nodeType === 'Operations') {
            const relTask = tasks.find(
              (t) =>
                (t.title === 'Release' ||
                  t.title.toLowerCase().startsWith('release:') ||
                  t.title.toLowerCase().startsWith('release ')) &&
                !t.title.toLowerCase().startsWith('qa') &&
                t.description.length > 0,
            );
            if (relTask) {
              lines.push(`Release context: ${relTask.description}`);
            }
          }
        } catch {
          // Non-blocking: fall back gracefully to Requirement grounding alone
        }
      }

      const task =
        nodeType === 'Requirements'
          ? `Formalize this Requirement into a Requirements Brief.`
          : nodeType === 'Product'
            ? `Define product scope, user stories, risks, and prioritization for this Requirement.`
            : nodeType === 'Architecture'
              ? `Define system architecture, data model, API/integration contracts, security architecture, and deployment topology for this Requirement.`
              : nodeType === 'UX'
                ? `Design user experience, user flows, interaction patterns, accessibility standards, and UI layout specifications for this Requirement.`
                : nodeType === 'Implementation'
                  ? `Implement software changes for this Requirement, adhering to Architecture specifications and UX designs. Inspect repository, scope changes, execute staged tests, and produce unified diff and test evidence.`
                  : nodeType === 'QA'
                    ? `Verify functional, UI, and non-functional quality for this Requirement and Implementation. Inspect repository and test signals, execute test suites, and produce verification evidence.`
                    : nodeType === 'Security'
                      ? `Conduct static security audit for this Requirement and Implementation. Run dependency advisories (npm/composer audit), scan for secrets, and review route authorization consistency.`
                      : nodeType === 'Release'
                        ? `Prepare deployment-ready ReleasePackage for this Requirement. Inspect repository deployment descriptors (Docker Compose / Helm chart), verify QA test plan results and security audit sign-offs, and define an actionable rollback procedure.`
                        : `Verify deployment health, validate SLO and error budget criteria, confirm rollback readiness, and report production status for this Requirement and Release.`;

      const acceptanceCriteria =
        nodeType === 'Architecture'
          ? [
              ...requirement.acceptanceCriteria,
              'System architecture, data model, API contracts, security architecture, and deployment topology documented and reviewed',
            ]
          : nodeType === 'UX'
            ? [
                ...requirement.acceptanceCriteria,
                'User experience, user flows, interaction patterns, accessibility standards, and UI layout specifications documented and reviewed',
              ]
            : nodeType === 'Implementation'
              ? [
                  ...requirement.acceptanceCriteria,
                  'Scoped repository change implemented with unified diff and passing test evidence',
                  'Implementation artifact submitted for human review gate',
                ]
              : nodeType === 'QA'
                ? [
                    ...requirement.acceptanceCriteria,
                    'Independent QA verification plan executed with test signals and logs captured',
                    'Test plan results artifact submitted for human review gate',
                  ]
                : nodeType === 'Security'
                  ? [
                      ...requirement.acceptanceCriteria,
                      'Static security audit conducted with severity-tagged findings and advisory evidence',
                      'Security report artifact submitted for human review gate',
                    ]
                  : nodeType === 'Release'
                    ? [
                        ...requirement.acceptanceCriteria,
                        'ReleasePackage artifact assembled with target manifests and verified quality gate sign-offs',
                        'Actionable rollback plan defined with explicit steps and verification criteria',
                        'ReleasePackage artifact submitted for human review gate',
                      ]
                    : nodeType === 'Operations'
                      ? [
                          ...requirement.acceptanceCriteria,
                          'Deployment health verified across all service probes (control-api, gateway, workers, web)',
                          'Truthful production status and incident log updated with operational evidence',
                          'Operational report artifact submitted for human review gate',
                        ]
                      : requirement.acceptanceCriteria;

      return {
        description: `${task}\n\n${lines.join('\n')}`,
        acceptanceCriteria,
      };
    }

    // Turns Ready nodes into real, dispatched Work Packages via
    // @umer/orchestration's ReadyWorkPackagePlanner — running in
    // orchestration-worker's process, which owns the real Orchestrator, so
    // this route only ever gets as far as: create real Tasks for the ready
    // nodes (the one write this route makes itself), mint an execution
    // context, and publish `workgraph.plan` for orchestration-worker to act
    // on. The actual created/skipped result is NOT returned synchronously —
    // it arrives via evt.runtime.workgraph.planned (see
    // runtime-work-package-bridge.ts) and shows up in a follow-up
    // GET /v1/work-graph/:projectId's `lastPlanResult`. Requires an
    // `approver` so an automatic trigger can't quietly stand in for a human
    // decision until that's explicitly designed and approved.
    const workGraphPlanMatch = path.match(/^\/v1\/work-graph\/([^/]+)\/plan$/);
    if (workGraphPlanMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(workGraphPlanMatch[1]!);
      const body = await readJsonBody<{ approver?: string }>(req);
      if (!body.approver) {
        sendJson(res, 400, { error: 'approver is required' });
        return;
      }
      if (!state.commandService) {
        sendJson(res, 503, { error: 'command_service_unavailable' });
        return;
      }
      if (!state.fabric) {
        sendJson(res, 503, {
          error: 'message_fabric_unavailable',
          message: 'Cannot reach orchestration-worker to run the planner right now.',
        });
        return;
      }

      const graph = await state.persistentWorkGraph!.load(projectId);
      const ready = graph.listReadyNodes(projectId);
      if (ready.length === 0) {
        sendJson(res, 200, { projectId, readyNodeIds: [], message: 'No ready nodes to plan.' });
        return;
      }

      const correlationId = `corr-plan-${projectId}-${Date.now()}`;
      const taskIdsByNodeId: Record<string, string[]> = {};
      // The real Task's own title/description, keyed by node — carried
      // alongside the bare id so the dispatched Specialist's prompt has
      // actual content to act on instead of just "Tasks: <id>" (see
      // ReadyWorkPackagePlanner's taskDetails -> metadata.annotations.instruction).
      const taskDetailsByNodeId: Record<string, Array<{ taskId: string; title: string; description: string }>> = {};
      for (const node of ready) {
        const title = node.title;
        const requirementIdAnnotation = node.metadata.annotations?.requirementId;
        const grounded = await buildRequirementGroundedTask(
          node.type,
          typeof requirementIdAnnotation === 'string' ? requirementIdAnnotation : undefined,
          projectId,
        );
        const description =
          grounded?.description ?? `Deliver "${node.title}" for project ${projectId}, per its Work Graph decomposition.`;
        const acceptanceCriteria = grounded?.acceptanceCriteria ?? [`${node.title} artifact accepted by human review`];
        const taskEnvelope = {
          commandId: `cmd-${randomUUID()}`,
          schemaVersion: SCHEMA_VERSION,
          name: 'CreateTask',
          issuedAt: new Date().toISOString(),
          correlationId,
          producer: 'control-api',
          payload: {
            epicId: `epic-${projectId}`,
            projectId,
            title,
            description,
            acceptanceCriteria,
          },
          actor: { principalId: body.approver, kind: 'human' as const },
        } as unknown as CeoCommandEnvelope;

        const result = await state.commandService.execute(taskEnvelope);
        const task = result.data as { taskId: string };
        taskIdsByNodeId[node.nodeId] = [task.taskId];
        taskDetailsByNodeId[node.nodeId] = [{ taskId: task.taskId, title, description }];
      }

      // Real registered-codebase context, only when the Work Management
      // Project this graph belongs to actually links to one (registryProjectId)
      // AND that catalog entry resolves to something genuinely on disk.
      // Never a guess: a Specialist whose mandate needs real file access
      // (e.g. ux.design) is skipped by the planner rather than dispatched
      // without one — see orchestration-worker's resolveTaskContext.
      let targetPath: string | undefined;
      const wmProject = await state.projectStore?.get(projectId);
      if (wmProject?.registryProjectId) {
        try {
          const registered = state.projectRegistry.get(wmProject.registryProjectId);
          if (registered.onDisk) {
            targetPath = registered.absolutePath;
          }
        } catch {
          // Unknown/stale registryProjectId — leave targetPath unresolved rather than guess.
        }
      }

      const execId = `EXEC-${Date.now()}`;
      const contextHandle = `ctx-plan-${projectId}-${Date.now()}`;
      const command = createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.PLAN_PROJECT,
        producer: 'control-api',
        correlationId,
        idempotencyKey: correlationId,
        payload: {
          projectId,
          execId,
          contextHandle,
          taskIdsByNodeId,
          taskDetailsByNodeId,
          ...(targetPath ? { targetPath } : {}),
        },
      });
      await state.fabric.publishCommand(SUBJECTS.CMD_ORCHESTRATION, command);

      await state.auditService.append(
        {
          action: 'work_graph.plan_requested',
          actor: body.approver,
          resourceType: 'project',
          resourceId: projectId,
          outcome: 'success',
          correlationId,
          detail: { readyNodeIds: ready.map((n) => n.nodeId), taskIdsByNodeId, execId, targetPath },
        },
        correlationId,
      );

      sendJson(res, 202, {
        projectId,
        correlationId,
        execId,
        readyNodeIds: ready.map((n) => n.nodeId),
        taskIdsByNodeId,
        targetPath: targetPath ?? null,
        message: 'Planning requested. Check GET /v1/work-graph/:projectId shortly for the result.',
      });
      return;
    }

    // Agent Run read model — Runtime Observability domain (MONOREPO_BLUEPRINT.md
    // §15 / implementation/LLM_AGENT_EXECUTION.md §8b). Backed by an in-memory
    // projection of evt.runtime.agent.> events; empty until a live Message
    // Fabric subscription is wired in main.ts (see startAgentRunReadModelSubscription).
    if (path === '/v1/agent-runs' && req.method === 'GET') {
      const store = state.agentRunReadModel ?? new InMemoryAgentRunReadModelStore();
      const statusParam = url.searchParams.get('status');
      const status = statusParam === 'running' || statusParam === 'completed' || statusParam === 'failed' ? statusParam : undefined;
      sendJson(res, 200, { agentRuns: await store.list(status ? { status } : undefined) });
      return;
    }

    const agentRunMatch = path.match(/^\/v1\/agent-runs\/([^/]+)$/);
    if (agentRunMatch && req.method === 'GET') {
      const workPackageId = decodeURIComponent(agentRunMatch[1]!);
      const store = state.agentRunReadModel ?? new InMemoryAgentRunReadModelStore();
      const snapshot = await store.get(workPackageId);
      if (!snapshot) {
        sendJson(res, 404, { error: `No agent run known for work package ${workPackageId}` });
        return;
      }
      sendJson(res, 200, snapshot);
      return;
    }

    // --- Company Operating Model: Agent / Project / Task / Opportunity read
    // endpoints (implementation/COMPANY_OPERATING_MODEL.md). Writes to these
    // entities now happen exclusively through POST /v1/commands (CEO Command
    // & Decision Plane, below) — these GET routes are unchanged and simply
    // read whatever the command handlers just wrote.

    if (path === '/v1/agents' && req.method === 'GET') {
      const statusParam = url.searchParams.get('status');
      const status =
        statusParam === 'idle' || statusParam === 'active' || statusParam === 'blocked' || statusParam === 'offline'
          ? statusParam
          : undefined;
      const department = url.searchParams.get('department') ?? undefined;
      const specialistId = url.searchParams.get('specialist') ?? undefined;
      const agents = (await state.agentRegistry?.list({ status, department, specialistId })) ?? [];
      sendJson(res, 200, {
        agents: await Promise.all(
          agents.map(async (agent) => enrichAgentWithControlState(state, await enrichAgentWithProject(state, agent))),
        ),
      });
      return;
    }

    const agentMatch = path.match(/^\/v1\/agents\/([^/]+)$/);
    if (agentMatch && req.method === 'GET') {
      const agentId = decodeURIComponent(agentMatch[1]!);
      const agent = await state.agentRegistry?.get(agentId);
      if (!agent) {
        sendJson(res, 404, { error: `No agent known for id ${agentId}` });
        return;
      }
      sendJson(res, 200, await enrichAgentWithControlState(state, await enrichAgentWithProject(state, agent)));
      return;
    }

    // Specialist-type lifecycle control (SuspendSpecialist/ActivateSpecialist,
    // via POST /v1/commands below) — an orthogonal axis to per-agent-instance
    // control above: this governs a specialist *type* (e.g. eng.app-delivery)
    // company-wide. Sparse by design: a specialist never suspended has no
    // record and reads back as controlState "active".
    if (path === '/v1/specialists' && req.method === 'GET') {
      const records = (await state.specialistControlStore?.list()) ?? [];
      sendJson(res, 200, { specialists: records });
      return;
    }

    const specialistMatch = path.match(/^\/v1\/specialists\/([^/]+)$/);
    if (specialistMatch && req.method === 'GET') {
      const specialistId = decodeURIComponent(specialistMatch[1]!);
      sendJson(res, 200, await getSpecialistControlState(state, specialistId));
      return;
    }

    // Named /v1/work-projects (not /v1/projects — that path already serves the
    // @umer/registry codebase catalog; this is the Work Management Project
    // noun instead. See implementation/COMPANY_OPERATING_MODEL.md §Boundary.)
    if (path === '/v1/work-projects' && req.method === 'GET') {
      const status = (url.searchParams.get('status') as ProjectStatus | null) ?? undefined;
      const owner = url.searchParams.get('owner') ?? undefined;
      const projects = (await state.projectStore?.list({ status, owner })) ?? [];
      sendJson(res, 200, { projects });
      return;
    }

    const workProjectMatch = path.match(/^\/v1\/work-projects\/([^/]+)$/);
    if (workProjectMatch && req.method === 'GET') {
      const projectId = decodeURIComponent(workProjectMatch[1]!);
      const project = await state.projectStore?.get(projectId);
      if (!project) {
        sendJson(res, 404, { error: `No project known for id ${projectId}` });
        return;
      }
      sendJson(res, 200, project);
      return;
    }

    // Production & Deployment routes (M7 — Release + Operations)
    const productionMatch = path.match(/^\/v1\/(?:work-projects|projects)\/([^/]+)\/production$/);
    if (productionMatch && req.method === 'GET') {
      const projectId = decodeURIComponent(productionMatch[1]!);
      state.deploymentEngine ??= new DeploymentEngine();
      const env = (url.searchParams.get('env') as Environment | null) ?? 'production';
      const productionStatus = state.deploymentEngine.getProductionStatus(projectId, env);
      const deployments = state.deploymentEngine.listDeployments(projectId, env);
      const incidents = state.deploymentEngine.listIncidents(projectId);
      sendJson(res, 200, {
        projectId,
        productionStatus,
        deployments,
        incidents,
      });
      return;
    }

    const deployMatch = path.match(/^\/v1\/(?:work-projects|projects)\/([^/]+)\/deploy$/);
    if (deployMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(deployMatch[1]!);
      state.deploymentEngine ??= new DeploymentEngine();
      const body = await readJsonBody<{
        releasePackageId?: string;
        targetVersion?: string;
        environment?: Environment;
        strategy?: DeploymentStrategy;
        manifestRef?: string;
        rollbackPlan?: RollbackPlan;
        approver?: string;
        autoRollbackOnFailure?: boolean;
      }>(req);

      if (!body.releasePackageId || !body.targetVersion) {
        sendJson(res, 400, { error: 'releasePackageId and targetVersion are required' });
        return;
      }

      const rollbackPlan = body.rollbackPlan ?? {
        strategy: 'helm rollback',
        targetVersion: '0.9.0',
        steps: ['helm rollback umer 1', 'verify pods running'],
        verificationCriteria: ['GET /health returns 200 on all endpoints'],
      };

      try {
        const deployment = await state.deploymentEngine.prepareRelease({
          projectId,
          releasePackageId: body.releasePackageId,
          targetVersion: body.targetVersion,
          environment: body.environment ?? 'production',
          strategy: body.strategy ?? 'helm',
          manifestRef: body.manifestRef,
          rollbackPlan,
        });

        const approver = body.approver ?? 'human.operator';
        await state.deploymentEngine.approveDeployment(deployment.deploymentId, approver);

        const outcome = await state.deploymentEngine.executeDeployment({
          deploymentId: deployment.deploymentId,
          autoRollbackOnFailure: body.autoRollbackOnFailure ?? true,
          executedBy: approver,
        });

        const correlationId = `corr-deploy-${projectId}-${Date.now()}`;
        await state.auditService.append(
          {
            action: 'deployment.executed',
            actor: approver,
            resourceType: 'project',
            resourceId: projectId,
            outcome: outcome.deployment.status === 'deployed' ? 'success' : 'failure',
            correlationId,
            detail: {
              deploymentId: outcome.deployment.deploymentId,
              targetVersion: body.targetVersion,
              healthStatus: outcome.deployment.healthStatus,
            },
          },
          correlationId,
        );

        sendJson(res, outcome.deployment.status === 'deployed' ? 200 : 500, outcome);
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    const rollbackMatch = path.match(/^\/v1\/(?:work-projects|projects)\/([^/]+)\/rollback$/);
    if (rollbackMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(rollbackMatch[1]!);
      state.deploymentEngine ??= new DeploymentEngine();
      const body = await readJsonBody<{
        deploymentId?: string;
        reason?: string;
        triggeredBy?: string;
      }>(req);

      if (!body.deploymentId || !body.reason) {
        sendJson(res, 400, { error: 'deploymentId and reason are required' });
        return;
      }

      try {
        const outcome = await state.deploymentEngine.executeRollback({
          deploymentId: body.deploymentId,
          reason: body.reason,
          triggeredBy: body.triggeredBy ?? 'human.operator',
        });

        const correlationId = `corr-rollback-${projectId}-${Date.now()}`;
        await state.auditService.append(
          {
            action: 'deployment.rolled_back',
            actor: body.triggeredBy ?? 'human.operator',
            resourceType: 'project',
            resourceId: projectId,
            outcome: 'success',
            correlationId,
            detail: {
              deploymentId: body.deploymentId,
              reason: body.reason,
              incidentId: outcome.incident.incidentId,
            },
          },
          correlationId,
        );

        sendJson(res, 200, outcome);
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    const deploymentsListMatch = path.match(/^\/v1\/(?:work-projects|projects)\/([^/]+)\/deployments$/);
    if (deploymentsListMatch && req.method === 'GET') {
      const projectId = decodeURIComponent(deploymentsListMatch[1]!);
      state.deploymentEngine ??= new DeploymentEngine();
      const deployments = state.deploymentEngine.listDeployments(projectId);
      sendJson(res, 200, { projectId, deployments });
      return;
    }

    const incidentsListMatch = path.match(/^\/v1\/(?:work-projects|projects)\/([^/]+)\/incidents$/);
    if (incidentsListMatch && req.method === 'GET') {
      const projectId = decodeURIComponent(incidentsListMatch[1]!);
      state.deploymentEngine ??= new DeploymentEngine();
      const incidents = state.deploymentEngine.listIncidents(projectId);
      sendJson(res, 200, { projectId, incidents });
      return;
    }

    if (path === '/v1/tasks' && req.method === 'GET') {
      const status = (url.searchParams.get('status') as TaskStatus | null) ?? undefined;
      const assignedAgentId = url.searchParams.get('agent') ?? undefined;
      const projectId = url.searchParams.get('project') ?? undefined;
      const tasks = (await state.taskStore?.list({ status, assignedAgentId, projectId })) ?? [];
      sendJson(res, 200, { tasks });
      return;
    }

    const taskMatch = path.match(/^\/v1\/tasks\/([^/]+)$/);
    if (taskMatch && req.method === 'GET') {
      const taskId = decodeURIComponent(taskMatch[1]!);
      const task = await state.taskStore?.get(taskId);
      if (!task) {
        sendJson(res, 404, { error: `No task known for id ${taskId}` });
        return;
      }
      sendJson(res, 200, task);
      return;
    }

    if (path === '/v1/opportunities' && req.method === 'GET') {
      const statusFilter = url.searchParams.get('status') ?? undefined;
      const all = (await state.opportunityReader?.listOpportunities()) ?? [];
      const filtered = statusFilter ? all.filter((o) => o.status === statusFilter) : all;
      sendJson(res, 200, { opportunities: filtered });
      return;
    }

    const opportunityMatch = path.match(/^\/v1\/opportunities\/([^/]+)$/);
    if (opportunityMatch && req.method === 'GET') {
      const opportunityId = decodeURIComponent(opportunityMatch[1]!);
      const opportunity = await state.opportunityReader?.getOpportunity(opportunityId);
      if (!opportunity) {
        sendJson(res, 404, { error: `No opportunity known for id ${opportunityId}` });
        return;
      }
      sendJson(res, 200, opportunity);
      return;
    }

    // --- Commercial Intelligence — read-only over the existing Opportunity
    // Intelligence persistence (BusinessProspect / EvidenceRecord /
    // DiscoveryCandidateRecord / OpportunityProblemRecord / OutreachDraft).
    // No new domain model, no new persistence method: every one of these
    // already existed on OpportunityPersistence, just never had an HTTP route.
    // `identityIdFor` mirrors apps/web's existing
    // src/app/api/opportunity/details/route.ts exactly (externalId/name/
    // websiteUrl/geography only, no phone) so computed ids match whatever
    // run-service.ts originally hashed when it saved the BusinessProspect —
    // including phone here would silently produce a different, non-matching id.
    const identityIdFor = (candidate: Pick<DiscoveryCandidateRecord, 'externalId' | 'name' | 'websiteUrl' | 'geography'>): string =>
      buildBusinessIdentity({
        externalId: candidate.externalId,
        name: candidate.name,
        websiteUrl: candidate.websiteUrl,
        geography: candidate.geography,
      }).id;

    // The real Google Places discovery path only ever writes phone/address into
    // sourceRefs as `phone:`/`address:` prefixed strings — the structured
    // DiscoveryCandidateRecord.phone/.address columns exist in the schema but
    // are never actually populated by the live write path (confirmed against
    // real seeded data), so "does this candidate have a phone" must check both.
    const candidateHasPhone = (candidate: DiscoveryCandidateRecord): boolean =>
      Boolean(candidate.phone) || (candidate.sourceRefs?.some((ref) => ref.startsWith('phone:')) ?? false);

    if (path === '/v1/niches' && req.method === 'GET') {
      const niches = (await state.opportunityReader?.listNiches()) ?? [];
      sendJson(res, 200, { niches });
      return;
    }

    const businessMatch = path.match(/^\/v1\/businesses\/([^/]+)$/);
    if (businessMatch && req.method === 'GET') {
      const businessId = decodeURIComponent(businessMatch[1]!);
      const reader = state.opportunityReader;
      const business = await reader?.getBusiness(businessId);
      if (!business) {
        sendJson(res, 404, { error: `No prospect known for id ${businessId}` });
        return;
      }
      const problems = (await reader?.listProblems({ businessId })) ?? [];
      const requestedRunId = url.searchParams.get('runId') ?? undefined;
      const latestNicheRunId = business.nicheId ? (await reader?.getLatestRun(business.nicheId))?.runId : undefined;
      // A business can resurface across several research runs (rediscovered on
      // re-runs). Prefer the niche's latest run (matches /v1/niches/:id/prospects'
      // behavior) — but a business isn't guaranteed to appear in every run, so
      // fall back to searching each run any of its Problems came from until its
      // DiscoveryCandidateRecord (phone/address) is actually found, rather than
      // silently showing stale/missing contact data from an arbitrary run.
      const candidateRunIdsToTry = [
        ...(requestedRunId ? [requestedRunId] : []),
        ...(latestNicheRunId ? [latestNicheRunId] : []),
        ...new Set(problems.map((p) => p.runId)),
      ];
      let runId: string | null = null;
      let discoveryCandidate: DiscoveryCandidateRecord | null = null;
      for (const candidateRunId of candidateRunIdsToTry) {
        const candidates = (await reader?.listDiscoveryCandidates(candidateRunId)) ?? [];
        const found = candidates.find((c) => identityIdFor(c) === businessId);
        if (found) {
          runId = candidateRunId;
          discoveryCandidate = found;
          break;
        }
        runId ??= candidateRunId;
      }
      const opportunities = business.nicheId
        ? ((await reader?.listOpportunities(business.nicheId)) ?? []).filter((o) => o.businessId === businessId)
        : [];
      const outreach = (await reader?.listOutreachDrafts({ businessId })) ?? [];
      const evidenceIds = [
        ...new Set([
          ...problems.flatMap((p) => p.evidenceRefs),
          ...opportunities.flatMap((o) => o.evidenceRefs),
          ...outreach.flatMap((d) => d.evidenceRefs),
        ]),
      ];
      const evidence = (await reader?.listEvidence(evidenceIds)) ?? [];
      sendJson(res, 200, { business, discoveryCandidate, runId: runId ?? null, problems, opportunities, outreach, evidence });
      return;
    }

    const nicheProspectsMatch = path.match(/^\/v1\/niches\/([^/]+)\/prospects$/);
    if (nicheProspectsMatch && req.method === 'GET') {
      const nicheId = decodeURIComponent(nicheProspectsMatch[1]!);
      const reader = state.opportunityReader;
      const requestedRunId = url.searchParams.get('runId') ?? undefined;
      const runId = requestedRunId ?? (await reader?.getLatestRun(nicheId))?.runId;
      if (!runId) {
        sendJson(res, 200, { nicheId, runId: null, prospects: [] });
        return;
      }
      const [candidates, problems, opportunities] = await Promise.all([
        reader?.listDiscoveryCandidates(runId) ?? Promise.resolve([]),
        reader?.listProblems({ runId }) ?? Promise.resolve([]),
        reader?.listOpportunities(nicheId) ?? Promise.resolve([]),
      ]);
      const byId = new Map<string, DiscoveryCandidateRecord>();
      for (const candidate of candidates) {
        const id = identityIdFor(candidate);
        if (!byId.has(id)) byId.set(id, candidate);
      }
      const prospects = await Promise.all(
        [...byId.entries()].map(async ([businessId, candidate]) => {
          const business = (await reader?.getBusiness(businessId)) ?? null;
          const businessOpportunities = opportunities.filter((o) => o.businessId === businessId);
          const bestScore = businessOpportunities.reduce((max, o) => Math.max(max, o.score.overall), 0);
          return {
            businessId,
            business,
            candidate,
            problemCount: problems.filter((p) => p.businessId === businessId).length,
            opportunityCount: businessOpportunities.length,
            bestScore,
            hasContactChannel: candidateHasPhone(candidate) || Boolean(candidate.websiteUrl || business?.website),
          };
        }),
      );
      sendJson(res, 200, { nicheId, runId, prospects });
      return;
    }

    const nicheEventsMatch = path.match(/^\/v1\/niches\/([^/]+)\/events$/);
    if (nicheEventsMatch && req.method === 'GET') {
      const nicheId = decodeURIComponent(nicheEventsMatch[1]!);
      const reader = state.opportunityReader;
      const requestedRunId = url.searchParams.get('runId') ?? undefined;
      const runId = requestedRunId ?? (await reader?.getLatestRun(nicheId))?.runId;
      const events = runId ? ((await reader?.listEvents(runId)) ?? []) : [];
      sendJson(res, 200, { nicheId, runId: runId ?? null, events });
      return;
    }

    // Bounded aggregate for the CEO Attention system — caps total businesses
    // considered across all niches so a growing niche catalog can't turn a
    // sidebar poll into an unbounded fan-out (no listBusinesses() exists to
    // query this more cheaply; see implementation notes for this milestone).
    const COMMERCIAL_SUMMARY_BUSINESS_CAP = 200;
    if (path === '/v1/commercial-intelligence/summary' && req.method === 'GET') {
      const reader = state.opportunityReader;
      const niches = (await reader?.listNiches()) ?? [];
      const perNiche: Array<{
        nicheId: string;
        nicheName: string;
        runId: string | null;
        discovered: number;
        contactComplete: number;
        contactIncomplete: number;
      }> = [];
      let businessesConsidered = 0;
      for (const niche of niches) {
        if (businessesConsidered >= COMMERCIAL_SUMMARY_BUSINESS_CAP) break;
        const latestRun = await reader?.getLatestRun(niche.id);
        if (!latestRun) {
          perNiche.push({ nicheId: niche.id, nicheName: niche.name, runId: null, discovered: 0, contactComplete: 0, contactIncomplete: 0 });
          continue;
        }
        const candidates = (await reader?.listDiscoveryCandidates(latestRun.runId)) ?? [];
        const byId = new Map<string, DiscoveryCandidateRecord>();
        for (const candidate of candidates) {
          if (businessesConsidered >= COMMERCIAL_SUMMARY_BUSINESS_CAP) break;
          const id = identityIdFor(candidate);
          if (!byId.has(id)) {
            byId.set(id, candidate);
            businessesConsidered += 1;
          }
        }
        let contactComplete = 0;
        for (const candidate of byId.values()) {
          if (candidateHasPhone(candidate) || candidate.websiteUrl) contactComplete += 1;
        }
        perNiche.push({
          nicheId: niche.id,
          nicheName: niche.name,
          runId: latestRun.runId,
          discovered: byId.size,
          contactComplete,
          contactIncomplete: byId.size - contactComplete,
        });
      }
      const outreachDraftsAwaitingReview = ((await reader?.listOutreachDrafts({ status: 'drafted' })) ?? []).length;
      sendJson(res, 200, {
        niches: perNiche,
        outreachDraftsAwaitingReview,
        businessesConsidered,
        cap: COMMERCIAL_SUMMARY_BUSINESS_CAP,
      });
      return;
    }

    // --- Commercial Sales Loop (@umer/opportunity-intelligence) ---
    // Bridges discovered opportunities through verified contacts, outreach,
    // BANT qualification, proposal creation, CEO approval gating, and
    // automatic delivery project creation on deal win.

    if (path === '/v1/commercial/deals' && req.method === 'GET') {
      const stage = url.searchParams.get('stage') as SalesStage | null;
      const opportunityId = url.searchParams.get('opportunityId') ?? undefined;
      const deals = (await state.commercialPipeline?.listDeals({
        stage: stage ?? undefined,
        opportunityId,
      })) ?? [];
      sendJson(res, 200, { deals });
      return;
    }

    if (path === '/v1/commercial/deals' && req.method === 'POST') {
      const body = await readJsonBody<{
        opportunityId?: string;
        primaryProspectId?: string;
        title?: string;
        estimatedValue?: number;
        currency?: string;
        actor?: string;
      }>(req);
      if (!body.opportunityId || !body.primaryProspectId || !body.title) {
        sendJson(res, 400, {
          error: 'opportunityId, primaryProspectId, and title are required',
        });
        return;
      }
      try {
        const deal = await state.commercialPipeline!.createDeal({
          opportunityId: body.opportunityId,
          primaryProspectId: body.primaryProspectId,
          title: body.title,
          estimatedValue: body.estimatedValue,
          currency: body.currency,
          actor: body.actor ?? 'commercial.sales-representative',
        });
        sendJson(res, 201, deal);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialDealContactsMatch = path.match(/^\/v1\/commercial\/deals\/([^/]+)\/contacts$/);
    if (commercialDealContactsMatch && req.method === 'GET') {
      const dealId = decodeURIComponent(commercialDealContactsMatch[1]!);
      const deal = await state.commercialPipeline?.getDeal(dealId);
      if (!deal) {
        sendJson(res, 404, { error: `Deal not found: ${dealId}` });
        return;
      }
      const contacts = (await state.commercialPipeline?.listContacts(deal.primaryProspectId)) ?? [];
      sendJson(res, 200, { contacts });
      return;
    }

    if (commercialDealContactsMatch && req.method === 'POST') {
      const dealId = decodeURIComponent(commercialDealContactsMatch[1]!);
      const deal = await state.commercialPipeline?.getDeal(dealId);
      if (!deal) {
        sendJson(res, 404, { error: `Deal not found: ${dealId}` });
        return;
      }
      const body = await readJsonBody<{
        prospectId?: string;
        name?: string;
        role?: string;
        email?: string;
        phone?: string;
        linkedinUrl?: string;
        isPrimary?: boolean;
        verificationStatus?: ContactVerificationStatus;
        provenance?: {
          sourceUrl: string;
          observedAt: string;
          method: 'directory' | 'website_scrape' | 'manual' | 'referral' | 'other';
          rawText?: string;
        };
      }>(req);
      if (!body.name || !body.provenance) {
        sendJson(res, 400, { error: 'name and provenance are required' });
        return;
      }
      try {
        const contact = await state.commercialPipeline!.createContact({
          prospectId: body.prospectId ?? deal.primaryProspectId,
          name: body.name,
          role: body.role,
          email: body.email,
          phone: body.phone,
          linkedinUrl: body.linkedinUrl,
          isPrimary: body.isPrimary ?? false,
          verificationStatus: body.verificationStatus ?? 'unverified',
          provenance: body.provenance,
        });
        sendJson(res, 201, contact);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialContactVerifyMatch = path.match(/^\/v1\/commercial\/contacts\/([^/]+)\/verify$/);
    if (commercialContactVerifyMatch && req.method === 'POST') {
      const contactId = decodeURIComponent(commercialContactVerifyMatch[1]!);
      const body = await readJsonBody<{ status?: ContactVerificationStatus }>(req);
      if (!body.status) {
        sendJson(res, 400, { error: 'status is required (unverified | verified | bounced)' });
        return;
      }
      try {
        const contact = await state.commercialPipeline!.verifyContact(contactId, body.status);
        sendJson(res, 200, contact);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialDealOutreachMatch = path.match(/^\/v1\/commercial\/deals\/([^/]+)\/outreach$/);
    if (commercialDealOutreachMatch && req.method === 'POST') {
      const dealId = decodeURIComponent(commercialDealOutreachMatch[1]!);
      const body = await readJsonBody<{
        contactId?: string;
        channel?: 'email' | 'whatsapp' | 'linkedin' | 'phone';
        subject?: string;
        body?: string;
        senderAgentId?: string;
      }>(req);
      if (!body.contactId || !body.channel || !body.body) {
        sendJson(res, 400, { error: 'contactId, channel, and body are required' });
        return;
      }
      try {
        const event = await state.commercialPipeline!.recordOutreachEvent({
          dealId,
          contactId: body.contactId,
          channel: body.channel,
          subject: body.subject,
          body: body.body,
          senderAgentId: body.senderAgentId,
        });
        sendJson(res, 201, event);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialDealResponseMatch = path.match(/^\/v1\/commercial\/deals\/([^/]+)\/response$/);
    if (commercialDealResponseMatch && req.method === 'POST') {
      const dealId = decodeURIComponent(commercialDealResponseMatch[1]!);
      const body = await readJsonBody<{
        outreachEventId?: string;
        contactId?: string;
        sentiment?: 'positive' | 'neutral' | 'negative' | 'objection' | 'unresponsive';
        content?: string;
      }>(req);
      if (!body.outreachEventId || !body.contactId || !body.sentiment || !body.content) {
        sendJson(res, 400, {
          error: 'outreachEventId, contactId, sentiment, and content are required',
        });
        return;
      }
      try {
        const response = await state.commercialPipeline!.recordOutreachResponse({
          outreachEventId: body.outreachEventId,
          dealId,
          contactId: body.contactId,
          sentiment: body.sentiment,
          content: body.content,
        });
        sendJson(res, 201, response);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialDealQualifyMatch = path.match(/^\/v1\/commercial\/deals\/([^/]+)\/qualify$/);
    if (commercialDealQualifyMatch && req.method === 'POST') {
      const dealId = decodeURIComponent(commercialDealQualifyMatch[1]!);
      const body = await readJsonBody<{
        budget: { confirmed: boolean; amount?: number; currency?: string; notes?: string };
        authority: { decisionMakerIdentified: boolean; decisionMakerContactId?: string; notes?: string };
        need: { problemValidated: boolean; urgency: 'immediate' | 'this_quarter' | 'future' | 'unknown'; notes?: string };
        timeline: { expectedCloseDate?: string; implementationDeadline?: string; notes?: string };
        score: number;
        qualified: boolean;
        actor?: string;
      }>(req);
      try {
        const deal = await state.commercialPipeline!.qualifyDeal(
          dealId,
          {
            budget: body.budget,
            authority: body.authority,
            need: body.need,
            timeline: body.timeline,
            score: body.score,
            qualified: body.qualified,
          },
          body.actor ?? 'commercial.sales-representative',
        );
        sendJson(res, 200, deal);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialDealProposalsMatch = path.match(/^\/v1\/commercial\/deals\/([^/]+)\/proposals$/);
    if (commercialDealProposalsMatch && req.method === 'GET') {
      const dealId = decodeURIComponent(commercialDealProposalsMatch[1]!);
      const proposals = (await state.commercialPipeline?.listProposals(dealId)) ?? [];
      sendJson(res, 200, { proposals });
      return;
    }

    if (commercialDealProposalsMatch && req.method === 'POST') {
      const dealId = decodeURIComponent(commercialDealProposalsMatch[1]!);
      const body = await readJsonBody<{
        title?: string;
        scope?: string;
        deliverables?: string[];
        pricingModel?: 'fixed' | 'milestone' | 'retainer' | 'time_and_materials';
        totalAmount?: number;
        currency?: string;
        discountPercent?: number;
        validUntil?: string;
      }>(req);
      if (!body.title || !body.scope || !body.deliverables || !body.pricingModel || !body.totalAmount || !body.validUntil) {
        sendJson(res, 400, {
          error: 'title, scope, deliverables, pricingModel, totalAmount, and validUntil are required',
        });
        return;
      }
      try {
        const proposal = await state.commercialPipeline!.createProposal({
          dealId,
          title: body.title,
          scope: body.scope,
          deliverables: body.deliverables,
          pricingModel: body.pricingModel,
          totalAmount: body.totalAmount,
          currency: body.currency,
          discountPercent: body.discountPercent,
          validUntil: body.validUntil,
        });
        sendJson(res, 201, proposal);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialProposalApproveMatch = path.match(/^\/v1\/commercial\/proposals\/([^/]+)\/approve$/);
    if (commercialProposalApproveMatch && req.method === 'POST') {
      const proposalId = decodeURIComponent(commercialProposalApproveMatch[1]!);
      const body = await readJsonBody<{ actor?: string; ceoApprovalId?: string }>(req);
      try {
        const proposal = await state.commercialPipeline!.approveProposal(
          proposalId,
          body.actor ?? 'ceo',
          body.ceoApprovalId,
        );
        sendJson(res, 200, proposal);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialProposalSendMatch = path.match(/^\/v1\/commercial\/proposals\/([^/]+)\/send$/);
    if (commercialProposalSendMatch && req.method === 'POST') {
      const proposalId = decodeURIComponent(commercialProposalSendMatch[1]!);
      const body = await readJsonBody<{ actor?: string }>(req);
      try {
        const proposal = await state.commercialPipeline!.sendProposal(
          proposalId,
          body.actor ?? 'commercial.sales-representative',
        );
        sendJson(res, 200, proposal);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialDealWinMatch = path.match(/^\/v1\/commercial\/deals\/([^/]+)\/win$/);
    if (commercialDealWinMatch && req.method === 'POST') {
      const dealId = decodeURIComponent(commercialDealWinMatch[1]!);
      const body = await readJsonBody<{ actor?: string; reason?: string }>(req);
      try {
        const result = await state.commercialPipeline!.closeDealWon(
          dealId,
          body.actor ?? 'commercial.sales-representative',
          body.reason,
        );
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialDealLoseMatch = path.match(/^\/v1\/commercial\/deals\/([^/]+)\/lose$/);
    if (commercialDealLoseMatch && req.method === 'POST') {
      const dealId = decodeURIComponent(commercialDealLoseMatch[1]!);
      const body = await readJsonBody<{ actor?: string; reason?: string }>(req);
      try {
        const deal = await state.commercialPipeline!.closeDealLost(
          dealId,
          body.actor ?? 'commercial.sales-representative',
          body.reason,
        );
        sendJson(res, 200, deal);
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    const commercialDealGetMatch = path.match(/^\/v1\/commercial\/deals\/([^/]+)$/);
    if (commercialDealGetMatch && req.method === 'GET') {
      const dealId = decodeURIComponent(commercialDealGetMatch[1]!);
      const deal = await state.commercialPipeline?.getDeal(dealId);
      if (!deal) {
        sendJson(res, 404, { error: `Deal not found: ${dealId}` });
        return;
      }
      sendJson(res, 200, deal);
      return;
    }

    if (path === '/v1/commercial/revenue' && req.method === 'GET') {
      const summary = (await state.commercialPipeline?.getRevenueSummary()) ?? {
        totalWon: 0,
        totalPipeline: 0,
        currency: 'USD',
      };
      const attributions = (await state.commercialPipeline?.listRevenueAttributions()) ?? [];
      sendJson(res, 200, { summary, attributions });
      return;
    }

    // --- Customer Success + Revenue + Learning (@umer/opportunity-intelligence) ---
    // Closes the loop after delivery:
    // Project → Customer → Support → Outcome → Revenue → Feedback → Learning → Opportunity Calibration

    if (path === '/v1/customers' && req.method === 'GET') {
      const customers = (await state.customerSuccess?.listCustomers()) ?? [];
      sendJson(res, 200, { customers });
      return;
    }

    if (path === '/v1/customers' && req.method === 'POST') {
      const body = await readJsonBody<{
        prospectId?: string;
        dealId?: string;
        companyName?: string;
        primaryContactId?: string;
        mrr?: number;
        lifetimeValue?: number;
      }>(req);
      if (!body.prospectId || !body.companyName) {
        sendJson(res, 400, { error: 'prospectId and companyName are required' });
        return;
      }
      try {
        const customer = await state.customerSuccess!.createCustomer({
          prospectId: body.prospectId,
          dealId: body.dealId ? DealIdSchema.parse(body.dealId) : undefined,
          companyName: body.companyName,
          primaryContactId: body.primaryContactId ? ContactIdSchema.parse(body.primaryContactId) : undefined,
          mrr: body.mrr,
          lifetimeValue: body.lifetimeValue,
        });
        sendJson(res, 201, customer);
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    const customerDeliveryOutcomeMatch = path.match(/^\/v1\/customers\/([^/]+)\/delivery-outcome$/);
    if (customerDeliveryOutcomeMatch && req.method === 'POST') {
      const customerId = decodeURIComponent(customerDeliveryOutcomeMatch[1]!) as CustomerId;
      const body = await readJsonBody<{
        projectId?: string;
        status?: DeliveryOutcomeStatus;
        scopeDeliveredPercent?: number;
        acceptanceCriteriaMet?: boolean;
        clientSignoff?: ClientSignoff;
        kpiResults?: DeliveryKpiResult[];
        notes?: string;
      }>(req);
      if (!body.projectId || !body.status || body.scopeDeliveredPercent === undefined || !body.clientSignoff) {
        sendJson(res, 400, { error: 'projectId, status, scopeDeliveredPercent, and clientSignoff are required' });
        return;
      }
      try {
        const outcome = await state.customerSuccess!.recordDeliveryOutcome({
          projectId: ProjectIdSchema.parse(body.projectId),
          customerId: CustomerIdSchema.parse(customerId),
          status: body.status,
          scopeDeliveredPercent: body.scopeDeliveredPercent,
          acceptanceCriteriaMet: body.acceptanceCriteriaMet ?? true,
          clientSignoff: body.clientSignoff,
          kpiResults: body.kpiResults,
          notes: body.notes,
        });
        sendJson(res, 201, outcome);
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    const projectDeliveryOutcomeMatch = path.match(/^\/v1\/projects\/([^/]+)\/delivery-outcome$/);
    if (projectDeliveryOutcomeMatch && req.method === 'GET') {
      const projectId = decodeURIComponent(projectDeliveryOutcomeMatch[1]!) as ProjectId;
      const outcome = await state.customerSuccess?.getDeliveryOutcome(ProjectIdSchema.parse(projectId));
      if (!outcome) {
        sendJson(res, 404, { error: `Delivery outcome not found for project ${projectId}` });
        return;
      }
      sendJson(res, 200, outcome);
      return;
    }

    const customerSupportCasesMatch = path.match(/^\/v1\/customers\/([^/]+)\/support-cases$/);
    if (customerSupportCasesMatch && req.method === 'GET') {
      const customerId = decodeURIComponent(customerSupportCasesMatch[1]!) as CustomerId;
      const cases = (await state.customerSuccess?.listSupportCases(CustomerIdSchema.parse(customerId))) ?? [];
      sendJson(res, 200, { supportCases: cases });
      return;
    }

    if (customerSupportCasesMatch && req.method === 'POST') {
      const customerId = decodeURIComponent(customerSupportCasesMatch[1]!) as CustomerId;
      const body = await readJsonBody<{
        projectId?: string;
        title?: string;
        description?: string;
        severity?: SupportCaseSeverity;
        reportedBy?: string;
        assignedSpecialist?: string;
        slaHours?: number;
      }>(req);
      if (!body.title || !body.description || !body.severity || !body.reportedBy) {
        sendJson(res, 400, { error: 'title, description, severity, and reportedBy are required' });
        return;
      }
      try {
        const supportCase = await state.customerSuccess!.createSupportCase({
          customerId: CustomerIdSchema.parse(customerId),
          projectId: body.projectId ? ProjectIdSchema.parse(body.projectId) : undefined,
          title: body.title,
          description: body.description,
          severity: body.severity,
          reportedBy: body.reportedBy,
          assignedSpecialist: body.assignedSpecialist,
          slaHours: body.slaHours,
        });
        sendJson(res, 201, supportCase);
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    const supportCaseResolveMatch = path.match(/^\/v1\/support-cases\/([^/]+)\/resolve$/);
    if (supportCaseResolveMatch && req.method === 'POST') {
      const caseId = decodeURIComponent(supportCaseResolveMatch[1]!) as CaseId;
      const body = await readJsonBody<{
        resolutionSummary?: string;
        resolvedAt?: string;
      }>(req);
      if (!body.resolutionSummary) {
        sendJson(res, 400, { error: 'resolutionSummary is required' });
        return;
      }
      try {
        const resolved = await state.customerSuccess!.resolveSupportCase(CaseIdSchema.parse(caseId), {
          resolutionSummary: body.resolutionSummary,
          resolvedAt: body.resolvedAt,
        });
        sendJson(res, 200, resolved);
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    const customerFeedbackMatch = path.match(/^\/v1\/customers\/([^/]+)\/feedback$/);
    if (customerFeedbackMatch && req.method === 'GET') {
      const customerId = decodeURIComponent(customerFeedbackMatch[1]!) as CustomerId;
      const feedback = (await state.customerSuccess?.listFeedback(CustomerIdSchema.parse(customerId))) ?? [];
      sendJson(res, 200, { feedback });
      return;
    }

    if (customerFeedbackMatch && req.method === 'POST') {
      const customerId = decodeURIComponent(customerFeedbackMatch[1]!) as CustomerId;
      const body = await readJsonBody<{
        projectId?: string;
        npsScore?: number;
        csatScore?: number;
        sentiment?: FeedbackSentiment;
        category?: FeedbackCategory;
        feedbackText?: string;
        actionableQuotes?: string[];
      }>(req);
      if (!body.projectId || body.npsScore === undefined || body.csatScore === undefined || !body.sentiment || !body.category || !body.feedbackText) {
        sendJson(res, 400, { error: 'projectId, npsScore, csatScore, sentiment, category, and feedbackText are required' });
        return;
      }
      try {
        const fb = await state.customerSuccess!.recordFeedback({
          customerId: CustomerIdSchema.parse(customerId),
          projectId: ProjectIdSchema.parse(body.projectId),
          npsScore: body.npsScore,
          csatScore: body.csatScore,
          sentiment: body.sentiment,
          category: body.category,
          feedbackText: body.feedbackText,
          actionableQuotes: body.actionableQuotes,
        });
        sendJson(res, 201, fb);
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    const projectFinancialsMatch = path.match(/^\/v1\/projects\/([^/]+)\/financials$/);
    if (projectFinancialsMatch && req.method === 'GET') {
      const projectId = decodeURIComponent(projectFinancialsMatch[1]!) as ProjectId;
      const summary = await state.customerSuccess?.getFinancialSummary(ProjectIdSchema.parse(projectId));
      if (!summary) {
        sendJson(res, 404, { error: `Financial summary not found for project ${projectId}` });
        return;
      }
      sendJson(res, 200, summary);
      return;
    }

    if (projectFinancialsMatch && req.method === 'POST') {
      const projectId = decodeURIComponent(projectFinancialsMatch[1]!) as ProjectId;
      const body = await readJsonBody<{
        customerId?: string;
        contractRevenue?: number;
        recognizedRevenue?: number;
        invoicedAmount?: number;
        collectedAmount?: number;
        costs?: Partial<FinancialCosts>;
      }>(req);
      if (!body.customerId || body.contractRevenue === undefined || !body.costs) {
        sendJson(res, 400, { error: 'customerId, contractRevenue, and costs are required' });
        return;
      }
      try {
        const summary = await state.customerSuccess!.calculateFinancialSummary({
          projectId: ProjectIdSchema.parse(projectId),
          customerId: CustomerIdSchema.parse(body.customerId),
          contractRevenue: body.contractRevenue,
          recognizedRevenue: body.recognizedRevenue,
          invoicedAmount: body.invoicedAmount,
          collectedAmount: body.collectedAmount,
          costs: body.costs,
        });
        sendJson(res, 201, summary);
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    const customerGetMatch = path.match(/^\/v1\/customers\/([^/]+)$/);
    if (customerGetMatch && req.method === 'GET') {
      const customerId = decodeURIComponent(customerGetMatch[1]!) as CustomerId;
      const customer = await state.customerSuccess?.getCustomer(CustomerIdSchema.parse(customerId));
      if (!customer) {
        sendJson(res, 404, { error: `Customer not found: ${customerId}` });
        return;
      }
      sendJson(res, 200, customer);
      return;
    }

    if (path === '/v1/learnings' && req.method === 'GET') {
      const category = url.searchParams.get('category') as LearningCategory | null;
      const learnings = (await state.customerSuccess?.listLearnings(category ?? undefined)) ?? [];
      sendJson(res, 200, { learnings });
      return;
    }

    if (path === '/v1/learnings' && req.method === 'POST') {
      const body = await readJsonBody<{
        sourceType?: LearningSourceType;
        projectId?: string;
        customerId?: string;
        opportunityId?: string;
        title?: string;
        category?: LearningCategory;
        keyInsight?: string;
        recommendedActions?: string[];
        impactOnFutureEstimates?: {
          suggestedPriceMultiplier?: number;
          riskFactorAdjustment?: number;
        };
      }>(req);
      if (!body.sourceType || !body.title || !body.category || !body.keyInsight || !body.recommendedActions) {
        sendJson(res, 400, { error: 'sourceType, title, category, keyInsight, and recommendedActions are required' });
        return;
      }
      try {
        const learning = await state.customerSuccess!.extractLearning({
          sourceType: body.sourceType,
          projectId: body.projectId ? ProjectIdSchema.parse(body.projectId) : undefined,
          customerId: body.customerId ? CustomerIdSchema.parse(body.customerId) : undefined,
          opportunityId: body.opportunityId,
          title: body.title,
          category: body.category,
          keyInsight: body.keyInsight,
          recommendedActions: body.recommendedActions,
          impactOnFutureEstimates: body.impactOnFutureEstimates,
        });
        sendJson(res, 201, learning);
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    if (path === '/v1/opportunity-calibration' && req.method === 'GET') {
      const calibration = (await state.customerSuccess?.getOpportunityCalibration()) ?? {
        completedDeliveriesCount: 0,
        successRatePercent: 100,
        averageMarginPercent: 70,
        recommendedPriceMultiplier: 1.0,
        overallCustomerHealthScore: 100,
        activeLearningsCount: 0,
        activeLearnings: [],
        calibratedAt: new Date().toISOString(),
      };
      sendJson(res, 200, { calibration });
      return;
    }

    // ---------------------------------------------------------------------------
    // Autonomous Company Loop & CEO Command Center Overview
    // ---------------------------------------------------------------------------

    if (path === '/v1/company/overview' && req.method === 'GET') {
      try {
        if (!state.companyLoop) {
          sendJson(res, 503, { error: 'Company loop subsystem not initialized' });
          return;
        }
        const overview = await state.companyLoop.generateCompanyOverview();
        sendJson(res, 200, { overview });
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    if (path === '/v1/company/loop/run' && req.method === 'POST') {
      try {
        if (!state.companyLoop) {
          sendJson(res, 503, { error: 'Company loop subsystem not initialized' });
          return;
        }
        const body = (await readJsonBody(req)) as RunCycleInput;
        const cycle = await state.companyLoop.runCycle(body);
        sendJson(res, 201, { cycle });
      } catch (err) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    if (path === '/v1/company/loop/cycles' && req.method === 'GET') {
      if (!state.companyLoop) {
        sendJson(res, 503, { error: 'Company loop subsystem not initialized' });
        return;
      }
      const cycles = state.companyLoop.listCycles();
      sendJson(res, 200, { cycles });
      return;
    }

    const loopCycleMatch = path.match(/^\/v1\/company\/loop\/cycles\/([^/]+)$/);
    if (loopCycleMatch && req.method === 'GET') {
      const cycleId = decodeURIComponent(loopCycleMatch[1]!);
      const cycle = state.companyLoop?.getCycle(cycleId);
      if (!cycle) {
        sendJson(res, 404, { error: `No company loop cycle found with id ${cycleId}` });
        return;
      }
      sendJson(res, 200, { cycle });
      return;
    }

    // Artifact Runtime (@umer/artifacts) — read-only. Sealed by whichever
    // ArtifactEngine a live agent worker uses; this store is control-api's
    // own instance, so it's honestly empty until wired to that same engine.
    if (path === '/v1/artifacts' && req.method === 'GET') {
      const execId = url.searchParams.get('execId') ?? undefined;
      const all = (await state.artifactStore?.list()) ?? [];
      const filtered = execId ? all.filter((a) => a.producedFor === execId) : all;
      sendJson(res, 200, { artifacts: filtered });
      return;
    }

    const artifactMatch = path.match(/^\/v1\/artifacts\/([^/]+)$/);
    if (artifactMatch && req.method === 'GET') {
      const artifactId = decodeURIComponent(artifactMatch[1]!);
      const artifact = await state.artifactStore?.get(artifactId);
      if (!artifact) {
        sendJson(res, 404, { error: `No artifact known for id ${artifactId}` });
        return;
      }
      sendJson(res, 200, artifact);
      return;
    }

    // CEO Command & Decision Plane — the sanctioned write path for Opportunity
    // / Project / Task / Agent-control state. This route only translates the
    // HTTP request into a CeoCommandEnvelope; every business rule (allowed
    // transitions, idempotency, authorization) lives in
    // CeoCommandService.execute (@umer/control-plane), not here.
    //
    // `body.actor` is trusted client-supplied identity, not a verified
    // session — there is no authentication layer in front of this route yet
    // (@umer/auth is still a skeleton). The intended future shape is:
    //   HTTP authentication -> authenticated principal -> CeoCommandEnvelope
    //   -> TrustRuntime.authorize -> command handler
    // i.e. a real auth layer replaces this trusted `body.actor` with a
    // verified principal and nothing downstream of that point changes —
    // CeoCommandService already treats `actor` as an opaque, pre-authenticated
    // input and asks TrustRuntime to authorize it on every command.
    if (path === '/v1/commands' && req.method === 'POST') {
      const body = await readJsonBody<{
        commandId?: string;
        name?: CeoCommandName;
        payload?: Record<string, unknown>;
        actor?: { principalId?: string; kind?: ActorKind };
        target?: CommandTarget;
        correlationId?: string;
        idempotencyKey?: string;
      }>(req);

      if (!body.name || !body.actor?.principalId || !body.actor?.kind) {
        sendJson(res, 400, {
          error: 'MALFORMED_PAYLOAD',
          message: 'name and actor{principalId,kind} are required',
        });
        return;
      }
      if (!state.commandService) {
        sendJson(res, 503, { error: 'command_service_unavailable' });
        return;
      }

      const commandId = body.commandId ?? `cmd-${randomUUID()}`;
      const correlationId = body.correlationId ?? `corr-${commandId}`;
      // Built as a plain object, not typed CeoCommandEnvelope directly: the
      // branded id types (CorrelationIdSchema etc.) can only be produced by
      // zod's own .parse — CeoCommandService.execute does that validation as
      // its first step (safeParse), so this route doesn't duplicate it.
      const envelope = {
        commandId,
        schemaVersion: SCHEMA_VERSION,
        name: body.name,
        issuedAt: new Date().toISOString(),
        correlationId,
        producer: 'control-api',
        payload: body.payload ?? {},
        idempotencyKey: body.idempotencyKey,
        actor: { principalId: body.actor.principalId, kind: body.actor.kind },
        target: body.target,
      } as unknown as CeoCommandEnvelope;

      try {
        const result = await state.commandService.execute(envelope);
        sendJson(res, result.status === 'applied' ? 201 : 200, result);
      } catch (err) {
        if (err instanceof CommandError) {
          const status = err.code === 'UNAUTHORIZED' ? 403 : err.code === 'NOT_FOUND' ? 404 : 400;
          sendJson(res, status, { error: err.code, message: err.message });
          return;
        }
        sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    if (path === '/v1/gates/pending' && req.method === 'GET') {
      sendJson(res, 200, { gates: await state.controlPlane.listPending() });
      return;
    }

    if (path === '/v1/audit/recent' && req.method === 'GET') {
      sendJson(res, 200, { records: await listRecentAudit(state) });
      return;
    }

    // What am I approving? Per-file diff, who authored it, and what Pass will do.
    const reviewMatch = path.match(/^\/v1\/gates\/([^/]+)\/review$/);
    if (reviewMatch && req.method === 'GET') {
      const waitId = reviewMatch[1]!;
      const gate = (await state.controlPlane.listPending()).find(
        (item) => item.waitId === waitId,
      );
      if (!gate) {
        sendJson(res, 404, { error: 'gate_not_pending', waitId });
        return;
      }
      const artifacts = state.artifactStore ? await state.artifactStore.list() : undefined;
      const review = buildGateReview({
        gate,
        intakes: state.intakes,
        workPackages: state.workPackages,
        artifacts,
        projectRegistry: state.projectRegistry,
      });
      if (!review) {
        sendJson(res, 404, { error: 'no_intake_for_gate', waitId });
        return;
      }
      sendJson(res, 200, { review });
      return;
    }

    const resolveMatch = path.match(/^\/v1\/gates\/([^/]+)\/resolve$/);
    if (resolveMatch && req.method === 'POST') {
      const waitId = resolveMatch[1]!;
      const body = await readJsonBody<{
        decision?: 'Pass' | 'Fail';
        approver?: string;
        rationale?: string;
      }>(req);
      if (!body.decision || !body.approver || !body.rationale) {
        sendJson(res, 400, { error: 'decision, approver, and rationale are required' });
        return;
      }
      try {
        const result = await state.controlPlane.resolveGate(
          waitId,
          {
            decision: body.decision,
            approver: body.approver,
            rationale: body.rationale,
          },
          `corr-resolve-${waitId}`,
        );
        const wp = state.workPackages.find(
          (item) => item.workPackageId === result.record.workPackageId,
        );
        if (wp) {
          wp.status = body.decision === 'Pass' ? 'Accepted' : 'Rejected';
        }

        // gate-wp-* gates are the ones runtime-work-package-bridge.ts opened
        // for a genuinely-dispatched Work Package (real Orchestrator +
        // AgentWorker run, not the simulated audit-pipeline intakes below).
        // The CEO's decision here is only real once the actual Orchestrator
        // (apps/orchestration-worker, a separate process) applies it to its
        // own authoritative Work Package record — publish the same
        // workpackage.accept/reject command its OrchestrationWorker already
        // handles (packages/orchestration/src/worker.ts).
        let runtimeSync: 'accepted' | 'rejected' | 'unavailable' | null = null;
        if (result.record.gateId.startsWith('gate-wp-')) {
          if (state.fabric) {
            const commandName =
              body.decision === 'Pass' ? ORCHESTRATION_COMMANDS.ACCEPT : ORCHESTRATION_COMMANDS.REJECT;
            const command = createCommandEnvelope({
              name: commandName,
              producer: 'control-api',
              correlationId: `corr-resolve-${waitId}`,
              idempotencyKey: `${waitId}:${commandName}`,
              payload:
                body.decision === 'Pass'
                  ? { workPackageId: result.record.workPackageId }
                  : { workPackageId: result.record.workPackageId, reason: body.rationale },
            });
            try {
              await state.fabric.publishCommand(SUBJECTS.CMD_ORCHESTRATION, command);
              runtimeSync = body.decision === 'Pass' ? 'accepted' : 'rejected';
            } catch (err) {
              log.warn(
                {
                  workPackageId: result.record.workPackageId,
                  err: err instanceof Error ? err.message : String(err),
                },
                'gate resolved but failed to sync decision back to the Orchestrator',
              );
              runtimeSync = 'unavailable';
            }
          } else {
            runtimeSync = 'unavailable';
          }
        }

        await state.auditService.append(
          {
            action: 'gate.decide',
            actor: body.approver,
            resourceType: 'approval',
            resourceId: result.record.gateId,
            outcome: body.decision === 'Pass' ? 'success' : 'failure',
            correlationId: `corr-resolve-${waitId}`,
            detail: { waitId, rationale: body.rationale },
          },
          `corr-resolve-${waitId}`,
        );

        let applyResult: unknown;
        if (body.decision === 'Pass') {
          applyResult =
            (await applySeoOnGatePass(state, {
              workPackageId: result.record.workPackageId,
              gateId: result.record.gateId,
              rationale: body.rationale,
            })) ??
            (await applyQaOnGatePass(state, {
              workPackageId: result.record.workPackageId,
              gateId: result.record.gateId,
              rationale: body.rationale,
            })) ??
            (await applySecurityOnGatePass(state, {
              workPackageId: result.record.workPackageId,
              gateId: result.record.gateId,
              rationale: body.rationale,
            })) ??
            (await applyPerfOnGatePass(state, {
              workPackageId: result.record.workPackageId,
              gateId: result.record.gateId,
              rationale: body.rationale,
            })) ??
            (await applyUxOnGatePass(state, {
              workPackageId: result.record.workPackageId,
              gateId: result.record.gateId,
              rationale: body.rationale,
            })) ??
            (await applyEngOnGatePass(state, {
              workPackageId: result.record.workPackageId,
              gateId: result.record.gateId,
              rationale: body.rationale,
              approver: body.approver,
            }));
        }

        sendJson(res, 200, { ...result, applyResult: applyResult ?? null, runtimeSync });
      } catch (err) {
        sendJson(res, 400, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    // ---------------------------------------------------------------------------
    // Company Intelligence Graph — Read-Model Projection
    //
    // Aggregates all existing authoritative domain stores (Opportunities,
    // Projects, Agents, Deals, Customers, etc.) into a canonical read-model
    // graph for CEO-level visualization.  This route never writes state and
    // never fabricates data — every node and edge comes from real domain state.
    //
    // Supports query params for server-side filtering (before the payload is
    // sent to the browser) so large company graphs remain performant.
    // ---------------------------------------------------------------------------
    if (path === '/v1/company/graph' && req.method === 'GET') {
      try {
        const nodeTypesParam = url.searchParams.get('nodeTypes');
        const searchParam = url.searchParams.get('search');
        const statusParam = url.searchParams.get('status');
        const activeOnlyParam = url.searchParams.get('active') ?? url.searchParams.get('activeOnly');
        const blockedParam = url.searchParams.get('blocked');
        const limitParam = url.searchParams.get('limit');
        const depthParam = url.searchParams.get('depth'); // reserved for future neighborhood expansion

        const filterOptions: GraphFilterOptions = {
          projectId: url.searchParams.get('projectId') ?? undefined,
          opportunityId: url.searchParams.get('opportunityId') ?? undefined,
          agentId: url.searchParams.get('agentId') ?? undefined,
          customerId: url.searchParams.get('customerId') ?? undefined,
          status: statusParam && statusParam.trim().length > 0 ? statusParam.trim() : undefined,
          search: searchParam && searchParam.trim().length > 0 ? searchParam.trim() : undefined,
          activeOnly: activeOnlyParam === 'true' || activeOnlyParam === '1',
          blockedOnly: blockedParam === 'true' || blockedParam === '1',
          limit: limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 1000) : 200,
          nodeTypes: nodeTypesParam
            ? (nodeTypesParam.split(',').map((t) => t.trim()).filter(Boolean) as GraphNodeType[])
            : undefined,
        };

        // depth is accepted but reserved — future: walk the graph N hops from
        // focal nodes rather than returning the global projection.
        void depthParam; // intentionally unused until neighborhood expansion is wired

        const graph = await buildCompanyGraph(state, filterOptions);
        sendJson(res, 200, graph);
      } catch (err) {
        sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    sendJson(res, 404, { error: 'not_found', path });
  });
}

export async function bootstrapDemoState(state: ControlApiState): Promise<void> {
  await seedDemoState(state);
}
