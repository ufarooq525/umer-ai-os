import { loadEnv } from '@umer/config';
import { startRuntime, startHealthServer, healthCheck } from '@umer/kernel';
import { createAuditStack } from '@umer/audit';
import { createLogger } from '@umer/observability';

const serviceName = 'audit-sink';
const log = createLogger(serviceName);
const env = loadEnv();
const { service: auditService } = createAuditStack();

const health = await startHealthServer({
  serviceName,
  port: env.HEALTH_PORT,
  getHealth: () => healthCheck(serviceName),
});

await startRuntime({
  serviceName,
  onShutdown: async () => {
    await health.close();
    log.info('audit-sink shutdown');
  },
});

const integrity = await auditService.verifyIntegrity('audit-sink-boot');
log.info(
  {
    valid: integrity.valid,
    headHash: integrity.headHash,
    recordCount: integrity.recordCount,
    healthPort: health.port,
  },
  'audit-sink ready (append-only chain initialized)',
);

await new Promise(() => undefined);
