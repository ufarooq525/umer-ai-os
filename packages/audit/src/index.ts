/**
 * @umer/audit — Audit Runtime (append-only log, hash chain, query).
 */

export { packageName } from './types.js';
export type { CreateAuditInput, IntegrityVerification, ChainedAuditEntry } from './types.js';
export { AuditError, type AuditErrorCode } from './errors.js';
export { GENESIS_HASH, computeAuditEntryHash } from './hash.js';
export { buildAuditRecord } from './builder.js';
export {
  type AuditStore,
  InMemoryAuditStore,
  buildChainEntry,
  headHash,
} from './store.js';
export { type AuditEventPublisher, createNoopAuditEventPublisher } from './events.js';
export {
  AuditService,
  type AuditServiceOptions,
  type Clock,
  systemClock,
} from './service.js';
export { createAuditService, createAuditStack } from './factory.js';
