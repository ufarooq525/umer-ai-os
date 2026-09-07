import { createLogger } from '@umer/observability';
import { createMySqlExecutor, pingMySql } from '@umer/db';
import { MySqlRequirementStore } from './requirement-store.js';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

export async function connectRequirementStore(state: ControlApiState): Promise<void> {
  try {
    if (!await pingMySql()) throw new Error('pingMySql returned false');
    state.requirementStore = new MySqlRequirementStore(createMySqlExecutor());
    log.info('requirement store connected to MySQL');
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, 'requirement store unavailable — using in-memory requirements');
  }
}
