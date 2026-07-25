import { randomUUID } from 'node:crypto';
import type {
  BusEvent,
  BusEventType,
  BusHandler,
  BusPublishResult,
  BusEventSource,
  BusEventPayloadByType,
} from './types.js';

type HandlerEntry = {
  id: string;
  type: BusEventType;
  handler: BusHandler;
};

export type CreateBusEventInput<T extends BusEventType> = {
  type: T;
  projectId: string;
  source: BusEventSource;
  payload: BusEventPayloadByType[T];
  correlationId?: string;
  eventId?: string;
  occurredAt?: string;
};

/**
 * In-process publish/subscribe bus (shim plane).
 *
 * Synchronous fan-out: publish awaits every matching handler in registration order.
 * No durability, retries, or NATS — those stay with Message Fabric later.
 */
export class EventBus {
  private readonly handlers: HandlerEntry[] = [];
  private readonly history: BusEvent[] = [];
  private readonly historyLimit: number;

  constructor(options?: { historyLimit?: number }) {
    this.historyLimit = options?.historyLimit ?? 200;
  }

  subscribe<T extends BusEventType>(type: T, handler: BusHandler<T>): () => void {
    const entry: HandlerEntry = {
      id: randomUUID(),
      type,
      handler: handler as BusHandler,
    };
    this.handlers.push(entry);
    return () => {
      const idx = this.handlers.findIndex((h) => h.id === entry.id);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  createEvent<T extends BusEventType>(input: CreateBusEventInput<T>): BusEvent<T> {
    return {
      eventId: input.eventId?.trim() || `evt_${randomUUID().replace(/-/g, '')}`,
      type: input.type,
      projectId: input.projectId,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      correlationId: input.correlationId?.trim() || `corr_${randomUUID().replace(/-/g, '')}`,
      source: input.source,
      payload: input.payload,
    };
  }

  async publish(event: BusEvent): Promise<BusPublishResult> {
    this.history.push(event);
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }

    const matched = this.handlers.filter((h) => h.type === event.type);
    const results: unknown[] = [];
    for (const entry of matched) {
      results.push(await entry.handler(event));
    }
    return { event, handlerCount: matched.length, results };
  }

  async publishNew<T extends BusEventType>(
    input: CreateBusEventInput<T>,
  ): Promise<BusPublishResult> {
    return this.publish(this.createEvent(input));
  }

  listHistory(filter?: { type?: BusEventType; projectId?: string }): BusEvent[] {
    return this.history.filter((event) => {
      if (filter?.type && event.type !== filter.type) return false;
      if (filter?.projectId && event.projectId !== filter.projectId) return false;
      return true;
    });
  }
}

export function createEventBus(options?: { historyLimit?: number }): EventBus {
  return new EventBus(options);
}
