import { InMemoryGrantStore } from './store.js';
import { TrustRuntime, type TrustRuntimeOptions } from './service.js';

export function createTrustRuntime(options?: TrustRuntimeOptions): TrustRuntime {
  return new TrustRuntime(options);
}

export function createTrustStack(): {
  runtime: TrustRuntime;
  store: InMemoryGrantStore;
} {
  const store = new InMemoryGrantStore();
  const runtime = createTrustRuntime({ store });
  return { runtime, store };
}
