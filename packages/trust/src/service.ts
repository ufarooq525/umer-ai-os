import { randomUUID } from 'node:crypto';
import type { GrantStore } from './store.js';
import { InMemoryGrantStore } from './store.js';
import type { TrustEventPublisher } from './events.js';
import { createNoopTrustEventPublisher } from './events.js';
import type {
  AuthorizationRequest,
  PermissionDecision,
  PermissionGrant,
  TrustPrincipal,
} from './types.js';

export type Clock = {
  nowIso(): string;
};

export const systemClock: Clock = {
  nowIso() {
    return new Date().toISOString();
  },
};

export type TrustRuntimeOptions = {
  store?: GrantStore;
  events?: TrustEventPublisher;
  clock?: Clock;
};

function grantMatches(
  grant: PermissionGrant,
  request: AuthorizationRequest,
): boolean {
  if (grant.principalId !== request.principal.principalId) {
    return false;
  }
  if (grant.tenantId && request.principal.tenantId && grant.tenantId !== request.principal.tenantId) {
    return false;
  }
  if (grant.action !== '*' && grant.action !== request.action) {
    return false;
  }
  if (grant.resourceType !== '*' && grant.resourceType !== request.resourceType) {
    return false;
  }
  if (grant.resourceId && grant.resourceId !== request.resourceId) {
    return false;
  }
  return true;
}

export class TrustRuntime {
  private readonly store: GrantStore;
  private readonly events: TrustEventPublisher;
  private readonly clock: Clock;

  constructor(options: TrustRuntimeOptions = {}) {
    this.store = options.store ?? new InMemoryGrantStore();
    this.events = options.events ?? createNoopTrustEventPublisher();
    this.clock = options.clock ?? systemClock;
  }

  async registerGrant(grant: PermissionGrant): Promise<void> {
    await this.store.save(grant);
  }

  async bindPrincipal(principal: TrustPrincipal, correlationId: string): Promise<void> {
    await this.events.publish('trust.principal.bound', correlationId, {
      principalId: principal.principalId,
      kind: principal.kind,
      tenantId: principal.tenantId,
    });
  }

  async authorize(
    request: AuthorizationRequest,
    correlationId: string,
  ): Promise<PermissionDecision> {
    const grants = await this.store.listForPrincipal(request.principal.principalId);
    const matching = grants.filter((grant) => grantMatches(grant, request));

    const deny = matching.find((grant) => grant.effect === 'deny');
    const allow = matching.find((grant) => grant.effect === 'allow');

    const decision: PermissionDecision = {
      decisionId: randomUUID(),
      allowed: Boolean(allow) && !deny,
      reason: deny
        ? `Explicit deny grant ${deny.grantId}`
        : allow
          ? undefined
          : 'No matching allow grant',
      principalId: request.principal.principalId,
      action: request.action,
      resourceType: request.resourceType,
      resourceId: request.resourceId,
      decidedAt: this.clock.nowIso(),
    };

    await this.events.publish(decision.allowed ? 'trust.allow' : 'trust.deny', correlationId, {
      decisionId: decision.decisionId,
      principalId: decision.principalId,
      action: decision.action,
      resourceType: decision.resourceType,
      resourceId: decision.resourceId,
      reason: decision.reason,
    });

    return decision;
  }
}
