import { describe, expect, it } from 'vitest';
import type { RuntimeEventName } from '@umer/contracts';
import { createEventEnvelope } from '@umer/message-fabric';
import { createControlApiState } from './server.js';
import {
  connectRuntimeWorkPackageBridge,
  projectRuntimeWorkPackageEvent,
  projectWorkGraphPlannedEvent,
  type ExecIdCache,
} from './runtime-work-package-bridge.js';

function makeEvent(name: RuntimeEventName, payload: Record<string, unknown>) {
  return createEventEnvelope({
    name,
    producer: 'agent-worker',
    correlationId: 'corr-1',
    payload,
  });
}

describe('projectRuntimeWorkPackageEvent', () => {
  it('adds a Running work package summary on agent.run.started, with no fabricated projectId', async () => {
    const state = await createControlApiState();
    const cache: ExecIdCache = new Map();

    await projectRuntimeWorkPackageEvent(
      state,
      cache,
      makeEvent('agent.run.started', {
        workPackageId: 'wp-1',
        execId: 'EXEC-1',
        specialistId: 'eng.app-delivery',
      }),
    );

    expect(state.workPackages).toHaveLength(1);
    expect(state.workPackages[0]).toMatchObject({
      workPackageId: 'wp-1',
      execId: 'EXEC-1',
      status: 'Running',
      specialistId: 'eng.app-delivery',
    });
    expect(state.workPackages[0]!.projectId).toBeUndefined();
  });

  it('moves the work package to AwaitingReview and opens a gate-wp-* review on agent.run.completed', async () => {
    const state = await createControlApiState();
    const cache: ExecIdCache = new Map();

    await projectRuntimeWorkPackageEvent(
      state,
      cache,
      makeEvent('agent.run.started', {
        workPackageId: 'wp-2',
        execId: 'EXEC-2',
        specialistId: 'eng.app-delivery',
      }),
    );
    await projectRuntimeWorkPackageEvent(
      state,
      cache,
      makeEvent('agent.run.completed', {
        workPackageId: 'wp-2',
        artifactId: 'art-2',
        runId: 'wp-2:corr-1',
        summary: 'done',
      }),
    );

    const wp = state.workPackages.find((item) => item.workPackageId === 'wp-2');
    expect(wp).toMatchObject({ status: 'AwaitingReview', execId: 'EXEC-2', artifactId: 'art-2' });

    const pending = await state.controlPlane.listPending();
    const gate = pending.find((g) => g.gateId === 'gate-wp-wp-2');
    expect(gate).toBeDefined();
    expect(gate).toMatchObject({ execId: 'EXEC-2', workPackageId: 'wp-2', artifactId: 'art-2' });
  });

  it('marks the work package Failed with the real error message on agent.run.failed', async () => {
    const state = await createControlApiState();
    const cache: ExecIdCache = new Map();

    await projectRuntimeWorkPackageEvent(
      state,
      cache,
      makeEvent('agent.run.started', {
        workPackageId: 'wp-3',
        execId: 'EXEC-3',
        specialistId: 'eng.app-delivery',
      }),
    );
    await projectRuntimeWorkPackageEvent(
      state,
      cache,
      makeEvent('agent.run.failed', {
        workPackageId: 'wp-3',
        errorMessage: 'tool call exceeded budget',
      }),
    );

    const wp = state.workPackages.find((item) => item.workPackageId === 'wp-3');
    expect(wp).toMatchObject({ status: 'Failed', errorMessage: 'tool call exceeded budget' });
    // No gate is opened for failed runs — there is nothing for the CEO to review/approve.
    const pending = await state.controlPlane.listPending();
    expect(pending.find((g) => g.gateId === 'gate-wp-wp-3')).toBeUndefined();
  });

  it('ignores events for other runtime domains without throwing', async () => {
    const state = await createControlApiState();
    const cache: ExecIdCache = new Map();

    await projectRuntimeWorkPackageEvent(
      state,
      cache,
      makeEvent('trust.allow', { principalId: 'x' }),
    );

    expect(state.workPackages).toHaveLength(0);
  });
});

describe('projectWorkGraphPlannedEvent', () => {
  it('records the latest plan result for a project', async () => {
    const state = await createControlApiState();
    projectWorkGraphPlannedEvent(
      state,
      makeEvent('workgraph.planned', {
        projectId: 'proj-1',
        created: ['wp-1'],
        skipped: [{ nodeId: 'qa', nodeType: 'QA', reason: 'no active Specialist resolved for node type QA' }],
      }),
    );

    expect(state.workGraphPlanResults?.get('proj-1')).toMatchObject({
      created: ['wp-1'],
      skipped: [{ nodeId: 'qa', nodeType: 'QA', reason: expect.stringContaining('Specialist') }],
    });
  });

  it('overwrites the previous result for the same project on a later plan', async () => {
    const state = await createControlApiState();
    projectWorkGraphPlannedEvent(state, makeEvent('workgraph.planned', { projectId: 'proj-1', created: ['wp-1'], skipped: [] }));
    projectWorkGraphPlannedEvent(state, makeEvent('workgraph.planned', { projectId: 'proj-1', created: ['wp-2'], skipped: [] }));

    expect(state.workGraphPlanResults?.get('proj-1')?.created).toEqual(['wp-2']);
  });

  it('ignores an event with no projectId, without throwing', async () => {
    const state = await createControlApiState();
    expect(() =>
      projectWorkGraphPlannedEvent(state, makeEvent('workgraph.planned', { created: [], skipped: [] })),
    ).not.toThrow();
    expect(state.workGraphPlanResults?.size ?? 0).toBe(0);
  });
});

// Mirrors agent-run-subscription.test.ts: exercises the real
// createMessageFabric() connection attempt against whatever NATS_URL is
// configured. Where nothing is listening (CI), the connection is refused —
// exactly the "Message Fabric unreachable" path this proves control-api
// survives. Where a broker is reachable, the subscription simply succeeds
// instead. Either way this must never throw or hang.
describe('connectRuntimeWorkPackageBridge', () => {
  it('never throws regardless of Message Fabric reachability', async () => {
    const state = await createControlApiState();

    const subscription = await connectRuntimeWorkPackageBridge(state);

    expect(Array.isArray(state.workPackages)).toBe(true);
    await subscription?.stop();
  }, 20_000);
});
