import { InMemoryAuditStore } from './store.js';
import { AuditService, type AuditServiceOptions } from './service.js';

export function createAuditService(options?: AuditServiceOptions): AuditService {
  return new AuditService(options);
}

export function createAuditStack(): {
  service: AuditService;
  store: InMemoryAuditStore;
} {
  const store = new InMemoryAuditStore();
  const service = createAuditService({ store });
  return { service, store };
}
