import { describe, expect, it, vi, beforeEach } from 'vitest';
import { headers, type MsgHdrs } from 'nats';
import { MessageFabricClient } from './client.js';
import { STREAMS } from './constants.js';
import { createCommandEnvelope, createEventEnvelope } from './envelopes.js';
import { InMemoryIdempotencyStore } from './idempotency.js';
import { injectTraceContext, extractTraceContext, withMessageSpan } from './tracing.js';

type MockJsMsg = {
  subject: string;
  data: Uint8Array;
  headers?: MsgHdrs;
  info: { deliveryCount: number };
  ack: ReturnType<typeof vi.fn>;
  nak: ReturnType<typeof vi.fn>;
  term: ReturnType<typeof vi.fn>;
};

function createMockMessage(input: {
  subject?: string;
  envelope?: unknown;
  deliveryCount?: number;
  msgHeaders?: MsgHdrs;
}): MockJsMsg {
  const envelope =
    input.envelope ??
    createCommandEnvelope({
      name: 'workpackage.dispatch',
      producer: 'test-producer',
      correlationId: 'corr-sub',
    });

  return {
    subject: input.subject ?? 'cmd.orchestration',
    data: new TextEncoder().encode(JSON.stringify(envelope)),
    headers: input.msgHeaders,
    info: { deliveryCount: input.deliveryCount ?? 1 },
    ack: vi.fn(),
    nak: vi.fn(),
    term: vi.fn(),
  };
}

function createAsyncIterable<T>(items: T[], close = vi.fn(async () => undefined)) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) {
        yield item;
      }
    },
    close,
  };
}

function createMockClient(overrides: { idempotencyStore?: InMemoryIdempotencyStore } = {}) {
  const published: Array<{ subject: string; data: Uint8Array; headers?: MsgHdrs }> = [];

  const js = {
    publish: vi.fn(async (subject: string, data: Uint8Array, opts?: { headers?: MsgHdrs }) => {
      published.push({ subject, data, headers: opts?.headers });
      return { stream: STREAMS.COMMANDS, seq: 1 };
    }),
    consumers: {
      get: vi.fn(),
    },
  };

  const jsm = {
    streams: {
      info: vi.fn(async () => {
        throw new Error('not found');
      }),
      add: vi.fn(async () => undefined),
    },
    consumers: {
      info: vi.fn(async () => {
        throw new Error('not found');
      }),
      add: vi.fn(async () => undefined),
    },
  };

  const nc = {
    request: vi.fn(),
    drain: vi.fn(async () => undefined),
  };

  const client = new MessageFabricClient({
    nc: nc as never,
    js: js as never,
    jsm: jsm as never,
    producer: 'test-producer',
    idempotencyStore: overrides.idempotencyStore,
  });

  return { client, published, js, jsm, nc };
}

describe('MessageFabricClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensures jetstream streams', async () => {
    const { client, jsm } = createMockClient();
    await client.ensureInfrastructure();
    expect(jsm.streams.add).toHaveBeenCalledTimes(3);
    expect(jsm.streams.add).toHaveBeenCalledWith(
      expect.objectContaining({ name: STREAMS.COMMANDS, subjects: ['cmd.>'] }),
    );
  });

  it('skips stream creation when stream already exists', async () => {
    const { client, jsm } = createMockClient();
    jsm.streams.info.mockResolvedValue({ config: { name: STREAMS.COMMANDS } });
    await client.ensureInfrastructure();
    expect(jsm.streams.add).not.toHaveBeenCalled();
  });

  it('publishes typed command envelope', async () => {
    const { client, js } = createMockClient();
    const command = createCommandEnvelope({
      name: 'workpackage.dispatch',
      producer: 'test-producer',
      correlationId: 'corr-publish',
      payload: { id: 'wp-1' },
    });
    await client.publishCommand('cmd.orchestration', command);
    expect(js.publish).toHaveBeenCalledOnce();
  });

  it('publishes typed event envelope', async () => {
    const { client, js } = createMockClient();
    const event = createEventEnvelope({
      name: 'workpackage.queued',
      producer: 'test-producer',
      correlationId: 'corr-evt',
    });
    await client.publishEvent('evt.runtime.test', event);
    expect(js.publish).toHaveBeenCalledOnce();
  });

  it('requestCommand round-trips via core NATS', async () => {
    const { client, nc } = createMockClient();
    const command = createCommandEnvelope({
      name: 'ping',
      producer: 'test-producer',
      correlationId: 'corr-req',
    });
    const reply = createCommandEnvelope({
      name: 'pong',
      producer: 'responder',
      correlationId: 'corr-req',
    });
    nc.request.mockResolvedValue({
      data: new TextEncoder().encode(JSON.stringify(reply)),
    });
    const result = await client.requestCommand('cmd.orchestration', command);
    expect(result.name).toBe('pong');
  });

  it('subscribes to commands and auto-acks successful handlers', async () => {
    const { client, js } = createMockClient();
    const msg = createMockMessage({});
    const close = vi.fn(async () => undefined);
    js.consumers.get.mockResolvedValue({
      consume: vi.fn(async () => createAsyncIterable([msg], close)),
    });

    const handler = vi.fn(async () => undefined);
    const sub = await client.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: 'test-durable',
        filterSubject: 'cmd.>',
      },
      handler,
    );

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledOnce();
      expect(msg.ack).toHaveBeenCalledOnce();
    });
    await sub.stop();
    expect(close).toHaveBeenCalledOnce();
  });

  it('subscribes to events and dispatches parsed envelopes', async () => {
    const { client, js } = createMockClient();
    const event = createEventEnvelope({
      name: 'workpackage.queued',
      producer: 'test-producer',
      correlationId: 'corr-event-sub',
    });
    const msg = createMockMessage({ envelope: event, subject: 'evt.runtime.test' });
    js.consumers.get.mockResolvedValue({
      consume: vi.fn(async () => createAsyncIterable([msg])),
    });

    const handler = vi.fn(async () => undefined);
    await client.subscribeEvents(
      {
        stream: STREAMS.EVENTS,
        durable: 'event-durable',
        filterSubject: 'evt.>',
      },
      handler,
    );

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledOnce();
      expect(msg.ack).toHaveBeenCalledOnce();
    });
    expect(handler.mock.calls[0]?.[0].name).toBe('workpackage.queued');
  });

  it('skips duplicate commands when idempotency key was seen', async () => {
    const store = new InMemoryIdempotencyStore();
    await store.mark('idem-dup');
    const { client, js } = createMockClient({ idempotencyStore: store });
    const command = createCommandEnvelope({
      name: 'workpackage.dispatch',
      producer: 'test-producer',
      correlationId: 'corr-dup',
      idempotencyKey: 'idem-dup',
    });
    const msg = createMockMessage({ envelope: command });
    js.consumers.get.mockResolvedValue({
      consume: vi.fn(async () => createAsyncIterable([msg])),
    });

    const handler = vi.fn(async () => undefined);
    await client.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: 'dup-durable',
        filterSubject: 'cmd.>',
      },
      handler,
    );

    await vi.waitFor(() => expect(msg.ack).toHaveBeenCalledOnce());
    expect(handler).not.toHaveBeenCalled();
  });

  it('marks idempotency key after successful command handling', async () => {
    const store = new InMemoryIdempotencyStore();
    const { client, js } = createMockClient({ idempotencyStore: store });
    const command = createCommandEnvelope({
      name: 'workpackage.dispatch',
      producer: 'test-producer',
      correlationId: 'corr-mark',
      idempotencyKey: 'idem-new',
    });
    const msg = createMockMessage({ envelope: command });
    js.consumers.get.mockResolvedValue({
      consume: vi.fn(async () => createAsyncIterable([msg])),
    });

    await client.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: 'mark-durable',
        filterSubject: 'cmd.>',
      },
      async () => undefined,
    );

    await vi.waitFor(() => expect(store.has('idem-new')).resolves.toBe(true));
  });

  it('naks failed handlers below max deliver', async () => {
    const { client, js } = createMockClient();
    const msg = createMockMessage({ deliveryCount: 1 });
    js.consumers.get.mockResolvedValue({
      consume: vi.fn(async () => createAsyncIterable([msg])),
    });

    await client.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: 'nak-durable',
        filterSubject: 'cmd.>',
        maxDeliver: 3,
      },
      async () => {
        throw new Error('handler failed');
      },
    );

    await vi.waitFor(() => expect(msg.nak).toHaveBeenCalledOnce());
    expect(msg.term).not.toHaveBeenCalled();
  });

  it('moves messages to DLQ when max deliver is exceeded', async () => {
    const { client, js, published } = createMockClient();
    const msgHeaders = headers();
    msgHeaders.set('x-correlation-id', 'corr-dlq');
    const msg = createMockMessage({ deliveryCount: 3, msgHeaders });
    js.consumers.get.mockResolvedValue({
      consume: vi.fn(async () => createAsyncIterable([msg])),
    });

    await client.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: 'dlq-durable',
        filterSubject: 'cmd.>',
        maxDeliver: 3,
      },
      async () => {
        throw new Error('terminal failure');
      },
    );

    await vi.waitFor(() => expect(msg.term).toHaveBeenCalledOnce());
    expect(published.some((entry) => entry.subject === 'dlq.cmd.orchestration')).toBe(true);
    expect(published[0]?.headers?.get('x-dlq-error')).toBe('terminal failure');
  });

  it('uses explicit ack/nak/term from handler context', async () => {
    const { client, js } = createMockClient();
    const msg = createMockMessage({});
    js.consumers.get.mockResolvedValue({
      consume: vi.fn(async () => createAsyncIterable([msg])),
    });

    await client.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: 'ctx-durable',
        filterSubject: 'cmd.>',
      },
      async (_command, ctx) => {
        ctx.nak(500);
      },
    );

    await vi.waitFor(() => expect(msg.nak).toHaveBeenCalledWith(500));
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it('extracts trace context from message headers during dispatch', async () => {
    const { client, js } = createMockClient();
    const msgHeaders = headers();
    injectTraceContext(msgHeaders);
    msgHeaders.set('x-correlation-id', 'corr-trace-msg');
    const msg = createMockMessage({ msgHeaders });
    js.consumers.get.mockResolvedValue({
      consume: vi.fn(async () => createAsyncIterable([msg])),
    });

    const handler = vi.fn(async () => undefined);
    await client.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: 'trace-durable',
        filterSubject: 'cmd.>',
      },
      handler,
    );

    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    expect(handler.mock.calls[0]?.[1].correlationId).toBe('corr-trace-msg');
  });

  it('reuses existing consumer when durable already exists', async () => {
    const { client, jsm } = createMockClient();
    jsm.consumers.info.mockResolvedValue({ name: 'existing-durable' });
    const msg = createMockMessage({});
    client.js.consumers.get = vi.fn(async () => ({
      consume: vi.fn(async () => createAsyncIterable([msg])),
    })) as never;

    await client.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: 'existing-durable',
        filterSubject: 'cmd.>',
      },
      async () => undefined,
    );

    await vi.waitFor(() => expect(msg.ack).toHaveBeenCalledOnce());
    expect(jsm.consumers.add).not.toHaveBeenCalled();
  });

  it('closes connection', async () => {
    const { client, nc } = createMockClient();
    await client.close();
    expect(nc.drain).toHaveBeenCalled();
  });
});

describe('tracing', () => {
  it('injects and extracts trace headers', () => {
    const hdrs = headers();
    injectTraceContext(hdrs);
    const ctx = extractTraceContext(hdrs);
    expect(ctx).toBeDefined();
  });

  it('extracts traceparent and tracestate when present', () => {
    const hdrs = headers();
    hdrs.set('traceparent', '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    hdrs.set('tracestate', 'vendor=value');
    const ctx = extractTraceContext(hdrs);
    expect(ctx).toBeDefined();
  });

  it('runs function inside span', async () => {
    const result = await withMessageSpan('test-span', 'corr-trace', async () => 'done');
    expect(result).toBe('done');
  });

  it('runs function inside span with parent context', async () => {
    const parent = extractTraceContext(headers());
    const result = await withMessageSpan(
      'parent-span',
      'corr-parent',
      async () => 'child',
      parent,
    );
    expect(result).toBe('child');
  });

  it('records span errors', async () => {
    await expect(
      withMessageSpan('fail-span', 'corr-fail', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('records non-error throwables on span', async () => {
    await expect(
      withMessageSpan('fail-span', 'corr-fail', async () => {
        throw 'plain-failure';
      }),
    ).rejects.toBe('plain-failure');
  });
});
