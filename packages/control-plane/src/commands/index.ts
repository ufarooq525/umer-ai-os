/**
 * CEO Command & Decision Plane — see implementation notes on CeoCommandService.
 */
export { CommandError, type CommandErrorCode } from './errors.js';
export {
  type AgentControlPort,
  type AgentControlRecord,
  type AgentControlState,
  type OpportunityWritePort,
  type ProjectWritePort,
  type TaskWritePort,
} from './ports.js';
export { type CommandEventPublisher, createNoopCommandEventPublisher } from './events.js';
export {
  InMemoryCommandIdempotencyStore,
  type CommandIdempotencyStore,
} from './idempotency.js';
export type {
  CommandDeps,
  CommandResult,
  CommandResultStatus,
  HandlerEvent,
  HandlerOutcome,
} from './types.js';
export {
  CeoCommandService,
  type CeoCommandServiceOptions,
  type CeoCommandServicePorts,
} from './service.js';
export { createCeoCommandService } from './factory.js';
