import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@umer/db', () => ({
  pingMySql: vi.fn(async () => false),
  createMySqlExecutor: vi.fn(),
}));

import { connectWorkGraphStore } from './work-graph-link.js';
import { InMemoryWorkGraphStore } from '@umer/orchestration';

describe('connectWorkGraphStore', () => {
  const previous = process.env.AUTONOMY_REQUIRE_DURABLE_STATE;

  afterEach(() => {
    if (previous === undefined) delete process.env.AUTONOMY_REQUIRE_DURABLE_STATE;
    else process.env.AUTONOMY_REQUIRE_DURABLE_STATE = previous;
  });

  it('fails closed when autonomous durable state is required and MySQL is unreachable', async () => {
    process.env.AUTONOMY_REQUIRE_DURABLE_STATE = 'true';
    const state = {} as Parameters<typeof connectWorkGraphStore>[0];

    await expect(connectWorkGraphStore(state)).rejects.toThrow(
      /AUTONOMY_REQUIRE_DURABLE_STATE is enabled/,
    );
  });

  it('keeps in-memory store in development when durable mode is not required', async () => {
    delete process.env.AUTONOMY_REQUIRE_DURABLE_STATE;
    const state = {} as Parameters<typeof connectWorkGraphStore>[0];

    await connectWorkGraphStore(state);

    expect(state.workGraphStore).toBeInstanceOf(InMemoryWorkGraphStore);
  });
});
