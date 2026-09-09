import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@umer/db', () => ({
  pingMySql: vi.fn(async () => false),
}));

import { connectCustomerSuccessStore } from './customer-success-link.js';
import { CustomerSuccessEngine } from '@umer/opportunity-intelligence';

describe('connectCustomerSuccessStore', () => {
  const previous = process.env.AUTONOMY_REQUIRE_DURABLE_STATE;

  afterEach(() => {
    if (previous === undefined) delete process.env.AUTONOMY_REQUIRE_DURABLE_STATE;
    else process.env.AUTONOMY_REQUIRE_DURABLE_STATE = previous;
  });

  it('fails closed when autonomous durable state is required and MySQL is unreachable', async () => {
    process.env.AUTONOMY_REQUIRE_DURABLE_STATE = 'true';
    const state = {} as Parameters<typeof connectCustomerSuccessStore>[0];

    await expect(connectCustomerSuccessStore(state)).rejects.toThrow(
      /AUTONOMY_REQUIRE_DURABLE_STATE=true/,
    );
  });

  it('keeps the development-only in-memory customer success store when durable mode is not required', async () => {
    delete process.env.AUTONOMY_REQUIRE_DURABLE_STATE;
    const state = {} as Parameters<typeof connectCustomerSuccessStore>[0];

    await connectCustomerSuccessStore(state);

    expect(state.customerSuccess).toBeInstanceOf(CustomerSuccessEngine);
  });
});
