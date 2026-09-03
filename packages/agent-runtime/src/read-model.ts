import type { EventEnvelope } from '@umer/contracts';
import type { AgentRegistryStore, AgentRunReadModelStore } from '@umer/observability';
import {
  STREAMS,
  SUBJECTS,
  InMemoryIdempotencyStore,
  type IdempotencyStore,
  type SubscriptionHandle,
} from '@umer/message-fabric';

/**
 * The minimal Message Fabric surface this subscriber needs — narrower than the
 * full MessageFabricClient so it stays trivially testable without a NATS
 * connection or its mocked internals. A real MessageFabricClient satisfies
 * this structurally (see read-model.test.ts's real-client integration test).
 */
export type RuntimeEventSource = {
  subscribeEvents: (
    options: { stream: string; durable: string; filterSubject: string },
    handler: (event: EventEnvelope, ctx: { ack: () => void }) => Promise<void>,
  ) => Promise<SubscriptionHandle>;
};

export type SubscribeAgentRunReadModelOptions = {
  /** JetStream durable consumer name — defaults to a fixed, stable name. */
  durable?: string;
  /**
   * Dedupes redelivered events by `eventId` before projecting them. Defaults to
   * a fresh in-memory store, reusing the exact IdempotencyStore
   * abstraction/interface `@umer/message-fabric` already uses for command
   * dedup — JetStream's at-least-once delivery can redeliver an event (e.g. a
   * crash between processing and ack), and unlike CommandEnvelope,
   * EventEnvelope has no caller-supplied idempotencyKey, so `eventId` (unique
   * per publish) is the natural dedup key here.
   */
  idempotencyStore?: IdempotencyStore;
  /**
   * Optional sibling Agent Registry store (@umer/observability's
   * agent-registry.ts) — projected from the SAME subscription rather than a
   * second NATS consumer on the same subject, since both stores key off the
   * same evt.runtime.agent.> events and share the same idempotency gate.
   */
  agentRegistry?: AgentRegistryStore;
};

/**
 * Wires the Agent Run read-model projector (packages/observability/src/agent-run-read-model.ts)
 * — and, when supplied, the Agent Registry projector (agent-registry.ts) — to
 * the real Message Fabric event stream. This is the "smallest architecture-
 * consistent" fix for the read-model gap: no new database, no new transport —
 * it subscribes to the same evt.runtime.agent.> events every agent-worker
 * already publishes, using the existing subscribeEvents API.
 */
export async function subscribeAgentRunReadModel(
  fabric: RuntimeEventSource,
  store: AgentRunReadModelStore,
  options: SubscribeAgentRunReadModelOptions = {},
): Promise<SubscriptionHandle> {
  const idempotency = options.idempotencyStore ?? new InMemoryIdempotencyStore();

  return fabric.subscribeEvents(
    {
      stream: STREAMS.EVENTS,
      durable: options.durable ?? 'agent-run-read-model',
      filterSubject: `${SUBJECTS.EVT_RUNTIME}.agent.>`,
    },
    async (event, ctx) => {
      if (await idempotency.has(event.eventId)) {
        // Redelivery of an event we already folded into the read model — ack
        // and move on without projecting it a second time.
        ctx.ack();
        return;
      }
      await store.project(event);
      await options.agentRegistry?.project(event);
      await idempotency.mark(event.eventId);
      ctx.ack();
    },
  );
}
