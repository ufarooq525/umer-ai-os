import {
  AckPolicy,
  DeliverPolicy,
  JSONCodec,
  RetentionPolicy,
  StorageType,
  headers,
  type JetStreamClient,
  type JetStreamManager,
  type JsMsg,
  type NatsConnection,
  type Subscription,
} from 'nats';
import { createLogger } from '@umer/observability';
import type { CommandEnvelope, EventEnvelope } from '@umer/contracts';
import { DEFAULT_ACK_WAIT_MS, DEFAULT_MAX_DELIVER, DEFAULT_REQUEST_TIMEOUT_MS, STREAMS } from './constants.js';
import { parseCommandEnvelope, parseEventEnvelope } from './envelopes.js';
import { type IdempotencyStore, InMemoryIdempotencyStore } from './idempotency.js';
import { injectTraceContext, extractTraceContext, withMessageSpan } from './tracing.js';

const log = createLogger('message-fabric');
const jc = JSONCodec<unknown>();

export type MessageAckContext = {
  correlationId: string;
  deliveryCount: number;
  ack: () => void;
  nak: (delayMs?: number) => void;
  term: () => void;
};

export type CommandHandler = (
  command: CommandEnvelope,
  ctx: MessageAckContext,
) => Promise<void>;

export type EventHandler = (event: EventEnvelope, ctx: MessageAckContext) => Promise<void>;

export type SubscribeOptions = {
  stream: string;
  durable: string;
  filterSubject: string;
  maxDeliver?: number;
  ackWaitMs?: number;
  idempotencyStore?: IdempotencyStore;
};

export type MessageFabricClientOptions = {
  nc: NatsConnection;
  js: JetStreamClient;
  jsm: JetStreamManager;
  producer: string;
  idempotencyStore?: IdempotencyStore;
};

export type SubscriptionHandle = {
  stop: () => Promise<void>;
};

export class MessageFabricClient {
  readonly nc: NatsConnection;
  readonly js: JetStreamClient;
  readonly jsm: JetStreamManager;
  readonly producer: string;
  private readonly idempotency: IdempotencyStore;
  private readonly subscriptions: Subscription[] = [];
  private closed = false;

  constructor(options: MessageFabricClientOptions) {
    this.nc = options.nc;
    this.js = options.js;
    this.jsm = options.jsm;
    this.producer = options.producer;
    this.idempotency = options.idempotencyStore ?? new InMemoryIdempotencyStore();
  }

  async ensureInfrastructure(): Promise<void> {
    await this.ensureStream(STREAMS.COMMANDS, ['cmd.>']);
    await this.ensureStream(STREAMS.EVENTS, ['evt.>']);
    await this.ensureStream(STREAMS.DLQ, ['dlq.>']);
  }

  private async ensureStream(name: string, subjects: string[]): Promise<void> {
    try {
      await this.jsm.streams.info(name);
    } catch {
      await this.jsm.streams.add({
        name,
        subjects,
        retention: RetentionPolicy.Limits,
        storage: StorageType.File,
      });
      log.info({ stream: name, subjects }, 'jetstream stream created');
    }
  }

  async publishCommand(subject: string, command: CommandEnvelope): Promise<void> {
    await this.publishJetStream(subject, command, 'command');
  }

  async publishEvent(subject: string, event: EventEnvelope): Promise<void> {
    await this.publishJetStream(subject, event, 'event');
  }

  private async publishJetStream(
    subject: string,
    envelope: CommandEnvelope | EventEnvelope,
    kind: 'command' | 'event',
  ): Promise<void> {
    const hdrs = headers();
    injectTraceContext(hdrs);
    hdrs.set('x-correlation-id', envelope.correlationId);
    hdrs.set('x-envelope-kind', kind);

    await withMessageSpan(`message-fabric.publish.${kind}`, envelope.correlationId, async () => {
      await this.js.publish(subject, jc.encode(envelope), { headers: hdrs });
    });
  }

  async requestCommand(
    subject: string,
    command: CommandEnvelope,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<CommandEnvelope> {
    const hdrs = headers();
    injectTraceContext(hdrs);
    hdrs.set('x-correlation-id', command.correlationId);

    return withMessageSpan('message-fabric.request', command.correlationId, async () => {
      const response = await this.nc.request(subject, jc.encode(command), {
        timeout: timeoutMs,
        headers: hdrs,
      });
      return parseCommandEnvelope(jc.decode(response.data));
    });
  }

  async subscribeCommands(
    options: SubscribeOptions,
    handler: CommandHandler,
  ): Promise<SubscriptionHandle> {
    return this.subscribeEnvelope('command', options, async (data, ctx) => {
      const command = parseCommandEnvelope(data);
      if (command.idempotencyKey && (await this.idempotency.has(command.idempotencyKey))) {
        log.info({ idempotencyKey: command.idempotencyKey }, 'duplicate command skipped');
        ctx.ack();
        return;
      }
      await handler(command, ctx);
      if (command.idempotencyKey) {
        await this.idempotency.mark(command.idempotencyKey);
      }
    });
  }

  async subscribeEvents(
    options: SubscribeOptions,
    handler: EventHandler,
  ): Promise<SubscriptionHandle> {
    return this.subscribeEnvelope('event', options, async (data, ctx) => {
      const event = parseEventEnvelope(data);
      await handler(event, ctx);
    });
  }

  private async subscribeEnvelope(
    kind: 'command' | 'event',
    options: SubscribeOptions,
    handler: (data: unknown, ctx: MessageAckContext) => Promise<void>,
  ): Promise<SubscriptionHandle> {
    const maxDeliver = options.maxDeliver ?? DEFAULT_MAX_DELIVER;

    await this.ensureConsumer(options.stream, options.durable, {
      filter_subject: options.filterSubject,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      max_deliver: maxDeliver,
      ack_wait: (options.ackWaitMs ?? DEFAULT_ACK_WAIT_MS) * 1_000_000,
    });

    const consumer = await this.js.consumers.get(options.stream, options.durable);
    const messages = await consumer.consume();

    const loop = (async () => {
      for await (const msg of messages) {
        if (this.closed) {
          break;
        }
        await this.dispatchMessage(kind, msg, maxDeliver, handler);
      }
    })();

    void loop.catch((err) => {
      log.error({ err }, 'consumer loop failed');
    });

    return {
      stop: async () => {
        await messages.close();
      },
    };
  }

  private async ensureConsumer(
    stream: string,
    durable: string,
    config: Parameters<JetStreamManager['consumers']['add']>[1],
  ): Promise<void> {
    try {
      await this.jsm.consumers.info(stream, durable);
    } catch {
      await this.jsm.consumers.add(stream, { durable_name: durable, ...config });
    }
  }

  private async dispatchMessage(
    kind: 'command' | 'event',
    msg: JsMsg,
    maxDeliver: number,
    handler: (data: unknown, ctx: MessageAckContext) => Promise<void>,
  ): Promise<void> {
    const parentCtx = msg.headers ? extractTraceContext(msg.headers) : undefined;
    const correlationId =
      msg.headers?.get('x-correlation-id') ?? msg.subject;

    let settled = false;
    const ctx: MessageAckContext = {
      correlationId,
      deliveryCount: msg.info.deliveryCount,
      ack: () => {
        msg.ack();
        settled = true;
      },
      nak: (delayMs) => {
        msg.nak(delayMs);
        settled = true;
      },
      term: () => {
        msg.term();
        settled = true;
      },
    };

    try {
      await withMessageSpan(
        `message-fabric.consume.${kind}`,
        correlationId,
        async () => {
          const data = jc.decode(msg.data);
          await handler(data, ctx);
        },
        parentCtx,
      );
      if (!settled) {
        msg.ack();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ subject: msg.subject, deliveryCount: msg.info.deliveryCount, err: message }, 'handler failed');

      if (msg.info.deliveryCount >= maxDeliver) {
        await this.publishToDlq(msg, message);
        msg.term();
        return;
      }

      msg.nak();
    }
  }

  private async publishToDlq(msg: JsMsg, errorMessage: string): Promise<void> {
    const dlqSubject = `dlq.${msg.subject}`;
    const hdrs = headers();
    if (msg.headers) {
      for (const key of msg.headers.keys()) {
        const value = msg.headers.get(key);
        if (value) {
          hdrs.set(key, value);
        }
      }
    }
    hdrs.set('x-dlq-error', errorMessage);
    hdrs.set('x-original-subject', msg.subject);

    await this.js.publish(dlqSubject, msg.data, { headers: hdrs });
    log.warn({ dlqSubject, error: errorMessage }, 'message moved to DLQ');
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    await this.nc.drain();
    log.info('message fabric client closed');
  }
}

export type { NatsConnection, JetStreamClient, JetStreamManager };
