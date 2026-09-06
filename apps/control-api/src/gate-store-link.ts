import { createLogger } from '@umer/observability';
import { pingMySql, createMySqlExecutor } from '@umer/db';
import { createControlPlaneService, MySqlGateWaitStore } from '@umer/control-plane';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Best-effort swap of `state.controlPlane`'s Gate Wait store from the
 * always-present in-memory default to the real MySQL-backed store
 * (packages/db's gate-wait-migration.ts), if reachable — same fail-open
 * pattern as connectWorkGraphStore/connectOpportunityReader. Without this,
 * every pending Gate — the CEO's actual "needs your attention" queue —
 * vanishes on restart with no record it ever existed.
 *
 * `ControlPlaneService` has no setter for its store, so this reconstructs
 * the service around the MySQL store rather than mutating the existing one.
 * Boot-only, called before the server starts listening, so there is no real
 * pending-gate data on the old (in-memory) instance to lose in practice.
 */
export async function connectGateWaitStore(state: ControlApiState): Promise<void> {
  try {
    const reachable = await pingMySql();
    if (!reachable) {
      throw new Error('pingMySql returned false');
    }
    state.controlPlane = createControlPlaneService({
      store: new MySqlGateWaitStore({ db: createMySqlExecutor() }),
      workPackagesAwaitingReview: () =>
        state.workPackages.filter((wp) => wp.status === 'AwaitingReview').length,
    });
    log.info('gate wait store connected to MySQL');
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'gate wait store unavailable (MySQL unreachable) — using in-memory store; pending gates will not survive a restart until this recovers',
    );
  }
}
