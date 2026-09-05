import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Server } from 'node:http';
import type { CommandEnvelope } from '@umer/contracts';
import { SUBJECTS } from '@umer/message-fabric';
import { ORCHESTRATION_COMMANDS } from '@umer/orchestration';
import { createControlApiServer, createControlApiState } from './server.js';
import type { ControlApiState } from './state.js';

async function request(
  server: Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server not listening');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

// Resolving a gate-wp-* gate is only real once the actual Orchestrator
// (a separate process, apps/orchestration-worker) applies it to its own
// authoritative Work Package record. These tests fake state.fabric so they
// don't need a live NATS broker, and assert the exact
// workpackage.accept/reject command the resolve route must publish for the
// OrchestrationWorker (packages/orchestration/src/worker.ts) to pick up.
describe('POST /v1/gates/:id/resolve — gate-wp-* runtime sync', () => {
  let state: ControlApiState;
  let server: Server;
  let publishCommand: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    state = await createControlApiState();
    publishCommand = vi.fn().mockResolvedValue(undefined);
    state.fabric = { publishCommand } as unknown as ControlApiState['fabric'];
    server = createControlApiServer(state);
    await new Promise<void>((resolve) => server.listen(0, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('publishes workpackage.accept and reports runtimeSync: accepted on Pass', async () => {
    const gate = await state.controlPlane.requestGateReview(
      {
        gateId: 'gate-wp-wp-42',
        execId: 'EXEC-42',
        workPackageId: 'wp-42',
        stageFrom: 'Execution',
        stageTo: 'Review',
        requiredApprovers: ['human.approver'],
        humanRequired: true,
      },
      'corr-test',
    );

    const { status, json } = await request(server, 'POST', `/v1/gates/${gate.waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'looks good',
    });

    expect(status).toBe(200);
    expect(json.runtimeSync).toBe('accepted');
    expect(publishCommand).toHaveBeenCalledTimes(1);
    const [subject, command] = publishCommand.mock.calls[0] as [string, CommandEnvelope];
    expect(subject).toBe(SUBJECTS.CMD_ORCHESTRATION);
    expect(command.name).toBe(ORCHESTRATION_COMMANDS.ACCEPT);
    expect(command.payload).toEqual({ workPackageId: 'wp-42' });
  });

  it('publishes workpackage.reject with the rationale as reason on Fail', async () => {
    const gate = await state.controlPlane.requestGateReview(
      {
        gateId: 'gate-wp-wp-43',
        execId: 'EXEC-43',
        workPackageId: 'wp-43',
        stageFrom: 'Execution',
        stageTo: 'Review',
        requiredApprovers: ['human.approver'],
        humanRequired: true,
      },
      'corr-test',
    );

    const { status, json } = await request(server, 'POST', `/v1/gates/${gate.waitId}/resolve`, {
      decision: 'Fail',
      approver: 'human.approver',
      rationale: 'missing test coverage',
    });

    expect(status).toBe(200);
    expect(json.runtimeSync).toBe('rejected');
    const [, command] = publishCommand.mock.calls[0] as [string, CommandEnvelope];
    expect(command.name).toBe(ORCHESTRATION_COMMANDS.REJECT);
    expect(command.payload).toEqual({ workPackageId: 'wp-43', reason: 'missing test coverage' });
  });

  it('does not touch the fabric for non-runtime gates (e.g. audit-pipeline gate-eng-*)', async () => {
    const gate = await state.controlPlane.requestGateReview(
      {
        gateId: 'gate-eng-demo-client',
        execId: 'EXEC-99',
        workPackageId: 'wp-99',
        stageFrom: 'Development',
        stageTo: 'QA',
        requiredApprovers: ['human.approver'],
        humanRequired: true,
      },
      'corr-test',
    );

    const { json } = await request(server, 'POST', `/v1/gates/${gate.waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'ok',
    });

    expect(json.runtimeSync).toBeNull();
    expect(publishCommand).not.toHaveBeenCalled();
  });

  it('reports runtimeSync: unavailable when state.fabric is not connected, without failing the resolve', async () => {
    state.fabric = undefined;
    const gate = await state.controlPlane.requestGateReview(
      {
        gateId: 'gate-wp-wp-44',
        execId: 'EXEC-44',
        workPackageId: 'wp-44',
        stageFrom: 'Execution',
        stageTo: 'Review',
        requiredApprovers: ['human.approver'],
        humanRequired: true,
      },
      'corr-test',
    );

    const { status, json } = await request(server, 'POST', `/v1/gates/${gate.waitId}/resolve`, {
      decision: 'Pass',
      approver: 'human.approver',
      rationale: 'ok',
    });

    expect(status).toBe(200);
    expect(json.runtimeSync).toBe('unavailable');
  });
});
