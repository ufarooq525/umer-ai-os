import { loadEnv } from '@umer/config';
import { startRuntime } from '@umer/kernel';
import { createLogger } from '@umer/observability';
import {
  bootstrapDemoState,
  createControlApiServer,
  createControlApiState,
} from './server.js';

const serviceName = 'control-api';
const log = createLogger(serviceName);

const runtime = await startRuntime({ serviceName });
const env = loadEnv();
const state = createControlApiState();
await bootstrapDemoState(state);

const server = createControlApiServer(state);

server.listen(env.CONTROL_API_PORT, () => {
  log.info({ port: env.CONTROL_API_PORT }, 'control-api listening');
});

void runtime;
