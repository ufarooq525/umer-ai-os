import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Orchestrator } from './orchestrator.js';
import { InMemoryWorkPackageStore } from './store.js';
import { OrchestrationError } from './errors.js';
import { createMockClock, createTestWorkPackage } from './test-utils.js';
import type { EventPublisher } from './events.js';
import type { WorkPackageDispatcher } from './dispatcher.js';
import { OrchestrationWorker, createOrchestrationWorker } from './worker.js';

function createTestOrchestrator(overrides: { maxAttempts?: number } = {}) {
  const store = new InMemoryWorkPackageStore();
  const events: EventPublisher = {
    publish: vi.fn(async () => undefined),
  };
  const dispatcher: WorkPackageDispatcher = {
    dispatch: vi.fn(async () => undefined),
  };
  const clock = createMockClock();

  const orchestrator = new Orchestrator({
    store,
    events,
    dispatcher,
    clock,
    maxAttempts: overrides.maxAttempts ?? 3,
  });

  return { orchestrator, store, events, dispatcher, clock };
}

describe('Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues a draft work package', async () => {
    const { orchestrator, events } = createTestOrchestrator();
    const wp = createTestWorkPackage();
    const result = await orchestrator.queue(wp, 'corr-1');
    expect(result.status).toBe('Queued');
    expect(events.publish).toHaveBeenCalledWith(
      'workpackage.queued',
      'corr-1',
      expect.objectContaining({ workPackageId: 'wp-1' }),
    );
  });

  it('is idempotent when already queued', async () => {
    const { orchestrator } = createTestOrchestrator();
    const wp = createTestWorkPackage({ status: 'Draft' });
    const first = await orchestrator.queue(wp, 'corr-1');
    const second = await orchestrator.queue(first, 'corr-2');
    expect(second.status).toBe('Queued');
    expect(second.workPackageId).toBe('wp-1');
  });

  it('dispatches queued work package to agent plane', async () => {
    const { orchestrator, dispatcher, events } = createTestOrchestrator();
    const queued = await orchestrator.queue(createTestWorkPackage(), 'corr-1');
    const dispatched = await orchestrator.dispatch(queued.workPackageId, 'corr-1');
    expect(dispatched.status).toBe('Dispatched');
    expect(dispatcher.dispatch).toHaveBeenCalledOnce();
    expect(events.publish).toHaveBeenCalledWith(
      'workpackage.dispatched',
      'corr-1',
      expect.objectContaining({ workPackageId: 'wp-1' }),
    );
  });

  it('advances through running and awaiting review', async () => {
    const { orchestrator } = createTestOrchestrator();
    await orchestrator.queue(createTestWorkPackage(), 'corr-1');
    await orchestrator.dispatch('wp-1', 'corr-1');
    const running = await orchestrator.markRunning('wp-1', 'corr-1');
    expect(running.status).toBe('Running');
    const review = await orchestrator.markAwaitingReview('wp-1', 'corr-1');
    expect(review.status).toBe('AwaitingReview');
  });

  it('accepts and rejects awaiting review packages', async () => {
    const { orchestrator } = createTestOrchestrator();
    await orchestrator.queue(createTestWorkPackage(), 'corr-1');
    await orchestrator.dispatch('wp-1', 'corr-1');
    await orchestrator.markRunning('wp-1', 'corr-1');
    await orchestrator.markAwaitingReview('wp-1', 'corr-1');
    const accepted = await orchestrator.accept('wp-1', 'corr-1');
    expect(accepted.status).toBe('Accepted');

    const { orchestrator: orch2 } = createTestOrchestrator();
    await orch2.queue(createTestWorkPackage({ workPackageId: 'wp-2' }), 'corr-2');
    await orch2.dispatch('wp-2', 'corr-2');
    await orch2.markRunning('wp-2', 'corr-2');
    await orch2.markAwaitingReview('wp-2', 'corr-2');
    const rejected = await orch2.reject('wp-2', 'corr-2', 'quality gate');
    expect(rejected.status).toBe('Rejected');
  });

  it('cancels active work packages', async () => {
    const { orchestrator } = createTestOrchestrator();
    await orchestrator.queue(createTestWorkPackage(), 'corr-1');
    const cancelled = await orchestrator.cancel('wp-1', 'corr-1', 'user abort');
    expect(cancelled.status).toBe('Cancelled');
  });

  it('retries failed packages with incremented attempt', async () => {
    const { orchestrator } = createTestOrchestrator();
    await orchestrator.queue(createTestWorkPackage(), 'corr-1');
    await orchestrator.dispatch('wp-1', 'corr-1');
    await orchestrator.markRunning('wp-1', 'corr-1');
    await orchestrator.fail('wp-1', 'corr-1', 'transient');
    const retried = await orchestrator.retry('wp-1', 'corr-1');
    expect(retried.status).toBe('Queued');
    expect(retried.attempt).toBe(2);
  });

  it('rejects retry when max attempts exceeded', async () => {
    const { orchestrator } = createTestOrchestrator({ maxAttempts: 1 });
    await orchestrator.queue(createTestWorkPackage({ attempt: 1 }), 'corr-1');
    await orchestrator.dispatch('wp-1', 'corr-1');
    await orchestrator.markRunning('wp-1', 'corr-1');
    await orchestrator.fail('wp-1', 'corr-1', 'fatal');
    await expect(orchestrator.retry('wp-1', 'corr-1')).rejects.toThrow(OrchestrationError);
  });

  it('handleAgentFailure auto-retries when attempts remain', async () => {
    const { orchestrator } = createTestOrchestrator();
    await orchestrator.queue(createTestWorkPackage(), 'corr-1');
    await orchestrator.dispatch('wp-1', 'corr-1');
    await orchestrator.markRunning('wp-1', 'corr-1');
    const result = await orchestrator.handleAgentFailure('wp-1', 'corr-1', 'agent crash');
    expect(result.status).toBe('Queued');
    expect(result.attempt).toBe(2);
  });

  it('times out running packages', async () => {
    const { orchestrator, clock } = createTestOrchestrator();
    await orchestrator.queue(
      createTestWorkPackage({
        resourceEnvelope: { parallelism: 1, maxDurationMs: 1_000 },
      }),
      'corr-1',
    );
    await orchestrator.dispatch('wp-1', 'corr-1');
    await orchestrator.markRunning('wp-1', 'corr-1');
    clock.advance(2_000);
    const timedOut = await orchestrator.checkTimeouts();
    expect(timedOut).toEqual(['wp-1']);
    const wp = await orchestrator.get('wp-1');
    expect(wp?.status).toBe('Failed');
  });

  it('throws when work package is missing', async () => {
    const { orchestrator } = createTestOrchestrator();
    await expect(orchestrator.dispatch('missing', 'corr-1')).rejects.toThrow(
      OrchestrationError,
    );
  });

  it('handleAgentFailure leaves package failed when max attempts reached', async () => {
    const { orchestrator } = createTestOrchestrator({ maxAttempts: 1 });
    await orchestrator.queue(createTestWorkPackage({ attempt: 1 }), 'corr-1');
    await orchestrator.dispatch('wp-1', 'corr-1');
    await orchestrator.markRunning('wp-1', 'corr-1');
    const result = await orchestrator.handleAgentFailure('wp-1', 'corr-1', 'agent crash');
    expect(result.status).toBe('Failed');
    expect(result.attempt).toBe(1);
  });

  it('queues work package already in Queued status', async () => {
    const { orchestrator } = createTestOrchestrator();
    const queued = await orchestrator.queue(
      createTestWorkPackage({ status: 'Queued' }),
      'corr-new',
    );
    expect(queued.status).toBe('Queued');
  });

  it('rejects illegal transitions', async () => {
    const { orchestrator } = createTestOrchestrator();
    await orchestrator.queue(createTestWorkPackage(), 'corr-1');
    await expect(orchestrator.markRunning('wp-1', 'corr-1')).rejects.toThrow(
      OrchestrationError,
    );
  });

  it('requeues rejected packages', async () => {
    const { orchestrator } = createTestOrchestrator();
    await orchestrator.queue(createTestWorkPackage(), 'corr-1');
    await orchestrator.dispatch('wp-1', 'corr-1');
    await orchestrator.markRunning('wp-1', 'corr-1');
    await orchestrator.markAwaitingReview('wp-1', 'corr-1');
    await orchestrator.reject('wp-1', 'corr-1', 'needs work');
    const requeued = await orchestrator.queue(
      createTestWorkPackage({ status: 'Rejected', attempt: 1 }),
      'corr-2',
    );
    expect(requeued.status).toBe('Queued');
  });

  it('skips timeout check when duration or start time is missing', async () => {
    const { orchestrator } = createTestOrchestrator();
    await orchestrator.queue(createTestWorkPackage(), 'corr-1');
    await orchestrator.dispatch('wp-1', 'corr-1');
    const running = await orchestrator.markRunning('wp-1', 'corr-1');
    expect(running.status).toBe('Running');
    expect(await orchestrator.checkTimeouts()).toEqual([]);
  });
});

describe('createOrchestrationWorker', () => {
  it('returns worker instance', () => {
    const orchestrator = new Orchestrator({
      store: new InMemoryWorkPackageStore(),
      events: { publish: vi.fn(async () => undefined) },
      dispatcher: { dispatch: vi.fn(async () => undefined) },
    });
    const worker = createOrchestrationWorker({
      orchestrator,
      fabric: { subscribeCommands: vi.fn(), subscribeEvents: vi.fn() } as never,
    });
    expect(worker).toBeInstanceOf(OrchestrationWorker);
  });
});
