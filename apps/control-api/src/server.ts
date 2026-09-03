import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { healthCheck } from '@umer/kernel';
import { createControlPlaneService, type ControlPlaneService } from '@umer/control-plane';
import { createAuditService } from '@umer/audit';
import { createEventBus } from '@umer/event-bus';
import type { ProjectStatus, TaskStatus } from '@umer/contracts';
import { InMemoryAgentRegistryStore, InMemoryAgentRunReadModelStore } from '@umer/observability';
import { InMemoryOpportunityPersistence } from '@umer/opportunity-intelligence';
import { routeIntakeGoal, type IntakeInstruction } from '@umer/registry';
import { InMemoryProjectStore } from './project-store.js';
import { InMemoryTaskStore } from './task-store.js';
import {
  type ControlApiState,
  applyEngOnGatePass,
  applyQaOnGatePass,
  applySecurityOnGatePass,
  applyPerfOnGatePass,
  applyUxOnGatePass,
  applySeoOnGatePass,
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
  const state: ControlApiState = {
    workPackages: [],
    intakes: [],
    auditService: createAuditService(),
    projectRegistry: await loadProjectRegistry(),
    controlPlane: null as unknown as ControlPlaneService,
    bus: createEventBus(),
    codeProducer: producer,
    agentRunReadModel: new InMemoryAgentRunReadModelStore(),
    agentRegistry: new InMemoryAgentRegistryStore(),
    projectStore: new InMemoryProjectStore(),
    taskStore: new InMemoryTaskStore(),
    opportunityReader: new InMemoryOpportunityPersistence(),
  };
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
    // endpoints (implementation/COMPANY_OPERATING_MODEL.md). All read-only in
    // this milestone — no write/POST routes yet (Phase E scope).

    if (path === '/v1/agents' && req.method === 'GET') {
      const statusParam = url.searchParams.get('status');
      const status =
        statusParam === 'idle' || statusParam === 'active' || statusParam === 'blocked' || statusParam === 'offline'
          ? statusParam
          : undefined;
      const department = url.searchParams.get('department') ?? undefined;
      const specialistId = url.searchParams.get('specialist') ?? undefined;
      const agents = (await state.agentRegistry?.list({ status, department, specialistId })) ?? [];
      sendJson(res, 200, { agents: await Promise.all(agents.map((agent) => enrichAgentWithProject(state, agent))) });
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
      sendJson(res, 200, await enrichAgentWithProject(state, agent));
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

        sendJson(res, 200, { ...result, applyResult: applyResult ?? null });
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
