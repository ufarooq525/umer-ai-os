import { createLogger } from '@umer/observability';
import { pingMySql } from '@umer/db';
import { InMemoryOpportunityPersistence, createMySqlOpportunityPersistence } from '@umer/opportunity-intelligence';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Best-effort swap of `state.opportunityReader` from the always-present
 * in-memory default to the real MySQL-backed Opportunity Intelligence
 * persistence (packages/opportunity-intelligence/src/persistence.ts), if
 * OPPORTUNITY_DATABASE_URL is actually reachable. Read-only from control-api's
 * side — see implementation/COMPANY_OPERATING_MODEL.md §Boundary for why
 * Opportunity Intelligence keeps sole write ownership of its own data.
 *
 * Same fail-open shape as startAgentRunReadModelSubscription: never throws,
 * never blocks control-api's boot, and control-api works fully (just against
 * an empty in-memory store) when MySQL is unreachable.
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
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'opportunity reader unavailable (MySQL unreachable) — /v1/opportunities will stay empty until this recovers',
    );
  }
}
