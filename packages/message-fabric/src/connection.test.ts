import { describe, expect, it, vi, afterEach } from 'vitest';
import { createMessageFabric, closeMessageFabric, resetMessageFabricSingleton } from './connection.js';

vi.mock('nats', async () => {
  const actual = await vi.importActual('nats');
  return {
    ...actual,
    connect: vi.fn(async () => ({
      jetstream: () => ({
        publish: vi.fn(async () => ({ seq: 1 })),
        consumers: { get: vi.fn() },
      }),
      jetstreamManager: () => ({
        streams: {
          info: vi.fn(async () => {
            throw new Error('not found');
          }),
          add: vi.fn(async () => undefined),
        },
        consumers: {
          info: vi.fn(async () => {
            throw new Error('not found');
          }),
          add: vi.fn(async () => undefined),
        },
      }),
      drain: vi.fn(async () => undefined),
    })),
  };
});

describe('createMessageFabric', () => {
  afterEach(async () => {
    await closeMessageFabric();
    resetMessageFabricSingleton();
  });

  it('connects and returns singleton client', async () => {
    const client = await createMessageFabric({ producer: 'unit-test' });
    expect(client.producer).toBe('unit-test');
    const again = await createMessageFabric();
    expect(again).toBe(client);
  });

  it('closes and resets singleton', async () => {
    await createMessageFabric({ producer: 'unit-test' });
    await closeMessageFabric();
    resetMessageFabricSingleton();
    const client = await createMessageFabric({ producer: 'unit-test-2' });
    expect(client.producer).toBe('unit-test-2');
  });

  it('no-ops close when client was never created', async () => {
    await expect(closeMessageFabric()).resolves.toBeUndefined();
  });
});
