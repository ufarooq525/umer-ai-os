import { createLogger } from '@umer/observability';
import { pingMySql } from '@umer/db';
import {
  CommercialPipelineEngine,
  createMySqlCommercialStore,
} from '@umer/opportunity-intelligence';
import type { ControlApiState } from './state.js';

const log = createLogger('control-api');

/**
 * Connect the control plane to the authoritative durable MySQL Commercial Pipeline store.
 * In development an in-memory pipeline is used when MySQL is intentionally absent,
 * but autonomous production execution fails closed with AUTONOMY_REQUIRE_DURABLE_STATE=true.
 */
export async function connectCommercialPipeline(state: ControlApiState): Promise<void> {
  if (!state.commercialPipeline) {
    state.commercialPipeline = new CommercialPipelineEngine();
  }

  try {
    const reachable = await pingMySql();
    if (!reachable) {
      throw new Error('pingMySql returned false');
    }
    const store = createMySqlCommercialStore();
    state.commercialPipeline = new CommercialPipelineEngine({
      store,
      opportunities: {
        getOpportunity: (id) => state.opportunityReader!.getOpportunity(id),
        saveOpportunity: (opportunity) => state.opportunityReader!.saveOpportunity(opportunity),
      },
      projects: {
        create: (input, correlationId) => state.projectStore!.create(input, correlationId),
        get: (id) => state.projectStore!.get(id),
      },
    });
    log.info('commercial pipeline connected to MySQL commercial sales store');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const requireDurableState = process.env.AUTONOMY_REQUIRE_DURABLE_STATE === 'true';

    if (requireDurableState) {
      log.error(
        { err: message },
        'durable Commercial Pipeline state is required but MySQL is unavailable; refusing to start autonomous control-plane state',
      );
      throw new Error(
        `AUTONOMY_REQUIRE_DURABLE_STATE=true but MySQL Commercial Pipeline persistence is unavailable: ${message}`,
      );
    }

    log.warn(
      { err: message },
      'commercial pipeline unavailable (MySQL unreachable) — using development-only in-memory commercial pipeline; autonomous production execution must enable AUTONOMY_REQUIRE_DURABLE_STATE=true',
    );
  }
}
