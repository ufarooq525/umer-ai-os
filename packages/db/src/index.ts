import { loadEnv } from '@umer/config';
import { Redis } from 'ioredis';
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import postgres from 'postgres';
import { OPPORTUNITY_MIGRATIONS } from './migrations.js';

export const packageName = '@umer/db' as const;

export type PostgresClient = ReturnType<typeof postgres>;
export type MySqlClient = Pool;

export type MySqlExecutor = {
  execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T>;
};

let pg: PostgresClient | undefined;
let mysqlPool: MySqlClient | undefined;
let redis: Redis | undefined;

/**
 * PostgreSQL connection bootstrap for existing application domains.
 * Keep this separate from the Revenue OS database.
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
 * MySQL pool for Opportunity Intelligence / Revenue OS persistence.
 * This deliberately uses a dedicated environment variable so the existing
 * PostgreSQL DATABASE_URL remains untouched.
 */
export function createMySqlClient(connectionString?: string): MySqlClient {
  if (mysqlPool) {
    return mysqlPool;
  }
  const env = loadEnv();
  mysqlPool = mysql.createPool({
    uri: connectionString ?? env.OPPORTUNITY_DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: true,
  });
  return mysqlPool;
}

export function createMySqlExecutor(pool: MySqlClient = createMySqlClient()): MySqlExecutor {
  return {
    async execute<T = unknown>(sql: string, params: readonly unknown[] = []): Promise<T> {
      const [rows] = await pool.execute(sql, params as never);
      return rows as T;
    },
  };
}

export async function pingMySql(client: MySqlClient = createMySqlClient()): Promise<boolean> {
  const [rows] = await client.query<RowDataPacket[]>('SELECT 1 AS ok');
  return Number(rows[0]?.ok) === 1;
}

export async function closeMySql(): Promise<void> {
  if (!mysqlPool) {
    return;
  }
  await mysqlPool.end();
  mysqlPool = undefined;
}

/**
 * Apply versioned Revenue OS migrations transactionally.
 * Each migration is registered before execution inside the same transaction,
 * so a failed migration rolls back both the marker and schema changes.
 */
export async function migrate(client: MySqlClient = createMySqlClient()): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(191) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME(3) NOT NULL
    )
  `);

  for (const migration of OPPORTUNITY_MIGRATIONS) {
    const connection = await client.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT IGNORE INTO schema_migrations (id, checksum, applied_at) VALUES (?, ?, UTC_TIMESTAMP(3))',
        [migration.id, migration.checksum],
      );

      if (result.affectedRows === 0) {
        await connection.commit();
        continue;
      }

      for (const statement of migration.statements) {
        await connection.query(statement);
      }

      await connection.commit();
      console.info(`[@umer/db] applied MySQL migration ${migration.id}`);
    } catch (error) {
      await connection.rollback();
      throw new Error(
        `Failed to apply MySQL migration ${migration.id}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    } finally {
      connection.release();
    }
  }
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

export async function seed(): Promise<void> {
  console.info('[@umer/db] seed: no seed data yet');
}
