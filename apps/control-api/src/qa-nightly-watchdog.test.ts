import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { createControlApiServer, createControlApiState } from './server.js';
import { runQaNightlyWatchdog } from './qa-nightly-watchdog.js';
import { filterWatchdogPendingFindings } from './watchdog-findings.js';

async function request(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server not listening');
  }
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

describe('QA nightly watchdog', () => {
  let state: Awaited<ReturnType<typeof createControlApiState>>;
  let server: Server;

  beforeEach(async () => {
    state = await createControlApiState();
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('manual POST /v1/watchdogs/qa-nightly/run creates gate-qa-school-app with watchdog nightly source', async () => {
    const { status, json } = await request(server, 'POST', '/v1/watchdogs/qa-nightly/run');
    expect(status).toBe(201);
    expect(json.projectId).toBe('school-app');
    expect(json.gateId).toBe('gate-qa-school-app');
    expect(json.scheduleId).toBe('sched-qa-nightly-school-app');

    const trigger = json.trigger as {
      source: {
        kind: string;
        watchdogId: string;
        cadence: string;
        scheduleId: string;
        tickId: string;
      };
    };
    expect(trigger.source).toMatchObject({
      kind: 'watchdog',
      watchdogId: 'qa.watchdog',
      cadence: 'nightly',
      scheduleId: 'sched-qa-nightly-school-app',
    });
    expect(trigger.source.tickId).toBeTruthy();

    const pending = await state.controlPlane.listPending();
    const qaGate = pending.find((g) => g.gateId === 'gate-qa-school-app');
    expect(qaGate).toBeTruthy();
    expect(qaGate!.humanRequired).toBe(true);

    // Dashboard banner filter: source.kind === "watchdog"
    const findings = filterWatchdogPendingFindings({
      pendingGates: pending,
      intakes: state.intakes,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.gateId).toBe('gate-qa-school-app');
    expect(findings[0]?.cadence).toBe('nightly');
    expect(findings[0]?.watchdogId).toBe('qa.watchdog');

    const dashboard = await request(server, 'GET', '/v1/dashboard');
    expect(dashboard.status).toBe(200);
    expect(dashboard.json.watchdogFindingsAwaitingReview).toBe(1);
    expect(
      (dashboard.json.watchdogFindings as Array<{ gateId: string }>)[0]?.gateId,
    ).toBe('gate-qa-school-app');
  });

  it('runQaNightlyWatchdog is the shared entry used by cron and the manual endpoint', async () => {
    const result = await runQaNightlyWatchdog(state, { tickId: 'tick-test-manual' });
    expect(result.projectId).toBe('school-app');
    expect(result.tickId).toBe('tick-test-manual');
    expect(result.intake.trigger?.source).toEqual({
      kind: 'watchdog',
      watchdogId: 'qa.watchdog',
      cadence: 'nightly',
      scheduleId: 'sched-qa-nightly-school-app',
      tickId: 'tick-test-manual',
    });
  });

  it('human QA intake is not counted as a watchdog finding', async () => {
    await request(server, 'POST', '/v1/intake', {
      projectId: 'school-app',
      type: 'qa',
      goal: 'Human-driven QA intake for school-app',
      doneWhen: 'P0 evidenced',
    });

    const pending = await state.controlPlane.listPending();
    const findings = filterWatchdogPendingFindings({
      pendingGates: pending,
      intakes: state.intakes,
    });
    expect(findings).toHaveLength(0);

    const dashboard = await request(server, 'GET', '/v1/dashboard');
    expect(dashboard.json.watchdogFindingsAwaitingReview).toBe(0);
  });
});
