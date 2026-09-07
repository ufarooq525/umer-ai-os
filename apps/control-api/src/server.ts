import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { healthCheck } from '@umer/kernel';
import { loadEnv } from '@umer/config';
import {
  createCeoCommandService,
  createControlPlaneService,
  CommandError,
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
} from '@umer/contracts';
import {
  createLogger,
  InMemoryAgentRegistryStore,
  InMemoryAgentRunReadModelStore,
} from '@umer/observability';
import { InMemoryOpportunityPersistence, buildBusinessIdentity } from '@umer/opportunity-intelligence';
import type { DiscoveryCandidateRecord } from '@umer/contracts';
import { InMemoryArtifactStore } from '@umer/artifacts';
import { routeIntakeGoal, type IntakeInstruction } from '@umer/registry';
import { InMemoryProjectStore } from './project-store.js';
import { InMemoryTaskStore } from './task-store.js';
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

export async function createControlApiState(): Promise<ControlApiState> {
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
    opportunityReader: new InMemoryOpportunityPersistence(),
    artifactStore: new InMemoryArtifactStore(),
    workGraphStore: new InMemoryWorkGraphStore(),
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
    },
    { trust: trustRuntime, auditService },
  );
  state.controlPlane = createControlPlaneService({
    workPackagesAwaitingReview: () =>
      state.workPackages.filter((wp) => wp.status === 'AwaitingReview').length,
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
        const description = `Deliver "${node.title}" for project ${projectId}, per its Work Graph decomposition.`;
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
            acceptanceCriteria: [`${node.title} artifact accepted by human review`],
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
      const review = buildGateReview({ gate, intakes: state.intakes });
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

    sendJson(res, 404, { error: 'not_found', path });
  });
}

export async function bootstrapDemoState(state: ControlApiState): Promise<void> {
  await seedDemoState(state);
}
