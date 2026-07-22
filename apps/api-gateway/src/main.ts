import { createServer } from 'node:http';
import { loadEnv } from '@umer/config';
import { healthCheck, startRuntime } from '@umer/kernel';
import { createLogger } from '@umer/observability';

const serviceName = 'api-gateway';
const log = createLogger(serviceName);
const env = loadEnv();

await startRuntime({ serviceName });

const controlOrigin = `http://127.0.0.1:${env.CONTROL_API_PORT}`;

const server = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    void healthCheck(serviceName).then((body) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
    return;
  }

  // Skeleton proxy stub — no auth / routing product logic yet.
  if (req.url?.startsWith('/v1/')) {
    res.writeHead(501, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'not_implemented',
        service: serviceName,
        upstream: controlOrigin,
      }),
    );
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(env.GATEWAY_PORT, () => {
  log.info({ port: env.GATEWAY_PORT }, 'api-gateway skeleton listening');
});
