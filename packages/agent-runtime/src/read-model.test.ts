import { describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, type EventEnvelope } from '@umer/contracts';
import { InMemoryAgentRegistryStore, InMemoryAgentRunReadModelStore } from '@umer/observability';
import {
  MessageFabricClient,
  STREAMS,
  SUBJECTS,
  createEventEnvelope,
  InMemoryIdempotencyStore,
} from '@umer/message-fabric';
import { subscribeAgentRunReadModel, type RuntimeEventSource } from './read-model.js';

let eventSeq = 0;
function makeEvent(overrides: Partial<EventEnvelope> = {}): EventEnvelope {
  eventSeq += 1;
  return {
    eventId: `evt-${eventSeq}`,
    schemaVersion: SCHEMA_VERSION,
    name: 'agent.run.started',
    occurredAt: '2026-09-03T00:00:00.000Z',
    correlationId: 'corr-1',
    producer: 'agent-worker',
    payload: { workPackageId: 'wp-1', specialistId: 'growth.opportunity-research' },
    ...overrides,
  };
}

function fakeFabric() {
  let capturedHandler: ((event: EventEnvelope, ctx: { ack: () => void }) => Promise<void>) | undefined;
  let capturedOptions: { stream: string; durable: string; filterSubject: string } | undefined;
  const stop = vi.fn().mockResolvedValue(undefined);
  const fabric: RuntimeEventSource = {
    subscribeEvents: vi.fn(async (options, handler) => {
      capturedOptions = options;
      capturedHandler = handler;
      return { stop };
    }),
  };
  return {
    fabric,
    stop,
    getHandler: () => capturedHandler,
    getOptions: () => capturedOptions,
  };
}

describe('subscribeAgentRunReadModel', () => {
  it('subscribes on the runtime agent.* wildcard subject with a stable durable name', async () => {
    const { fabric, getOptions } = fakeFabric();
    const store = new InMemoryAgentRunReadModelStore();

    await subscribeAgentRunReadModel(fabric, store);

    expect(fabric.subscribeEvents).toHaveBeenCalledTimes(1);
    expect(getOptions()).toEqual({
      stream: STREAMS.EVENTS,
      durable: 'agent-run-read-model',
      filterSubject: `${SUBJECTS.EVT_RUNTIME}.agent.>`,
    });
  });

  it('honors a custom durable name', async () => {
    const { fabric, getOptions } = fakeFabric();
    await subscribeAgentRunReadModel(fabric, new InMemoryAgentRunReadModelStore(), { durable: 'custom-durable' });
    expect(getOptions()?.durable).toBe('custom-durable');
  });

  it('projects an incoming event into the store and acks it', async () => {
    const { fabric, getHandler } = fakeFabric();
    const store = new InMemoryAgentRunReadModelStore();
    await subscribeAgentRunReadModel(fabric, store);

    const ack = vi.fn();
    const handler = getHandler();
    expect(handler).toBeDefined();
    await handler!(makeEvent(), { ack });

    expect(ack).toHaveBeenCalledTimes(1);
    const snapshot = await store.get('wp-1');
    expect(snapshot?.status).toBe('running');
    expect(snapshot?.specialistId).toBe('growth.opportunity-research');
  });

  it('still acks an event this read model does not track (other domains)', async () => {
    const { fabric, getHandler } = fakeFabric();
    const store = new InMemoryAgentRunReadModelStore();
    await subscribeAgentRunReadModel(fabric, store);

    const ack = vi.fn();
    await getHandler()!(makeEvent({ name: 'trust.allow', payload: { principalId: 'x' } }), { ack });

    expect(ack).toHaveBeenCalledTimes(1);
    expect(await store.list()).toHaveLength(0);
  });

  it('folds a multi-event sequence for the same work package into one evolving snapshot', async () => {
    const { fabric, getHandler } = fakeFabric();
    const store = new InMemoryAgentRunReadModelStore();
    await subscribeAgentRunReadModel(fabric, store);
    const handler = getHandler()!;
    const ack = vi.fn();

    await handler(makeEvent({ name: 'agent.run.started' }), { ack });
    await handler(
      makeEvent({
        name: 'agent.tool.requested',
        payload: { workPackageId: 'wp-1', toolCallId: 'call_1', tool: 'search_web', input: { query: 'x' } },
      }),
      { ack },
    );
    await handler(
      makeEvent({
        name: 'agent.run.completed',
        payload: { workPackageId: 'wp-1', runId: 'wp-1:corr-1', artifactId: 'art-1', summary: 'done' },
      }),
      { ack },
    );

    const snapshot = await store.get('wp-1');
    expect(snapshot?.status).toBe('completed');
    expect(snapshot?.toolCalls).toHaveLength(1);
    expect(snapshot?.artifactId).toBe('art-1');
  });

  // (H) duplicate event handling — JetStream at-least-once redelivery
  it('(H) redelivering the same event (same eventId) is applied at most once', async () => {
    const { fabric, getHandler } = fakeFabric();
    const store = new InMemoryAgentRunReadModelStore();
    await subscribeAgentRunReadModel(fabric, store);
    const handler = getHandler()!;

    const event = makeEvent({
      name: 'agent.tool.requested',
      payload: { workPackageId: 'wp-1', toolCallId: 'call_1', tool: 'search_web', input: { query: 'x' } },
    });

    const ack1 = vi.fn();
    const ack2 = vi.fn();
    const ack3 = vi.fn();
    await handler(event, { ack: ack1 });
    await handler(event, { ack: ack2 }); // redelivery: same eventId
    await handler(event, { ack: ack3 }); // redelivered again

    // Every redelivery is still acked (so JetStream stops retrying) ...
    expect(ack1).toHaveBeenCalledTimes(1);
    expect(ack2).toHaveBeenCalledTimes(1);
    expect(ack3).toHaveBeenCalledTimes(1);
    // ... but the read model only reflects the event once.
    const snapshot = await store.get('wp-1');
    expect(snapshot?.toolCalls).toHaveLength(1);
  });

  it('(H) a distinct event for the same work package is still applied normally after a duplicate', async () => {
    const { fabric, getHandler } = fakeFabric();
    const store = new InMemoryAgentRunReadModelStore();
    await subscribeAgentRunReadModel(fabric, store);
    const handler = getHandler()!;

    const first = makeEvent({
      name: 'agent.tool.requested',
      payload: { workPackageId: 'wp-1', toolCallId: 'call_1', tool: 'search_web', input: {} },
    });
    const second = makeEvent({
      name: 'agent.tool.requested',
      payload: { workPackageId: 'wp-1', toolCallId: 'call_2', tool: 'search_web', input: {} },
    });

    await handler(first, { ack: vi.fn() });
    await handler(first, { ack: vi.fn() }); // duplicate of `first`
    await handler(second, { ack: vi.fn() }); // genuinely new event

    const snapshot = await store.get('wp-1');
    expect(snapshot?.toolCalls.map((t) => t.toolCallId)).toEqual(['call_1', 'call_2']);
  });

  it('also projects into the Agent Registry when one is supplied, using the same idempotency gate', async () => {
    const { fabric, getHandler } = fakeFabric();
    const runStore = new InMemoryAgentRunReadModelStore();
    const agentRegistry = new InMemoryAgentRegistryStore();
    await subscribeAgentRunReadModel(fabric, runStore, { agentRegistry });
    const handler = getHandler()!;

    const started = makeEvent({
      name: 'agent.run.started',
      payload: { workPackageId: 'wp-1', specialistId: 'growth.opportunity-research', agentId: 'agent-1' },
    });
    await handler(started, { ack: vi.fn() });
    await handler(started, { ack: vi.fn() }); // redelivery — must not double-apply to either store

    expect(await runStore.get('wp-1')).toMatchObject({ status: 'running', agentId: 'agent-1' });
    const agent = await agentRegistry.get('agent-1');
    expect(agent?.status).toBe('active');
    expect(agent?.currentWorkPackageId).toBe('wp-1');

    const completed = makeEvent({
      name: 'agent.run.completed',
      payload: { workPackageId: 'wp-1', agentId: 'agent-1', runId: 'wp-1:corr-1', artifactId: 'art-1' },
    });
    await handler(completed, { ack: vi.fn() });
    expect((await agentRegistry.get('agent-1'))?.status).toBe('idle');
    expect((await runStore.get('wp-1'))?.status).toBe('completed');
  });

  it('honors a caller-supplied idempotency store', async () => {
    const { fabric, getHandler } = fakeFabric();
    const store = new InMemoryAgentRunReadModelStore();
    const idempotencyStore = new InMemoryIdempotencyStore();
    await subscribeAgentRunReadModel(fabric, store, { idempotencyStore });
    const handler = getHandler()!;

    const event = makeEvent();
    await handler(event, { ack: vi.fn() });

    expect(await idempotencyStore.has(event.eventId)).toBe(true);
  });
});

// (18) integration test proving the REAL MessageFabricClient's real subscribeEvents
// pipeline (consumer setup, message decode, ack semantics) drives the read model —
// not just a hand-rolled fake calling the reducer directly. Mirrors the exact
// nc/js/jsm mocking pattern @umer/message-fabric's own client.test.ts uses, so no
// live NATS connection is required.
describe('Message Fabric -> subscribeAgentRunReadModel -> AgentRunReadModel (integration)', () => {
  type MockJsMsg = {
    subject: string;
    data: Uint8Array;
    info: { deliveryCount: number };
    ack: ReturnType<typeof vi.fn>;
    nak: ReturnType<typeof vi.fn>;
    term: ReturnType<typeof vi.fn>;
  };

  function encode(event: EventEnvelope): MockJsMsg {
    return {
      subject: `${SUBJECTS.EVT_RUNTIME}.${event.name}`,
      data: new TextEncoder().encode(JSON.stringify(event)),
      info: { deliveryCount: 1 },
      ack: vi.fn(),
      nak: vi.fn(),
      term: vi.fn(),
    };
  }

  function createAsyncIterable<T>(items: T[]) {
    return {
      async *[Symbol.asyncIterator]() {
        for (const item of items) {
          yield item;
        }
      },
      close: vi.fn(async () => undefined),
    };
  }

  function createRealClientWithMockedNats(messages: MockJsMsg[]) {
    const js = {
      publish: vi.fn(),
      consumers: {
        get: vi.fn(async () => ({ consume: vi.fn(async () => createAsyncIterable(messages)) })),
      },
    };
    const jsm = {
      streams: { info: vi.fn(async () => ({})), add: vi.fn() },
      consumers: { info: vi.fn(async () => { throw new Error('not found'); }), add: vi.fn(async () => undefined) },
    };
    const nc = { request: vi.fn(), drain: vi.fn(async () => undefined) };

    return new MessageFabricClient({ nc: nc as never, js: js as never, jsm: jsm as never, producer: 'test-control-api' });
  }

  it('drives real AgentRunReadModel state through the real MessageFabricClient.subscribeEvents pipeline', async () => {
    const started = createEventEnvelope({
      name: 'agent.run.started',
      producer: 'agent-worker',
      correlationId: 'corr-int-1',
      payload: { workPackageId: 'wp-int-1', execId: 'EXEC-1', specialistId: 'growth.opportunity-research' },
    });
    const toolRequested = createEventEnvelope({
      name: 'agent.tool.requested',
      producer: 'agent-worker',
      correlationId: 'corr-int-1',
      payload: { workPackageId: 'wp-int-1', toolCallId: 'call_1', tool: 'search_web', input: { query: 'x' } },
    });
    const completed = createEventEnvelope({
      name: 'agent.run.completed',
      producer: 'agent-worker',
      correlationId: 'corr-int-1',
      payload: { workPackageId: 'wp-int-1', runId: 'wp-int-1:corr-int-1', artifactId: 'art-int-1', summary: 'done' },
    });

    const messages = [encode(started), encode(toolRequested), encode(completed)];
    const client = createRealClientWithMockedNats(messages);
    const store = new InMemoryAgentRunReadModelStore();

    const sub = await subscribeAgentRunReadModel(client, store);

    await vi.waitFor(async () => {
      const snapshot = await store.get('wp-int-1');
      expect(snapshot?.status).toBe('completed');
    });

    const snapshot = await store.get('wp-int-1');
    expect(snapshot?.specialistId).toBe('growth.opportunity-research');
    expect(snapshot?.toolCalls).toHaveLength(1);
    expect(snapshot?.artifactId).toBe('art-int-1');
    for (const msg of messages) {
      expect(msg.ack).toHaveBeenCalledTimes(1);
    }

    await sub.stop();
  });
});
