import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect } from 'nats';
import { MessageFabricClient } from './client.js';
import { STREAMS, SUBJECTS } from './constants.js';
import { createCommandEnvelope, createEventEnvelope } from './envelopes.js';
import { InMemoryIdempotencyStore } from './idempotency.js';

const runIntegration = process.env.RUN_NATS_INTEGRATION === '1';

describe.skipIf(!runIntegration)('NATS integration', () => {
  let client: MessageFabricClient;

  beforeAll(async () => {
    const nc = await connect({ servers: process.env.NATS_URL ?? 'nats://localhost:4222' });
    const js = nc.jetstream();
    const jsm = await nc.jetstreamManager();
    client = new MessageFabricClient({
      nc,
      js,
      jsm,
      producer: 'integration-test',
      idempotencyStore: new InMemoryIdempotencyStore(),
    });
    await client.ensureInfrastructure();
  }, 15_000);

  afterAll(async () => {
    await client?.close();
  });

  it('publishes and consumes a command with correlation id', async () => {
    const correlationId = `test-${Date.now()}`;
    const received: string[] = [];

    const sub = await client.subscribeCommands(
      {
        stream: STREAMS.COMMANDS,
        durable: `test-consumer-${Date.now()}`,
        filterSubject: SUBJECTS.CMD_ORCHESTRATION,
        maxDeliver: 3,
      },
      async (command) => {
        received.push(command.correlationId);
      },
    );

    const command = createCommandEnvelope({
      name: 'workpackage.dispatch',
      producer: 'integration-test',
      correlationId,
      payload: { test: true },
    });

    await client.publishCommand(SUBJECTS.CMD_ORCHESTRATION, command);

    await new Promise((r) => setTimeout(r, 1500));
    await sub.stop();

    expect(received).toContain(correlationId);
  });

  it('publishes an event', async () => {
    const event = createEventEnvelope({
      name: 'workpackage.queued',
      producer: 'integration-test',
      correlationId: `evt-${Date.now()}`,
    });
    await expect(
      client.publishEvent(`${SUBJECTS.EVT_RUNTIME}.workpackage`, event),
    ).resolves.toBeUndefined();
  });
});
