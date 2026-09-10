import { createLogger } from '@umer/observability';
import { pingMySql, createMySqlExecutor } from '@umer/db';
import { MySqlSpecialistControlStore } from '@umer/control-plane';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Best-effort swap of `state.specialistControlStore` from the
 * always-present in-memory default to the real MySQL-backed store
 * (packages/db's specialist-control-migration.ts), if reachable — same
 * fail-open pattern as every other store here. Without this, a
 * SuspendSpecialist command survives only until the next restart.
 */
export async function connectSpecialistControlStore(state: ControlApiState): Promise<void> {
  try {
    const reachable = await pingMySql();
    if (!reachable) {
      throw new Error('pingMySql returned false');
    }
    state.specialistControlStore = new MySqlSpecialistControlStore({ db: createMySqlExecutor() });
    log.info('specialist control store connected to MySQL');
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'specialist control store unavailable (MySQL unreachable) — using in-memory store; specialist suspensions will not survive a restart until this recovers',
    );
  }
}
