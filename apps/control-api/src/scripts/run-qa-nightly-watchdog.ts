/**
 * Fire the school-app nightly QA watchdog against a running control-api.
 * Calls the same /v1/watchdogs/qa-nightly/run path the cron job shares internally.
 *
 * Usage:
 *   pnpm --filter @umer/app-control-api watchdog:qa-nightly
 *   CONTROL_API_URL=http://127.0.0.1:4000 pnpm --filter @umer/app-control-api watchdog:qa-nightly
 */
const base = (process.env.CONTROL_API_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');

const response = await fetch(`${base}/v1/watchdogs/qa-nightly/run`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
});

const body = (await response.json()) as Record<string, unknown>;
if (!response.ok) {
  console.error('watchdog:qa-nightly failed', response.status, body);
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
