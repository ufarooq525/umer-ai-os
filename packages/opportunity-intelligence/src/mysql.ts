import { createMySqlExecutor } from '@umer/db';
import { MySqlOpportunityPersistence, type OpportunityPersistence } from './persistence.js';
import { MySqlCommercialStore } from './commercial-store-mysql.js';
import type { CommercialStore } from './commercial-store.js';

/**
 * Composition boundary for the production Revenue OS persistence adapter.
 * Domain persistence remains driver-agnostic; @umer/db owns mysql2.
 */
export function createMySqlOpportunityPersistence(): OpportunityPersistence {
  return new MySqlOpportunityPersistence({
    db: createMySqlExecutor(),
  });
}

export function createMySqlCommercialStore(): CommercialStore {
  return new MySqlCommercialStore({
    db: createMySqlExecutor(),
  });
}
