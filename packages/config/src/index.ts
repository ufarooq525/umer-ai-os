import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

/**
 * Typed environment configuration (Runtime Kernel concern).
 * Skeleton only — no feature-flag product logic.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().default('postgres://umer:umer@localhost:5432/umer_ai_os'),
  /** Dedicated MySQL persistence for Opportunity Intelligence / Revenue OS. */
  OPPORTUNITY_DATABASE_URL: z
    .string()
    .default('mysql://umer_revenue:umer_revenue@localhost:3306/umer_revenue_os'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  NATS_URL: z.string().default('nats://localhost:4222'),

  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_BUCKET_ARTIFACTS: z.string().default('umer-artifacts'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((v) => v === 'true' || v === '1'),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_SERVICE_NAME: z.string().default('umer-ai-os'),

  CONTROL_API_PORT: z.coerce.number().default(4000),
  GATEWAY_PORT: z.coerce.number().default(4080),
  WEB_PORT: z.coerce.number().default(3000),
  /** HTTP probe port for workers (K8s/Docker healthchecks). */
  HEALTH_PORT: z.coerce.number().default(8080),
  NEXT_PUBLIC_CONTROL_API_URL: z.string().default('http://127.0.0.1:4000'),
  /** Root folder that contains Laragon project directories. */
  UMER_PROJECTS_ROOT: z.string().default('C:/laragon/www'),
  /** Optional absolute path to projects/catalog.json */
  UMER_PROJECTS_CATALOG: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(overrides?: Partial<Record<keyof Env, string | number | boolean>>): Env {
  if (cached && !overrides) {
    return cached;
  }
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}

export const packageName = '@umer/config' as const;
