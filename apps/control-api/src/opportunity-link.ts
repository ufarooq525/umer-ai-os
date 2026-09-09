import { createLogger } from '@umer/observability';
import { pingMySql } from '@umer/db';
import { InMemoryOpportunityPersistence, createMySqlOpportunityPersistence } from '@umer/opportunity-intelligence';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Connect the control plane to the authoritative Opportunity Intelligence
 * store. In normal development an in-memory reader is still available when
 * MySQL is intentionally absent, but autonomous/company-loop execution can be
 * configured to fail closed with AUTONOMY_REQUIRE_DURABLE_STATE=true.
 *
 * This distinction is deliberate: an empty development reader is useful for
 * booting the UI, while an autonomous production process must never silently
 * substitute volatile state for durable commercial truth.
 */
export async function connectOpportunityReader(state: ControlApiState): Promise<void> {
  if (!state.opportunityReader) {
    state.opportunityReader = new InMemoryOpportunityPersistence();
  }

  try {
    const reachable = await pingMySql();
    if (!reachable) {
      throw new Error('pingMySql returned false');
    }
    state.opportunityReader = createMySqlOpportunityPersistence();
    log.info('opportunity reader connected to MySQL Opportunity Intelligence store');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const requireDurableState = process.env.AUTONOMY_REQUIRE_DURABLE_STATE === 'true';

    if (requireDurableState) {
      log.error(
        { err: message },
        'durable Opportunity Intelligence state is required but MySQL is unavailable; refusing to start autonomous control-plane state',
      );
      throw new Error(
        `AUTONOMY_REQUIRE_DURABLE_STATE=true but MySQL Opportunity Intelligence persistence is unavailable: ${message}`,
      );
    }

    log.warn(
      { err: message },
      'opportunity reader unavailable (MySQL unreachable) — using the development-only in-memory reader; autonomous production execution must enable AUTONOMY_REQUIRE_DURABLE_STATE=true',
    );
  }
}
