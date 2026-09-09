import { createLogger } from '@umer/observability';
import { pingMySql, createMySqlExecutor } from '@umer/db';
import { InMemoryWorkGraphStore, MySqlWorkGraphStore, PersistentWorkGraph } from '@umer/orchestration';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Best-effort swap of `state.workGraphStore` from the always-present
 * in-memory default to the real MySQL-backed store (packages/db's
 * work-graph-migration.ts), if reachable — same fail-open pattern as
 * connectOpportunityReader/startAgentRunReadModelSubscription. Without
 * MySQL, the Work Graph still works fully for the life of this process; it
 * just won't survive a restart (see AUTONOMY_STATUS.md's persistence-gaps
 * section — this closes that gap specifically for the Work Graph, not the
 * other in-memory stores).
 */
export async function connectWorkGraphStore(state: ControlApiState): Promise<void> {
  if (!state.workGraphStore) {
    state.workGraphStore = new InMemoryWorkGraphStore();
  }

  const requireDurable =
    process.env.AUTONOMY_REQUIRE_DURABLE_STATE === 'true' ||
    process.env.NODE_ENV === 'production';

  try {
    const reachable = await pingMySql();
    if (!reachable) {
      if (requireDurable) {
        throw new Error(
          'FATAL: MySQL is unreachable and AUTONOMY_REQUIRE_DURABLE_STATE is enabled. Refusing to boot with in-memory Work Graph store.',
        );
      }
      throw new Error('pingMySql returned false');
    }
    state.workGraphStore = new MySqlWorkGraphStore({ db: createMySqlExecutor() });
    log.info('work graph store connected to MySQL');
  } catch (err) {
    if (requireDurable) {
      throw err;
    }
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'work graph store unavailable (MySQL unreachable) — using in-memory store; the graph will not survive a restart until this recovers',
    );
  }

  state.persistentWorkGraph = new PersistentWorkGraph(state.workGraphStore);
}
