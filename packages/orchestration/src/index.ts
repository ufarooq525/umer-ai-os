/**
 * @umer/orchestration — Work Package scheduler, dispatch, state machine, retry, timeout, cancellation.
 */

export { packageName } from './types.js';
export { ORCHESTRATION_COMMANDS, AGENT_DISPATCH_COMMAND, DEFAULT_MAX_ATTEMPTS } from './constants.js';
export { OrchestrationError, type OrchestrationErrorCode } from './errors.js';
export { canTransition, assertTransition, isTerminalStatus, isActiveStatus } from './state-machine.js';
export { InMemoryWorkPackageStore, type WorkPackageStore, type WorkPackageRecord } from './store.js';
export { type Clock, systemClock } from './clock.js';
export { createEventPublisher, type EventPublisher } from './events.js';
export { createWorkPackageDispatcher, type WorkPackageDispatcher } from './dispatcher.js';
export { Orchestrator, type OrchestratorOptions } from './orchestrator.js';
export { createOrchestrator, type CreateOrchestratorOptions } from './factory.js';
export { OrchestrationWorker, createOrchestrationWorker, type OrchestrationWorkerOptions } from './worker.js';
export { WorkGraph, WorkGraphError, createWorkGraph } from './work-graph.js';
export { PersistentWorkGraph, createPersistentWorkGraph, type WorkGraphPersistence } from './persistent-work-graph.js';
