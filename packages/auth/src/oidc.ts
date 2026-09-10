import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { AuthenticatedPrincipal, SessionResolver } from './index.js';

export type OidcSessionResolverOptions = {
  /** The IdP's issuer URL (must exactly match the JWT `iss` claim). */
  issuer: string;
  /** The audience this deployment expects (must match the JWT `aud` claim). */
  audience: string;
  /** Defaults to `${issuer}/.well-known/jwks.json`, the common OIDC convention. */
  jwksUri?: string;
  /** Claim used as the JARVIS principal id. Defaults to `sub`. */
  principalIdClaim?: string;
  /** Claim used as the tenant id, if the IdP issues one. Unset means no tenant scoping from the token. */
  tenantClaim?: string;
  /** Claim whose value `"system"` marks the principal as a system/service caller rather than human. */
  kindClaim?: string;
  clockToleranceSeconds?: number;
  /** Injection point for tests — a jose JWTVerifyGetKey that resolves keys without a real network JWKS fetch. */
  jwks?: JWTVerifyGetKey;
};

function claimString(payload: JWTPayload, claim: string | undefined): string | undefined {
  if (!claim) return undefined;
  const value = payload[claim];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Standards-based (OIDC/JWT + JWKS) SessionResolver — works with any
 * real OIDC-compliant identity provider (Auth0, Okta, Azure AD/Entra ID,
 * Google Identity, Keycloak, ...) without hardcoding a specific vendor.
 * Unlike the static-token resolver, every verified token maps to its own
 * principal (and tenant, if the IdP issues one) derived from its claims —
 * this is what makes multiple real users/tenants distinguishable.
 *
 * Fails closed: any verification failure (bad signature, wrong
 * issuer/audience, expired token, missing principal claim) resolves to
 * `null` — never a guessed or partial principal.
 */
export function createOidcSessionResolver(options: OidcSessionResolverOptions): SessionResolver {
  const jwksUri = options.jwksUri ?? `${options.issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
  const jwks = options.jwks ?? createRemoteJWKSet(new URL(jwksUri));
  const principalIdClaim = options.principalIdClaim ?? 'sub';

  return {
    async resolveBearerToken(token: string): Promise<AuthenticatedPrincipal | null> {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: options.issuer,
          audience: options.audience,
          clockTolerance: options.clockToleranceSeconds ?? 5,
        });
        const principalId = claimString(payload, principalIdClaim);
        if (!principalId) return null;
        const tenantId = claimString(payload, options.tenantClaim);
        const kind = claimString(payload, options.kindClaim) === 'system' ? 'system' : 'human';
        return { principalId, kind, ...(tenantId ? { tenantId } : {}) };
      } catch {
        return null;
      }
    },
  };
}
