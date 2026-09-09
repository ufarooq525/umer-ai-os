import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { DeploymentEngine } from '@umer/registry';
import { createControlApiServer, createControlApiState } from './server.js';
import type { ControlApiState } from './state.js';

type JsonResponse = {
  error?: string;
  projectId?: string;
  productionStatus?: {
    status?: string;
    currentVersion?: string;
    activeIncidents?: number;
  };
  deployments?: unknown[];
  incidents?: unknown[];
  deployment?: {
    deploymentId: string;
    status: string;
    healthStatus: string;
  };
  incident?: {
    incidentId: string;
    severity: string;
    summary: string;
  };
};

async function request(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: JsonResponse }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server not listening');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: (await response.json()) as JsonResponse };
}

describe('Deployment & Operations Routes (M7)', () => {
  let state: ControlApiState;
  let server: Server;

  beforeEach(async () => {
    state = await createControlApiState();
    state.deploymentEngine = new DeploymentEngine({
      probeRunner: async (probe) => ({
        status: 'pass',
        responseTimeMs: 15,
        message: `${probe.service} is reachable and responding OK`,
      }),
      rollbackRunner: async () => ({
        status: 'success',
      }),
    });
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('GET /v1/projects/:projectId/production returns honest offline initial state', async () => {
    const { status, json } = await request(server, 'GET', '/v1/projects/proj-test/production');
    expect(status).toBe(200);
    expect(json.projectId).toBe('proj-test');
    expect(json.productionStatus).toBeDefined();
    expect(json.productionStatus?.status).toBe('offline');
    expect(json.productionStatus?.currentVersion).toBeUndefined();
    expect(json.productionStatus?.activeIncidents).toBe(0);
    expect(json.deployments).toEqual([]);
    expect(json.incidents).toEqual([]);
  });

  it('POST /v1/projects/:projectId/deploy validates required parameters', async () => {
    const { status, json } = await request(server, 'POST', '/v1/projects/proj-test/deploy', {
      targetVersion: '1.0.0',
    });
    expect(status).toBe(400);
    expect(json.error).toContain('releasePackageId');
  });

  it('POST /v1/projects/:projectId/deploy executes deployment and updates production status', async () => {
    const { status, json } = await request(server, 'POST', '/v1/projects/proj-test/deploy', {
      releasePackageId: 'art-rel-1',
      targetVersion: '1.0.0',
      approver: 'lead.release',
      strategy: 'helm',
    });

    expect(status).toBe(200);
    expect(json.deployment).toBeDefined();
    expect(json.deployment?.status).toBe('deployed');
    expect(json.deployment?.healthStatus).toBe('healthy');
    expect(json.productionStatus).toBeDefined();
    expect(json.productionStatus?.status).toBe('healthy');
    expect(json.productionStatus?.currentVersion).toBe('1.0.0');

    // Verify GET /production now reflects the active deployment
    const prodRes = await request(server, 'GET', '/v1/projects/proj-test/production');
    expect(prodRes.status).toBe(200);
    expect(prodRes.json.productionStatus?.status).toBe('healthy');
    expect(prodRes.json.productionStatus?.currentVersion).toBe('1.0.0');
    expect(prodRes.json.deployments?.length).toBe(1);
  });

  it('POST /v1/projects/:projectId/rollback triggers rollback and records incident', async () => {
    // 1. Deploy initial version
    const deployRes = await request(server, 'POST', '/v1/projects/proj-test/deploy', {
      releasePackageId: 'art-rel-1',
      targetVersion: '1.0.0',
    });
    const deploymentId = deployRes.json.deployment?.deploymentId;
    expect(deploymentId).toBeDefined();

    // 2. Attempt rollback without parameters
    const invalidRes = await request(server, 'POST', '/v1/projects/proj-test/rollback', {});
    expect(invalidRes.status).toBe(400);

    // 3. Rollback
    const { status, json } = await request(server, 'POST', '/v1/projects/proj-test/rollback', {
      deploymentId,
      reason: 'Elevated latency on gateway probes',
      triggeredBy: 'sre.operations',
    });

    expect(status).toBe(200);
    expect(json.deployment?.status).toBe('rolled_back');
    expect(json.incident).toBeDefined();
    expect(json.incident?.severity).toBe('P1');
    expect(json.incident?.summary).toContain('Elevated latency');

    // 4. Verify GET /production shows degraded state and incident
    const prodRes = await request(server, 'GET', '/v1/projects/proj-test/production');
    expect(prodRes.json.productionStatus?.status).toBe('degraded');
    expect(prodRes.json.productionStatus?.activeIncidents).toBe(1);
    expect(prodRes.json.incidents?.length).toBe(1);
  });

  it('GET /v1/projects/:projectId/deployments and /incidents return lists', async () => {
    const deployRes = await request(server, 'POST', '/v1/projects/proj-test/deploy', {
      releasePackageId: 'art-rel-1',
      targetVersion: '1.0.0',
    });
    const deploymentId = deployRes.json.deployment?.deploymentId;
    expect(deploymentId).toBeDefined();

    await request(server, 'POST', '/v1/projects/proj-test/rollback', {
      deploymentId,
      reason: 'Manual smoke test rollback',
    });

    const deploys = await request(server, 'GET', '/v1/projects/proj-test/deployments');
    expect(deploys.status).toBe(200);
    expect(deploys.json.deployments?.length).toBe(1);

    const incidents = await request(server, 'GET', '/v1/projects/proj-test/incidents');
    expect(incidents.status).toBe(200);
    expect(incidents.json.incidents?.length).toBe(1);
  });

  it('POST /v1/projects/:projectId/deploy fails closed when probe runner is missing', async () => {
    state.deploymentEngine = new DeploymentEngine(); // unconfigured
    const { status, json } = await request(server, 'POST', '/v1/projects/proj-test/deploy', {
      releasePackageId: 'art-rel-fail-closed',
      targetVersion: '1.0.0',
    });
    expect(status).toBe(400);
    expect(json.error).toContain('real health probe runner');
  });

  it('POST /v1/projects/:projectId/rollback fails closed when rollback runner is missing', async () => {
    const deployment = await state.deploymentEngine!.prepareRelease({
      projectId: 'proj-test',
      releasePackageId: 'art-rel-rb',
      targetVersion: '1.0.0',
      rollbackPlan: {
        strategy: 'helm',
        targetVersion: '0.9.0',
        steps: ['helm rollback umer 1'],
        verificationCriteria: ['GET /health returns 200'],
      },
    });
    state.deploymentEngine = new DeploymentEngine(); // unconfigured, missing rollback runner
    (state.deploymentEngine as any).deploymentsById.set(deployment.deploymentId, deployment);
    const { status, json } = await request(server, 'POST', '/v1/projects/proj-test/rollback', {
      deploymentId: deployment.deploymentId,
      reason: 'Missing runner test',
    });
    expect(status).toBe(400);
    expect(json.error).toContain('real rollback runner');
  });
});
