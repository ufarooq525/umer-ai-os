import { loadEnv } from '@umer/config';
import { createLogger } from '@umer/observability';
import { connect } from 'nats';
import { MessageFabricClient } from './client.js';
import type { IdempotencyStore } from './idempotency.js';

export const packageName = '@umer/message-fabric' as const;

const log = createLogger('message-fabric');

let client: MessageFabricClient | undefined;

export type CreateMessageFabricOptions = {
  servers?: string;
  producer?: string;
  idempotencyStore?: IdempotencyStore;
  ensureInfrastructure?: boolean;
};

/**
 * Connect to NATS JetStream and return a typed Message Fabric client.
 */
export async function createMessageFabric(
  options: CreateMessageFabricOptions = {},
): Promise<MessageFabricClient> {
  if (client) {
    return client;
  }

  const env = loadEnv();
  const nc = await connect({
    servers: options.servers ?? env.NATS_URL,
    name: options.producer ?? env.OTEL_SERVICE_NAME,
  });

  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  client = new MessageFabricClient({
    nc,
    js,
    jsm,
    producer: options.producer ?? env.OTEL_SERVICE_NAME,
    idempotencyStore: options.idempotencyStore,
  });

  if (options.ensureInfrastructure !== false) {
    await client.ensureInfrastructure();
  }

  log.info({ servers: options.servers ?? env.NATS_URL }, 'message fabric connected');
  return client;
}

export async function closeMessageFabric(): Promise<void> {
  if (!client) {
    return;
  }
  await client.close();
  client = undefined;
}

/** @internal Reset singleton for tests. */
export function resetMessageFabricSingleton(): void {
  client = undefined;
}
