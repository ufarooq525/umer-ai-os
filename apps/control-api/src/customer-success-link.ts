import { createLogger } from '@umer/observability';
import { pingMySql } from '@umer/db';
import {
  CustomerSuccessEngine,
  createMySqlCustomerSuccessStore,
} from '@umer/opportunity-intelligence';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Connect the control plane to the authoritative durable MySQL Customer Success store.
 * In development an in-memory store is used when MySQL is intentionally absent,
 * but autonomous production execution fails closed with AUTONOMY_REQUIRE_DURABLE_STATE=true.
 */
export async function connectCustomerSuccessStore(state: ControlApiState): Promise<void> {
  if (!state.customerSuccess) {
    state.customerSuccess = new CustomerSuccessEngine({
      projects: {
        get: (id) => state.projectStore!.get(id),
        list: () => state.projectStore!.list(),
      },
      opportunities: {
        get: (id) => state.opportunityReader!.getOpportunity(id),
      },
    });
  }

  try {
    const reachable = await pingMySql();
    if (!reachable) {
      throw new Error('pingMySql returned false');
    }
    const store = createMySqlCustomerSuccessStore();
    state.customerSuccess = new CustomerSuccessEngine(
      {
        projects: {
          get: (id) => state.projectStore!.get(id),
          list: () => state.projectStore!.list(),
        },
        opportunities: {
          get: (id) => state.opportunityReader!.getOpportunity(id),
        },
        store,
      },
      store,
    );
    log.info('customer success engine connected to MySQL customer success store');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const requireDurableState = process.env.AUTONOMY_REQUIRE_DURABLE_STATE === 'true';

    if (requireDurableState) {
      log.error(
        { err: message },
        'durable Customer Success state is required but MySQL is unavailable; refusing to start autonomous control-plane state',
      );
      throw new Error(
        `AUTONOMY_REQUIRE_DURABLE_STATE=true but MySQL Customer Success persistence is unavailable: ${message}`,
      );
    }

    log.warn(
      { err: message },
      'customer success persistence unavailable (MySQL unreachable) — using development-only in-memory customer success store; autonomous production execution must enable AUTONOMY_REQUIRE_DURABLE_STATE=true',
    );
  }
}
