import type { MemoryScope } from '@umer/contracts';
import type { MemoryAccessPrincipal } from './types.js';
import { MemoryAccessError } from './errors.js';

export type ScopeOperation = 'read' | 'write';

export type ScopeGuard = {
  assertAllowed(
    principal: MemoryAccessPrincipal,
    operation: ScopeOperation,
    memoryScope: MemoryScope,
    tenantId?: string,
  ): void;
};

function principalAllows(
  principal: MemoryAccessPrincipal,
  operation: ScopeOperation,
): boolean {
  if (principal.grantedScopes.includes('read_write')) {
    return true;
  }
  if (operation === 'read') {
    return principal.grantedScopes.includes('read');
  }
  return principal.grantedScopes.includes('write');
}

function memoryAllows(memoryScope: MemoryScope, operation: ScopeOperation): boolean {
  if (memoryScope === 'read_write') {
    return true;
  }
  return memoryScope === operation;
}

export function createScopeGuard(): ScopeGuard {
  return {
    assertAllowed(principal, operation, memoryScope, tenantId) {
      if (tenantId && principal.tenantId && principal.tenantId !== tenantId) {
        throw new MemoryAccessError(
          'ACCESS_DENIED',
          `Tenant ${principal.tenantId} cannot access tenant ${tenantId}`,
        );
      }
      if (!principalAllows(principal, operation)) {
        throw new MemoryAccessError(
          'ACCESS_DENIED',
          `Principal ${principal.principalId} lacks ${operation} scope`,
        );
      }
      if (!memoryAllows(memoryScope, operation)) {
        throw new MemoryAccessError(
          'ACCESS_DENIED',
          `Memory record does not allow ${operation}`,
        );
      }
    },
  };
}

export function assertPrincipalWrite(principal: MemoryAccessPrincipal): void {
  if (!principalAllows(principal, 'write')) {
    throw new MemoryAccessError(
      'ACCESS_DENIED',
      `Principal ${principal.principalId} lacks write scope`,
    );
  }
}

export const allowAllScopeGuard: ScopeGuard = {
  assertAllowed() {
    // test helper
  },
};
