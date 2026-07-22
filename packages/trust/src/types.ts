export const packageName = '@umer/trust' as const;

export type TrustPrincipalKind = 'human' | 'specialist_run' | 'system';

export type TrustPrincipal = {
  principalId: string;
  kind: TrustPrincipalKind;
  tenantId?: string;
};

export type GrantEffect = 'allow' | 'deny';

export type PermissionGrant = {
  grantId: string;
  principalId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  effect: GrantEffect;
  tenantId?: string;
};

export type AuthorizationRequest = {
  principal: TrustPrincipal;
  action: string;
  resourceType: string;
  resourceId?: string;
};

export type PermissionDecision = {
  decisionId: string;
  allowed: boolean;
  reason?: string;
  principalId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  decidedAt: string;
};
