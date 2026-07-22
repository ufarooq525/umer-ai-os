import { createServer, type Server } from 'node:http';
import type { RuntimeHealth } from '@umer/contracts';

export type HealthServerHandle = {
  port: number;
  close: () => Promise<void>;
};

export type StartHealthServerOptions = {
  serviceName: string;
  port: number;
  host?: string;
  getHealth: () => Promise<RuntimeHealth>;
};

/**
 * Minimal HTTP probe server for container/K8s readiness.
 * GET /health → RuntimeHealth JSON.
 */
export async function startHealthServer(
  options: StartHealthServerOptions,
): Promise<HealthServerHandle> {
  const host = options.host ?? '0.0.0.0';
  const server: Server = createServer(async (req, res) => {
    if (req.method === 'GET' && (req.url === '/health' || req.url?.startsWith('/health?'))) {
      try {
        const body = await options.getHealth();
        const status = body.status === 'down' ? 503 : 200;
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      } catch (err) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'down',
            service: options.serviceName,
            ts: new Date().toISOString(),
            details: { error: err instanceof Error ? err.message : String(err) },
          }),
        );
      }
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, host, () => resolve());
  });

  const address = server.address();
  const boundPort =
    address && typeof address === 'object' ? address.port : options.port;

  return {
    port: boundPort,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
