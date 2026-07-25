import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { healthCheck } from '@umer/kernel';
import { createControlPlaneService, type ControlPlaneService } from '@umer/control-plane';
import { createAuditService } from '@umer/audit';
import type { IntakeInstruction } from '@umer/registry';
import {
  type ControlApiState,
  applyEngOnGatePass,
  applyQaOnGatePass,
  applySecurityOnGatePass,
  applySeoOnGatePass,
  listProjects,
  listRecentAudit,
  loadProjectRegistry,
  seedDemoState,
  submitIntake,
} from './state.js';

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
  const state: ControlApiState = {
    workPackages: [],
    intakes: [],
    auditService: createAuditService(),
    projectRegistry: await loadProjectRegistry(),
    controlPlane: null as unknown as ControlPlaneService,
  };
  state.controlPlane = createControlPlaneService({
    workPackagesAwaitingReview: () =>
      state.workPackages.filter((wp) => wp.status === 'AwaitingReview').length,
  });
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
      sendJson(res, 200, await state.controlPlane.dashboard());
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

    if (path === '/v1/work-packages' && req.method === 'GET') {
      sendJson(res, 200, { workPackages: state.workPackages });
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
