import { loadEnv } from '@umer/config';
import { startRuntime, startHealthServer, healthCheck } from '@umer/kernel';
import { createLogger } from '@umer/observability';

const serviceName = 'extension-worker';
const log = createLogger(serviceName);
const env = loadEnv();

const health = await startHealthServer({
  serviceName,
  port: env.HEALTH_PORT,
  getHealth: () => healthCheck(serviceName),
});

await startRuntime({
  serviceName,
  onShutdown: async () => {
    await health.close();
    log.info('extension-worker shutdown');
  },
});

log.info({ healthPort: health.port }, 'extension-worker skeleton idle (no tool egress yet)');
await new Promise(() => undefined);
