import { InMemoryGateWaitStore } from './store.js';
import { ControlPlaneService, type ControlPlaneServiceOptions } from './service.js';

export function createControlPlaneService(
  options?: ControlPlaneServiceOptions,
): ControlPlaneService {
  return new ControlPlaneService(options);
}

export function createControlPlaneStack(): {
  service: ControlPlaneService;
  store: InMemoryGateWaitStore;
} {
  const store = new InMemoryGateWaitStore();
  const service = createControlPlaneService({ store });
  return { service, store };
}
