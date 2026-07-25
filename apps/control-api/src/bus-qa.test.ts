import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import { createAuditService } from '@umer/audit';
import { createControlPlaneService } from '@umer/control-plane';
import { createEventBus } from '@umer/event-bus';
import {
  createControlApiServer,
  createControlApiState,
} from './server.js';
import {
  publishQaViaBus,
  registerQaBusShim,
  submitIntake,
  type ControlApiState,
} from './state.js';

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

describe('QA bus shim', () => {
  let state: ControlApiState;
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

  it('human QA intake still creates gate-qa-* with humanRequired via the bus', async () => {
    const intake = await request(server, 'POST', '/v1/intake', {
      projectId: 'school-app',
      type: 'qa',
      goal: 'Full functional and non-functional UI verification',
      doneWhen: 'P0 items evidenced',
    });
    expect(intake.status).toBe(201);

    const record = intake.json as {
      plan: { qaAudit?: { specialistId: string; items: unknown[] } };
      trigger?: { source: { kind: string; channel?: string }; eventId: string };
    };
    expect(record.plan.qaAudit?.specialistId).toBe('qa.verify');
    expect((record.plan.qaAudit?.items.length ?? 0) > 8).toBe(true);
    expect(record.trigger?.source).toEqual({
      kind: 'human.intake',
      actorId: 'human.operator',
      channel: 'control-api',
    });

    const pending = await request(server, 'GET', '/v1/gates/pending');
    const qaGate = (
      pending.json.gates as Array<{ gateId: string; humanRequired: boolean }>
    ).find((g) => g.gateId === 'gate-qa-school-app');
    expect(qaGate).toBeTruthy();
    expect(qaGate!.humanRequired).toBe(true);

    const history = state.bus.listHistory({
      type: 'specialist.qa.requested',
      projectId: 'school-app',
    });
    expect(history).toHaveLength(1);
    expect(history[0]?.source.kind).toBe('human.intake');
  });

  it('nightly watchdog publish creates the same gate-qa-* shape with watchdog source', async () => {
    const record = await publishQaViaBus(state, {
      projectId: 'school-app',
      goal: 'Nightly functional + NFR sweep',
      doneWhen: 'P0 items evidenced',
      source: {
        kind: 'watchdog',
        watchdogId: 'qa.watchdog',
        cadence: 'nightly',
        scheduleId: 'sched-qa-nightly-school-app',
        tickId: 'tick-2026-07-25',
      },
    });

    expect(record.plan.qaAudit?.specialistId).toBe('qa.verify');
    expect(record.trigger?.source).toEqual({
      kind: 'watchdog',
      watchdogId: 'qa.watchdog',
      cadence: 'nightly',
      scheduleId: 'sched-qa-nightly-school-app',
      tickId: 'tick-2026-07-25',
    });

    const pending = await state.controlPlane.listPending();
    const qaGate = pending.find((g) => g.gateId === 'gate-qa-school-app');
    expect(qaGate).toBeTruthy();
    expect(qaGate!.humanRequired).toBe(true);
    expect(qaGate!.stageFrom).toBe('QA Verify');

    const audits = await state.auditService.query();
    const requested = audits.find(
      (a) =>
        a.action === 'control.approval.requested' &&
        (a.detail as { triggerEventId?: string } | undefined)?.triggerEventId ===
          record.trigger?.eventId,
    );
    expect(requested).toBeTruthy();
    expect((requested!.detail as { source: { kind: string } }).source.kind).toBe('watchdog');
  });
});

describe('QA bus shim registration', () => {
  it('fails closed when no QA subscriber is registered', async () => {
    const projectRegistry = (await createControlApiState()).projectRegistry;
    const orphan: ControlApiState = {
      workPackages: [],
      intakes: [],
      auditService: createAuditService(),
      projectRegistry,
      controlPlane: createControlPlaneService({
        workPackagesAwaitingReview: () => 0,
      }),
      bus: createEventBus(),
    };
    // Intentionally skip registerQaBusShim.
    await expect(
      submitIntake(orphan, {
        projectId: 'school-app',
        type: 'qa',
        goal: 'Should fail without shim',
      }),
    ).rejects.toThrow(/QA bus shim not registered/);
  });

  it('registerQaBusShim is idempotent', async () => {
    const state = await createControlApiState();
    registerQaBusShim(state);
    registerQaBusShim(state);
    const record = await publishQaViaBus(state, {
      projectId: 'school-app',
      goal: 'Idempotent shim registration check',
      source: {
        kind: 'system',
        componentId: 'test',
        reason: 'idempotency probe',
      },
    });
    expect(record.plan.type).toBe('qa');
    expect(state.intakes).toHaveLength(1);
    expect(
      state.bus.listHistory({ type: 'specialist.qa.requested', projectId: 'school-app' }),
    ).toHaveLength(1);
  });
});
