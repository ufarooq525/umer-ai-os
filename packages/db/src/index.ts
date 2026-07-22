import { loadEnv } from '@umer/config';
import { Redis } from 'ioredis';
import postgres from 'postgres';

export const packageName = '@umer/db' as const;

export type PostgresClient = ReturnType<typeof postgres>;

let pg: PostgresClient | undefined;
let redis: Redis | undefined;

/**
 * PostgreSQL connection bootstrap.
 * No schemas, migrations, or tables in Phase 6.
 */
export function createPostgresClient(connectionString?: string): PostgresClient {
  if (pg) {
    return pg;
  }
  const env = loadEnv();
  pg = postgres(connectionString ?? env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return pg;
}

export async function pingPostgres(client: PostgresClient = createPostgresClient()): Promise<boolean> {
  const rows = await client`select 1 as ok`;
  return rows[0]?.ok === 1;
}

export async function closePostgres(): Promise<void> {
  if (!pg) {
    return;
  }
  await pg.end({ timeout: 5 });
  pg = undefined;
}

/**
 * Redis connection bootstrap (cache / locks / rate limits).
 * No domain logic in Phase 6.
 */
export function createRedisClient(url?: string): Redis {
  if (redis) {
    return redis;
  }
  const env = loadEnv();
  redis = new Redis(url ?? env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  return redis;
}

export async function pingRedis(client: Redis = createRedisClient()): Promise<boolean> {
  if (client.status !== 'ready') {
    await client.connect();
  }
  const pong = await client.ping();
  return pong === 'PONG';
}

export async function closeRedis(): Promise<void> {
  if (!redis) {
    return;
  }
  await redis.quit();
  redis = undefined;
}

/** Placeholder scripts — no-op until Phase (database & storage). */
export async function migrate(): Promise<void> {
  console.info('[@umer/db] migrate: no migrations yet (skeleton)');
}

export async function seed(): Promise<void> {
  console.info('[@umer/db] seed: no seed data yet (skeleton)');
}
