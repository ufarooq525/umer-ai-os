import type { MessageFabricClient } from '@umer/message-fabric';
import type { SpecialistRegistry } from '@umer/registry';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import { createWorkPackageDispatcher } from './dispatcher.js';
import { createEventPublisher } from './events.js';
import { Orchestrator } from './orchestrator.js';
import { InMemoryWorkPackageStore } from './store.js';

export type CreateOrchestratorOptions = {
  fabric: MessageFabricClient;
  producer: string;
  store?: InMemoryWorkPackageStore;
  clock?: Clock;
  maxAttempts?: number;
  specialistRegistry?: SpecialistRegistry;
};

export function createOrchestrator(options: CreateOrchestratorOptions): Orchestrator {
  const store = options.store ?? new InMemoryWorkPackageStore();
  return new Orchestrator({
    store,
    events: createEventPublisher(options.fabric, options.producer),
    dispatcher: createWorkPackageDispatcher(options.fabric, options.producer, {
      specialistRegistry: options.specialistRegistry,
    }),
    clock: options.clock ?? systemClock,
    maxAttempts: options.maxAttempts,
  });
}
