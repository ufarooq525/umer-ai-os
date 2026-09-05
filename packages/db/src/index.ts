import { loadEnv } from '@umer/config';
import { Redis } from 'ioredis';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import postgres from 'postgres';
import { OPPORTUNITY_MIGRATIONS } from './migrations.js';
import { WORKFORCE_MIGRATIONS } from './workforce-migrations.js';
import { AI_OS_KERNEL_MIGRATIONS } from './ai-os-kernel-migrations.js';
import { AI_KERNEL_TELEMETRY_MIGRATIONS } from './ai-kernel-telemetry-migrations.js';
import { AI_KERNEL_RUNTIME_HARDENING_MIGRATIONS } from './ai-kernel-runtime-hardening-migration.js';
import { AI_KERNEL_EXPLAINABILITY_MIGRATIONS } from './ai-kernel-explainability-migration.js';
import { AI_OS_CONTROL_LINEAGE_MIGRATIONS } from './ai-os-control-lineage-migration.js';
import { AI_WORKER_SUPERVISOR_MIGRATIONS } from './ai-worker-supervisor-migration.js';
import { AI_WORKFORCE_TRUTH_MIGRATIONS } from './ai-workforce-truth-migration.js';
import { WORK_GRAPH_MIGRATIONS } from './work-graph-migration.js';

export const ALL_MYSQL_MIGRATIONS = [
  ...OPPORTUNITY_MIGRATIONS,
  ...WORKFORCE_MIGRATIONS,
  ...AI_OS_KERNEL_MIGRATIONS,
  ...AI_KERNEL_TELEMETRY_MIGRATIONS,
  ...AI_KERNEL_RUNTIME_HARDENING_MIGRATIONS,
  ...AI_KERNEL_EXPLAINABILITY_MIGRATIONS,
  ...AI_OS_CONTROL_LINEAGE_MIGRATIONS,
  ...AI_WORKER_SUPERVISOR_MIGRATIONS,
  ...AI_WORKFORCE_TRUTH_MIGRATIONS,
  ...WORK_GRAPH_MIGRATIONS,
];

export const packageName = '@umer/db' as const;
export type PostgresClient = ReturnType<typeof postgres>;
export type MySqlClient = Pool;
export type MySqlExecutor = { execute<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T> };

let pg: PostgresClient | undefined;
let mysqlPool: MySqlClient | undefined;
let redis: Redis | undefined;

export function createPostgresClient(connectionString?: string): PostgresClient {
  if (pg) return pg;
  const env = loadEnv();
  pg = postgres(connectionString ?? env.DATABASE_URL, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  return pg;
}
export async function pingPostgres(client: PostgresClient = createPostgresClient()): Promise<boolean> { return (await client`select 1 as ok`)[0]?.ok === 1; }
export async function closePostgres(): Promise<void> { if (pg) { await pg.end({ timeout: 5 }); pg = undefined; } }

export function createMySqlClient(connectionString?: string): MySqlClient {
  if (mysqlPool) return mysqlPool;
  const env = loadEnv();
  mysqlPool = mysql.createPool({ uri: connectionString ?? env.OPPORTUNITY_DATABASE_URL, waitForConnections: true, connectionLimit: 10, maxIdle: 10, idleTimeout: 60_000, queueLimit: 0, enableKeepAlive: true, keepAliveInitialDelay: 0, dateStrings: true });
  return mysqlPool;
}
export function createMySqlExecutor(pool: MySqlClient = createMySqlClient()): MySqlExecutor { return { async execute<T = unknown>(sql: string, params: readonly unknown[] = []) { const [rows] = await pool.execute(sql, params as never); return rows as T; } }; }
export async function pingMySql(client: MySqlClient = createMySqlClient()): Promise<boolean> { const [rows] = await client.query<RowDataPacket[]>('SELECT 1 AS ok'); return Number(rows[0]?.ok) === 1; }
export async function closeMySql(): Promise<void> { if (mysqlPool) { await mysqlPool.end(); mysqlPool = undefined; } }

export async function migrate(client: MySqlClient = createMySqlClient()): Promise<void> {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(191) PRIMARY KEY, checksum VARCHAR(191) NOT NULL, applied_at DATETIME(3) NOT NULL)');
  for (const migration of ALL_MYSQL_MIGRATIONS) {
    for (const statement of migration.statements) {
      try { await client.query(statement); } catch (err: any) { if (!['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', '1060', '1061'].includes(err?.code || String(err?.errno))) throw err; }
    }
    const [rows] = await client.query<RowDataPacket[]>('SELECT id FROM schema_migrations WHERE id = ?', [migration.id]);
    if (rows.length === 0) await client.execute('INSERT INTO schema_migrations (id, checksum, applied_at) VALUES (?, ?, UTC_TIMESTAMP(3))', [migration.id, migration.checksum]);
  }
}

export function createRedisClient(url?: string): Redis { if (redis) return redis; redis = new Redis(url ?? loadEnv().REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true }); return redis; }
export async function pingRedis(client: Redis = createRedisClient()): Promise<boolean> { if (client.status !== 'ready') await client.connect(); return (await client.ping()) === 'PONG'; }
export async function closeRedis(): Promise<void> { if (redis) { await redis.quit(); redis = undefined; } }
export async function seed(): Promise<void> { console.info('[@umer/db] seed: no seed data yet'); }
