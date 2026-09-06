import {
  createLogger,
  InMemoryAgentRegistryStore,
  InMemoryAgentRunReadModelStore,
  MySqlAgentRegistryStore,
  MySqlAgentRunReadModelStore,
} from '@umer/observability';
import { subscribeAgentRunReadModel } from '@umer/agent-runtime';
import { createMessageFabric, type SubscriptionHandle } from '@umer/message-fabric';
import { pingMySql, createMySqlExecutor } from '@umer/db';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Connects to the Message Fabric and wires the Agent Run read-model AND
 * Agent Registry subscribers (packages/agent-runtime/src/read-model.ts) —
 * one subscription, both stores kept in sync — so `state.agentRunReadModel`
 * and `state.agentRegistry` start reflecting real evt.runtime.agent.>
 * events. control-api is the blueprint's designated read-model owner
 * (MONOREPO_BLUEPRINT.md §2), so this is the one place that wiring happens —
 * not a second service.
 *
 * Deliberately NOT called from createControlApiState(): that function is
 * constructed directly by the existing control-api test suite (server.test.ts,
 * gate-review.test.ts, etc.) with no NATS available, and must keep working
 * exactly as before. This is boot-only, called once from main.ts, and never
 * throws — if the Message Fabric is unreachable, control-api still starts and
 * serves everything else; `/v1/agent-runs` and `/v1/agents` just stay empty
 * until a broker is reachable (the same fail-open shape as
 * `resolveCodeProducer()`'s fallback).
 */
export async function startAgentRunReadModelSubscription(
  state: ControlApiState,
): Promise<SubscriptionHandle | undefined> {
  if (!state.agentRunReadModel) {
    state.agentRunReadModel = new InMemoryAgentRunReadModelStore();
  }
  if (!state.agentRegistry) {
    state.agentRegistry = new InMemoryAgentRegistryStore();
  }

  // Best-effort MySQL swap — same fail-open pattern as every other store in
  // this file. Done before subscribing so every projected event lands on the
  // durable store from the start, not just ones that arrive after a later
  // swap. Without MySQL, both stay in-memory and reset on restart, same as
  // before this existed.
  try {
    if (await pingMySql()) {
      const db = createMySqlExecutor();
      state.agentRunReadModel = new MySqlAgentRunReadModelStore({ db });
      state.agentRegistry = new MySqlAgentRegistryStore({ db });
      log.info('agent-run read model + agent registry connected to MySQL');
    } else {
      throw new Error('pingMySql returned false');
    }
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'agent-run read model / agent registry MySQL unavailable — using in-memory stores; they will not survive a restart until this recovers',
    );
  }

  try {
    const fabric = await createMessageFabric({ producer: 'control-api' });
    const subscription = await subscribeAgentRunReadModel(fabric, state.agentRunReadModel, {
      agentRegistry: state.agentRegistry,
    });
    log.info('agent-run read model + agent registry subscribed to evt.runtime.agent.>');
    return subscription;
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'agent-run read model subscription unavailable (Message Fabric unreachable) — /v1/agent-runs and /v1/agents will stay empty until this recovers',
    );
    return undefined;
  }
}
