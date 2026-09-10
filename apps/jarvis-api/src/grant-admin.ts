/**
 * Trust grant administration — a governed way to provision access for a
 * newly-authenticated principal (e.g. a real OIDC user seen for the first
 * time) instead of writing to trust_grants directly. Deliberately not a
 * JARVIS chat tool: granting/revoking authority is a sensitive
 * administrative action kept out of the LLM tool-calling loop.
 *
 * Every operation here itself requires the calling principal to already
 * hold an explicit `admin` grant on the `trust` resource — fails closed for
 * everyone else, including a principal who is otherwise fully authorized
 * for ordinary JARVIS `read`/`execute` actions.
 */
import { randomUUID } from 'node:crypto';
import type { GrantStore, PermissionGrant, TrustPrincipal, TrustRuntime } from '@umer/trust';

export class GrantAdminError extends Error {
  constructor(readonly code: 'FORBIDDEN' | 'INVALID_INPUT', message: string) {
    super(message);
    this.name = 'GrantAdminError';
  }
}

export async function requireAdmin(trust: TrustRuntime, principal: TrustPrincipal, correlationId: string): Promise<void> {
  const decision = await trust.authorize({ principal, action: 'admin', resourceType: 'trust' }, correlationId);
  if (!decision.allowed) throw new GrantAdminError('FORBIDDEN', decision.reason ?? 'Admin authority over Trust grants is required.');
}

export async function listGrants(store: GrantStore, principalId?: string): Promise<PermissionGrant[]> {
  return principalId ? store.listForPrincipal(principalId) : store.list();
}

export type CreateGrantInput = {
  principalId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  effect?: PermissionGrant['effect'];
  tenantId?: string;
};

export async function createGrant(store: GrantStore, input: CreateGrantInput): Promise<PermissionGrant> {
  if (!input.principalId?.trim()) throw new GrantAdminError('INVALID_INPUT', 'principalId is required');
  if (!input.action?.trim()) throw new GrantAdminError('INVALID_INPUT', 'action is required');
  if (!input.resourceType?.trim()) throw new GrantAdminError('INVALID_INPUT', 'resourceType is required');
  const grant: PermissionGrant = {
    grantId: `admin-${randomUUID()}`,
    principalId: input.principalId.trim(),
    action: input.action.trim(),
    resourceType: input.resourceType.trim(),
    resourceId: input.resourceId?.trim() || undefined,
    effect: input.effect ?? 'allow',
    tenantId: input.tenantId?.trim() || undefined,
  };
  await store.save(grant);
  return grant;
}

export async function revokeGrant(store: GrantStore, grantId: string): Promise<void> {
  if (!grantId?.trim()) throw new GrantAdminError('INVALID_INPUT', 'grantId is required');
  await store.revoke(grantId.trim());
}
