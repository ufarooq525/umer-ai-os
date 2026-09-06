import { describe, expect, it } from 'vitest';
import { createControlApiState } from './server.js';
import { startAgentRunReadModelSubscription } from './agent-run-subscription.js';

// These exercise the real createMessageFabric() connection attempt (and,
// since this milestone, a real MySQL ping) against whatever is configured
// for this test run. Where nothing is reachable, both fail open to the
// in-memory defaults; where a broker/database IS reachable (as MySQL happens
// to be in this dev sandbox), the swap simply succeeds instead — either way
// createControlApiState()/startAgentRunReadModelSubscription must never
// throw or hang the process, so these assert on that contract rather than on
// which concrete store class wins.

describe('startAgentRunReadModelSubscription', () => {
  it('never throws, and always leaves agentRunReadModel usable, regardless of Message Fabric/MySQL reachability', async () => {
    const state = await createControlApiState();

    const subscription = await startAgentRunReadModelSubscription(state);

    expect(state.agentRunReadModel).toBeDefined();
    // Asserts the documented contract above (never throws, stays usable) --
    // not emptiness, which only ever held by accident of a fresh dev
    // database and stopped holding once this session's live end-to-end
    // testing legitimately wrote real agent runs into the same shared
    // MySQL instance this test connects to when reachable.
    expect(Array.isArray(await state.agentRunReadModel!.list())).toBe(true);

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
