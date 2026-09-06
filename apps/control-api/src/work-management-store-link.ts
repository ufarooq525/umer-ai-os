import { createLogger } from '@umer/observability';
import { pingMySql, createMySqlExecutor } from '@umer/db';
import { MySqlProjectStore } from './project-store-mysql.js';
import { MySqlTaskStore } from './task-store-mysql.js';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Best-effort swap of `state.projectStore`/`state.taskStore` from the
 * always-present in-memory defaults to the real MySQL-backed adapters
 * (packages/db's work-management-migration.ts), if reachable — same
 * fail-open pattern as connectWorkGraphStore/connectGateWaitStore.
 *
 * Safe to call after createControlApiState(): the CEO Command Plane's
 * `projects`/`tasks` ports (see server.ts) delegate through
 * `state.projectStore`/`state.taskStore` on every call rather than
 * capturing today's instance, specifically so this swap is never stale —
 * same reasoning as `opportunities`' delegation there.
 */
export async function connectWorkManagementStores(state: ControlApiState): Promise<void> {
  try {
    const reachable = await pingMySql();
    if (!reachable) {
      throw new Error('pingMySql returned false');
    }
    const db = createMySqlExecutor();
    state.projectStore = new MySqlProjectStore({ db });
    state.taskStore = new MySqlTaskStore({ db });
    log.info('project/task stores connected to MySQL');
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'project/task stores unavailable (MySQL unreachable) — using in-memory stores; projects and tasks will not survive a restart until this recovers',
    );
  }
}
