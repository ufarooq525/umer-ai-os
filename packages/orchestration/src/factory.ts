import type { MessageFabricClient } from '@umer/message-fabric';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import { createWorkPackageDispatcher } from './dispatcher.js';
import { createEventPublisher } from './events.js';
import { Orchestrator } from './orchestrator.js';
import { InMemoryWorkPackageStore, type WorkPackageStore } from './store.js';

export type CreateOrchestratorOptions = {
  fabric: MessageFabricClient;
  producer: string;
  /** Defaults to InMemoryWorkPackageStore. Pass a MySqlWorkPackageStore for durable Work Packages across restarts. */
  store?: WorkPackageStore;
  clock?: Clock;
  maxAttempts?: number;
};

export function createOrchestrator(options: CreateOrchestratorOptions): Orchestrator {
  const store = options.store ?? new InMemoryWorkPackageStore();
  return new Orchestrator({
    store,
    events: createEventPublisher(options.fabric, options.producer),
    dispatcher: createWorkPackageDispatcher(options.fabric, options.producer),
    clock: options.clock ?? systemClock,
    maxAttempts: options.maxAttempts,
  });
}
