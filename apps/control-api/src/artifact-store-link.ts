import { createLogger } from '@umer/observability';
import { pingMySql, createMySqlExecutor } from '@umer/db';
import { MySqlArtifactStore } from '@umer/artifacts';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Best-effort swap of `state.artifactStore` from the always-present
 * in-memory default to the real MySQL-backed store (packages/db's
 * artifact-migration.ts), if reachable — same fail-open pattern as every
 * other store here. Combined with artifact-bridge.ts (which is what
 * actually populates this store from real `artifact.sealed` events in the
 * first place), this is the second half of making `GET /v1/artifacts`
 * reflect real, durable, produced work.
 */
export async function connectArtifactStore(state: ControlApiState): Promise<void> {
  try {
    const reachable = await pingMySql();
    if (!reachable) {
      throw new Error('pingMySql returned false');
    }
    state.artifactStore = new MySqlArtifactStore({ db: createMySqlExecutor() });
    log.info('artifact store connected to MySQL');
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'artifact store unavailable (MySQL unreachable) — using in-memory store; sealed artifacts will not survive a restart until this recovers',
    );
  }
}
