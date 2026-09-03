import { describe, expect, it } from 'vitest';
import { InMemoryAgentRunReadModelStore } from '@umer/observability';
import { createControlApiState } from './server.js';
import { startAgentRunReadModelSubscription } from './agent-run-subscription.js';

// These exercise the real createMessageFabric() connection attempt against
// whatever NATS_URL is configured for this test run. In this environment (and
// in CI, which has no NATS broker) nothing is listening there, so the
// connection is refused — exactly the "Message Fabric unreachable" path this
// test proves control-api survives. Where NATS_URL does point at a live
// broker, the subscription simply succeeds instead, which is equally fine —
// either way createControlApiState()/startAgentRunReadModelSubscription must
// never throw or hang the process.

describe('startAgentRunReadModelSubscription', () => {
  it('never throws, and always leaves agentRunReadModel usable, regardless of Message Fabric reachability', async () => {
    const state = await createControlApiState();

    const subscription = await startAgentRunReadModelSubscription(state);

    expect(state.agentRunReadModel).toBeInstanceOf(InMemoryAgentRunReadModelStore);
    expect(await state.agentRunReadModel!.list()).toEqual([]);

    await subscription?.stop();
  }, 20_000);

  it('initializes agentRunReadModel even if it was not pre-populated on the state', async () => {
    const state = await createControlApiState();
    state.agentRunReadModel = undefined;

    const subscription = await startAgentRunReadModelSubscription(state);

    expect(state.agentRunReadModel).toBeDefined();
    await subscription?.stop();
  }, 20_000);
});
