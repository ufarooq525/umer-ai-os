import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@umer/db', () => ({
  pingMySql: vi.fn(async () => false),
}));

import { connectOpportunityReader } from './opportunity-link.js';
import { InMemoryOpportunityPersistence } from '@umer/opportunity-intelligence';

describe('connectOpportunityReader', () => {
  const previous = process.env.AUTONOMY_REQUIRE_DURABLE_STATE;

  afterEach(() => {
    if (previous === undefined) delete process.env.AUTONOMY_REQUIRE_DURABLE_STATE;
    else process.env.AUTONOMY_REQUIRE_DURABLE_STATE = previous;
  });

  it('fails closed when autonomous durable state is required', async () => {
    process.env.AUTONOMY_REQUIRE_DURABLE_STATE = 'true';
    const state = {} as Parameters<typeof connectOpportunityReader>[0];

    await expect(connectOpportunityReader(state)).rejects.toThrow(
      /AUTONOMY_REQUIRE_DURABLE_STATE=true/,
    );
  });

  it('keeps the development-only in-memory reader when durable mode is not required', async () => {
    delete process.env.AUTONOMY_REQUIRE_DURABLE_STATE;
    const state = {} as Parameters<typeof connectOpportunityReader>[0];

    await connectOpportunityReader(state);

    expect(state.opportunityReader).toBeInstanceOf(InMemoryOpportunityPersistence);
  });
});
