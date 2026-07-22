/**
 * @umer/trust — Trust Runtime (identity binding, PEP authorization, grants).
 */

export { packageName } from './types.js';
export type {
  TrustPrincipalKind,
  TrustPrincipal,
  GrantEffect,
  PermissionGrant,
  AuthorizationRequest,
  PermissionDecision,
} from './types.js';
export { TrustError, type TrustErrorCode } from './errors.js';
export { type GrantStore, InMemoryGrantStore } from './store.js';
export { type TrustEventPublisher, createNoopTrustEventPublisher } from './events.js';
export {
  TrustRuntime,
  type TrustRuntimeOptions,
  type Clock,
  systemClock,
} from './service.js';
export { createTrustRuntime, createTrustStack } from './factory.js';
