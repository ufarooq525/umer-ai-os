import { createLogger, InMemoryAgentRunReadModelStore } from '@umer/observability';
import { subscribeAgentRunReadModel } from '@umer/agent-runtime';
import { createMessageFabric, type SubscriptionHandle } from '@umer/message-fabric';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Connects to the Message Fabric and wires the Agent Run read-model
 * subscriber (packages/agent-runtime/src/read-model.ts) so `state.agentRunReadModel`
 * starts reflecting real evt.runtime.agent.> events. control-api is the
 * blueprint's designated read-model owner (MONOREPO_BLUEPRINT.md §2), so this
 * is the one place that wiring happens — not a second service.
 *
 * Deliberately NOT called from createControlApiState(): that function is
 * constructed directly by the existing control-api test suite (server.test.ts,
 * gate-review.test.ts, etc.) with no NATS available, and must keep working
 * exactly as before. This is boot-only, called once from main.ts, and never
 * throws — if the Message Fabric is unreachable, control-api still starts and
 * serves everything else; `/v1/agent-runs` just stays empty until a broker is
 * reachable (the same fail-open shape as `resolveCodeProducer()`'s fallback).
 */
export async function startAgentRunReadModelSubscription(
  state: ControlApiState,
): Promise<SubscriptionHandle | undefined> {
  if (!state.agentRunReadModel) {
    state.agentRunReadModel = new InMemoryAgentRunReadModelStore();
  }

  try {
    const fabric = await createMessageFabric({ producer: 'control-api' });
    const subscription = await subscribeAgentRunReadModel(fabric, state.agentRunReadModel);
    log.info('agent-run read model subscribed to evt.runtime.agent.>');
    return subscription;
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'agent-run read model subscription unavailable (Message Fabric unreachable) — /v1/agent-runs will stay empty until this recovers',
    );
    return undefined;
  }
}
