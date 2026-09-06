import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createCommandEnvelope, createEventEnvelope } from '@umer/message-fabric';
import type { CommandHandler, EventHandler } from '@umer/message-fabric';
import { OrchestrationWorker } from './worker.js';
import { Orchestrator } from './orchestrator.js';
import { InMemoryWorkPackageStore } from './store.js';
import { ORCHESTRATION_COMMANDS } from './constants.js';
import { OrchestrationError } from './errors.js';
import { createMockClock, createTestWorkPackage } from './test-utils.js';
import type { EventPublisher } from './events.js';
import type { WorkPackageDispatcher } from './dispatcher.js';

type Harness = {
  worker: OrchestrationWorker;
  orchestrator: Orchestrator;
  dispatcher: WorkPackageDispatcher;
  fabric: {
    subscribeCommands: ReturnType<typeof vi.fn>;
    subscribeEvents: ReturnType<typeof vi.fn>;
  };
  commandHandler: CommandHandler;
  eventHandler: EventHandler;
};

async function createWorkerHarness(): Promise<Harness> {
  const store = new InMemoryWorkPackageStore();
  const events: EventPublisher = { publish: vi.fn(async () => undefined) };
  const dispatcher: WorkPackageDispatcher = { dispatch: vi.fn(async () => undefined) };
  const orchestrator = new Orchestrator({
    store,
    events,
    dispatcher,
    clock: createMockClock(),
  });

  let commandHandler: CommandHandler = async () => undefined;
  let eventHandler: EventHandler = async () => undefined;

  const fabric = {
    subscribeCommands: vi.fn(async (_opts: unknown, handler: CommandHandler) => {
      commandHandler = handler;
      return { stop: vi.fn(async () => undefined) };
    }),
    subscribeEvents: vi.fn(async (_opts: unknown, handler: EventHandler) => {
      eventHandler = handler;
      return { stop: vi.fn(async () => undefined) };
    }),
  };

  const worker = new OrchestrationWorker({
    orchestrator,
    fabric: fabric as never,
  });
  await worker.start();

  return { worker, orchestrator, dispatcher, fabric, commandHandler, eventHandler };
}

const ackCtx = {
  correlationId: 'corr-1',
  deliveryCount: 1,
  ack: vi.fn(),
  nak: vi.fn(),
  term: vi.fn(),
};

describe('OrchestrationWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to orchestration commands and agent events', async () => {
    const { fabric } = await createWorkerHarness();
    expect(fabric.subscribeCommands).toHaveBeenCalledOnce();
    expect(fabric.subscribeEvents).toHaveBeenCalledOnce();
  });

  it('handles workpackage.queue command', async () => {
    const { commandHandler, orchestrator } = await createWorkerHarness();
    const command = createCommandEnvelope({
      name: ORCHESTRATION_COMMANDS.QUEUE,
      producer: 'control-api',
      correlationId: 'corr-cmd',
      payload: { workPackage: createTestWorkPackage() },
    });
    await commandHandler(command, ackCtx);
    expect((await orchestrator.get('wp-1'))?.status).toBe('Queued');
  });

  it('handles dispatch and cancel commands', async () => {
    const { commandHandler, orchestrator } = await createWorkerHarness();
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.QUEUE,
        producer: 'control-api',
        correlationId: 'corr-1',
        payload: { workPackage: createTestWorkPackage() },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.DISPATCH,
        producer: 'control-api',
        correlationId: 'corr-1',
        payload: { workPackageId: 'wp-1' },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.CANCEL,
        producer: 'control-api',
        correlationId: 'corr-1',
        payload: { workPackageId: 'wp-1', reason: 'stop' },
      }),
      ackCtx,
    );
    expect((await orchestrator.get('wp-1'))?.status).toBe('Cancelled');
  });

  it('handles accept and reject commands after review', async () => {
    const { commandHandler, eventHandler, orchestrator } = await createWorkerHarness();
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.QUEUE,
        producer: 'control-api',
        correlationId: 'corr-2',
        payload: { workPackage: createTestWorkPackage({ workPackageId: 'wp-2', status: 'Draft' }) },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.DISPATCH,
        producer: 'control-api',
        correlationId: 'corr-2',
        payload: { workPackageId: 'wp-2' },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.started',
        producer: 'agent-worker',
        correlationId: 'corr-2',
        payload: { workPackageId: 'wp-2' },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.completed',
        producer: 'agent-worker',
        correlationId: 'corr-2',
        payload: { workPackageId: 'wp-2' },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.ACCEPT,
        producer: 'control-api',
        correlationId: 'corr-2',
        payload: { workPackageId: 'wp-2' },
      }),
      ackCtx,
    );
    expect((await orchestrator.get('wp-2'))?.status).toBe('Accepted');

    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.QUEUE,
        producer: 'control-api',
        correlationId: 'corr-3',
        payload: { workPackage: createTestWorkPackage({ workPackageId: 'wp-3', status: 'Draft' }) },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.DISPATCH,
        producer: 'control-api',
        correlationId: 'corr-3',
        payload: { workPackageId: 'wp-3' },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.started',
        producer: 'agent-worker',
        correlationId: 'corr-3',
        payload: { workPackageId: 'wp-3' },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.completed',
        producer: 'agent-worker',
        correlationId: 'corr-3',
        payload: { workPackageId: 'wp-3' },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.REJECT,
        producer: 'control-api',
        correlationId: 'corr-3',
        payload: { workPackageId: 'wp-3', reason: 'quality' },
      }),
      ackCtx,
    );
    expect((await orchestrator.get('wp-3'))?.status).toBe('Rejected');
  });

  it('handles agent lifecycle events', async () => {
    const { commandHandler, eventHandler, orchestrator } = await createWorkerHarness();
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.QUEUE,
        producer: 'control-api',
        correlationId: 'corr-3',
        payload: { workPackage: createTestWorkPackage({ workPackageId: 'wp-3' }) },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.DISPATCH,
        producer: 'control-api',
        correlationId: 'corr-3',
        payload: { workPackageId: 'wp-3' },
      }),
      ackCtx,
    );

    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.started',
        producer: 'agent-worker',
        correlationId: 'corr-3',
        payload: { workPackageId: 'wp-3' },
      }),
      ackCtx,
    );
    expect((await orchestrator.get('wp-3'))?.status).toBe('Running');

    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.completed',
        producer: 'agent-worker',
        correlationId: 'corr-3',
        payload: { workPackageId: 'wp-3' },
      }),
      ackCtx,
    );
    expect((await orchestrator.get('wp-3'))?.status).toBe('AwaitingReview');
  });

  it('handles agent failure with auto-retry, and actually redispatches rather than leaving it stuck at Queued', async () => {
    const { commandHandler, eventHandler, orchestrator, dispatcher } = await createWorkerHarness();
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.QUEUE,
        producer: 'control-api',
        correlationId: 'corr-4',
        payload: { workPackage: createTestWorkPackage({ workPackageId: 'wp-4' }) },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.DISPATCH,
        producer: 'control-api',
        correlationId: 'corr-4',
        payload: { workPackageId: 'wp-4' },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.started',
        producer: 'agent-worker',
        correlationId: 'corr-4',
        payload: { workPackageId: 'wp-4' },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.failed',
        producer: 'agent-worker',
        correlationId: 'corr-4',
        payload: { workPackageId: 'wp-4', errorMessage: 'boom' },
      }),
      ackCtx,
    );
    // Queued alone would leave this stuck forever -- nothing else notices a
    // Queued status and redispatches it. handleAgentEvent's agent.run.failed
    // case must call dispatch() itself, moving the retry all the way to
    // Dispatched and invoking the real dispatcher a second time.
    const wp = await orchestrator.get('wp-4');
    expect(wp?.status).toBe('Dispatched');
    expect(wp?.attempt).toBe(2);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
  });

  it('leaves a Work Package terminally Failed (never Queued/redispatched) once max attempts are exhausted', async () => {
    const { commandHandler, eventHandler, orchestrator, dispatcher } = await createWorkerHarness();
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.QUEUE,
        producer: 'control-api',
        correlationId: 'corr-exhaust',
        payload: { workPackage: createTestWorkPackage({ workPackageId: 'wp-exhaust', attempt: 3 }) },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.DISPATCH,
        producer: 'control-api',
        correlationId: 'corr-exhaust',
        payload: { workPackageId: 'wp-exhaust' },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.started',
        producer: 'agent-worker',
        correlationId: 'corr-exhaust',
        payload: { workPackageId: 'wp-exhaust' },
      }),
      ackCtx,
    );
    const dispatchCallsBeforeFailure = (dispatcher.dispatch as ReturnType<typeof vi.fn>).mock.calls.length;
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.failed',
        producer: 'agent-worker',
        correlationId: 'corr-exhaust',
        payload: { workPackageId: 'wp-exhaust', errorMessage: 'boom' },
      }),
      ackCtx,
    );
    const wp = await orchestrator.get('wp-exhaust');
    expect(wp?.status).toBe('Failed');
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(dispatchCallsBeforeFailure);
  });

  it('stops subscriptions', async () => {
    const { worker } = await createWorkerHarness();
    await expect(worker.stop()).resolves.toBeUndefined();
  });

  it('rejects unknown commands', async () => {
    const { commandHandler } = await createWorkerHarness();
    await expect(
      commandHandler(
        createCommandEnvelope({
          name: 'unknown.command',
          producer: 'control-api',
          correlationId: 'corr-bad',
        }),
        ackCtx,
      ),
    ).rejects.toThrow(OrchestrationError);
  });

  it('ignores agent events without workPackageId', async () => {
    const { eventHandler } = await createWorkerHarness();
    await expect(
      eventHandler(
        createEventEnvelope({
          name: 'agent.run.started',
          producer: 'agent-worker',
          correlationId: 'corr-empty',
          payload: {},
        }),
        ackCtx,
      ),
    ).resolves.toBeUndefined();
  });

  it('handles retry command after rejection', async () => {
    const { commandHandler, eventHandler, orchestrator } = await createWorkerHarness();
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.QUEUE,
        producer: 'control-api',
        correlationId: 'corr-retry',
        payload: { workPackage: createTestWorkPackage({ workPackageId: 'wp-retry' }) },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.DISPATCH,
        producer: 'control-api',
        correlationId: 'corr-retry',
        payload: { workPackageId: 'wp-retry' },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.started',
        producer: 'agent-worker',
        correlationId: 'corr-retry',
        payload: { workPackageId: 'wp-retry' },
      }),
      ackCtx,
    );
    await eventHandler(
      createEventEnvelope({
        name: 'agent.run.completed',
        producer: 'agent-worker',
        correlationId: 'corr-retry',
        payload: { workPackageId: 'wp-retry' },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.REJECT,
        producer: 'control-api',
        correlationId: 'corr-retry',
        payload: { workPackageId: 'wp-retry' },
      }),
      ackCtx,
    );
    await commandHandler(
      createCommandEnvelope({
        name: ORCHESTRATION_COMMANDS.RETRY,
        producer: 'control-api',
        correlationId: 'corr-retry',
        payload: { workPackageId: 'wp-retry' },
      }),
      ackCtx,
    );
    const wp = await orchestrator.get('wp-retry');
    expect(wp?.status).toBe('Queued');
    expect(wp?.attempt).toBe(2);
  });

  it('ignores unrelated agent events', async () => {
    const { eventHandler } = await createWorkerHarness();
    await expect(
      eventHandler(
        createEventEnvelope({
          name: 'artifact.sealed',
          producer: 'agent-worker',
          correlationId: 'corr-other',
          payload: { workPackageId: 'wp-1' },
        }),
        ackCtx,
      ),
    ).resolves.toBeUndefined();
  });
});
