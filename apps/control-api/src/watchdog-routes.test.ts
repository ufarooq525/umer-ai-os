import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { createControlApiServer, createControlApiState } from './server.js';
import type { ControlApiState } from './state.js';

type JsonResponse = Record<string, unknown> & {
  schedules?: Array<{ id: string; watchdogId: string; projectId: string; paused: boolean }>;
  findings?: Array<{ findingId: string; status: string; ackedBy?: string; clearanceReason?: string }>;
  runs?: Array<{ runId: string; watchdogId: string }>;
  runId?: string;
  watchdogId?: string;
  findingId?: string;
  status?: string;
  ackedBy?: string;
  clearanceReason?: string;
  paused?: boolean;
  count?: number;
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
  const text = await response.text();
  let json: JsonResponse = {};
  try {
    json = JSON.parse(text) as JsonResponse;
  } catch {
    // text
  }
  return { status: response.status, json };
}

describe('Watchdog Routes (RFC-007)', () => {
  let state: ControlApiState;
  let server: Server;

  beforeEach(async () => {
    state = await createControlApiState();
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('lists default pre-seeded schedules for active projects', async () => {
    const { status, json } = await request(server, 'GET', '/v1/watchdogs/schedules');
    expect(status).toBe(200);
    expect(json.schedules).toBeDefined();
    expect(Array.isArray(json.schedules)).toBe(true);
    expect(json.count).toBeGreaterThan(0);

    const secSchedule = json.schedules?.find((s) => s.watchdogId === 'security.watchdog');
    expect(secSchedule).toBeDefined();
    expect(secSchedule?.paused).toBe(false);
  });

  it('patches a schedule to paused and back', async () => {
    const listRes = await request(server, 'GET', '/v1/watchdogs/schedules');
    const firstSchedule = listRes.json.schedules![0]!;

    const patchRes = await request(
      server,
      'PATCH',
      `/v1/watchdogs/schedules/${encodeURIComponent(firstSchedule.id)}`,
      { paused: true },
    );
    expect(patchRes.status).toBe(200);
    expect(patchRes.json.paused).toBe(true);

    const getRes = await request(
      server,
      'GET',
      `/v1/watchdogs/schedules?projectId=${firstSchedule.projectId}`,
    );
    const updated = getRes.json.schedules?.find((s) => s.id === firstSchedule.id);
    expect(updated?.paused).toBe(true);
  });

  it('executes an on-demand watchdog run and queries runs and findings', async () => {
    const projects = state.projectRegistry.list();
    const active = projects.find((p) => p.status === 'active');
    expect(active).toBeDefined();

    // 1. Trigger on-demand watch run
    const runRes = await request(server, 'POST', '/v1/watchdogs/run', {
      projectId: active!.projectId,
      watchdogId: 'deps.watchdog',
      cadence: 'manual',
    });
    expect(runRes.status).toBe(201);
    expect(runRes.json.runId).toBeDefined();
    expect(runRes.json.watchdogId).toBe('deps.watchdog');

    // 2. Query runs
    const runsListRes = await request(server, 'GET', `/v1/watchdogs/runs?projectId=${active!.projectId}`);
    expect(runsListRes.status).toBe(200);
    expect(runsListRes.json.count).toBeGreaterThanOrEqual(1);

    // 3. Query findings
    const findingsRes = await request(server, 'GET', `/v1/watchdogs/findings?projectId=${active!.projectId}`);
    expect(findingsRes.status).toBe(200);
    expect(Array.isArray(findingsRes.json.findings)).toBe(true);

    if (findingsRes.json.findings.length > 0) {
      const firstFinding = findingsRes.json.findings[0];

      // 4. Get specific finding
      const singleRes = await request(
        server,
        'GET',
        `/v1/watchdogs/findings/${encodeURIComponent(firstFinding.findingId)}`,
      );
      expect(singleRes.status).toBe(200);
      expect(singleRes.json.findingId).toBe(firstFinding.findingId);

      // 5. Ack finding
      const ackRes = await request(
        server,
        'POST',
        `/v1/watchdogs/findings/${encodeURIComponent(firstFinding.findingId)}/ack`,
        { actor: 'ceo.operator' },
      );
      expect(ackRes.status).toBe(200);
      expect(ackRes.json.status).toBe('acked');
      expect(ackRes.json.ackedBy).toBe('ceo.operator');

      // 6. Clear finding
      const clearRes = await request(
        server,
        'POST',
        `/v1/watchdogs/findings/${encodeURIComponent(firstFinding.findingId)}/clear`,
        { actor: 'security.lead', reason: 'Audit verified exception' },
      );
      expect(clearRes.status).toBe(200);
      expect(clearRes.json.status).toBe('cleared');
      expect(clearRes.json.clearanceReason).toBe('Audit verified exception');
    }
  });

  it('deduplicates findings across consecutive runs by updating lastSeenAt', async () => {
    const projects = state.projectRegistry.list();
    const active = projects.find((p) => p.status === 'active');
    expect(active).toBeDefined();

    // First run
    await request(server, 'POST', '/v1/watchdogs/run', {
      projectId: active!.projectId,
      watchdogId: 'deps.watchdog',
    });

    const initialFindings = await request(
      server,
      'GET',
      `/v1/watchdogs/findings?projectId=${active!.projectId}&status=open`,
    );
    const initialCount = initialFindings.json.count;

    // Second run with same watchdog & project
    await request(server, 'POST', '/v1/watchdogs/run', {
      projectId: active!.projectId,
      watchdogId: 'deps.watchdog',
    });

    const secondFindings = await request(
      server,
      'GET',
      `/v1/watchdogs/findings?projectId=${active!.projectId}&status=open`,
    );
    // Count of open findings should not double due to fingerprint deduplication
    expect(secondFindings.json.count).toBe(initialCount);
  });
});
