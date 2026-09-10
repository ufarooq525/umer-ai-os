/**
 * @umer/auth — identity/session boundary used by human-facing services.
 *
 * This package deliberately does not implement a proprietary identity provider.
 * A production deployment supplies a SessionResolver; the included static-token
 * resolver is intended for controlled single-operator deployments and local use.
 */

export const packageName = '@umer/auth' as const;

export type AuthenticatedPrincipal = {
  principalId: string;
  kind: 'human' | 'system';
  tenantId?: string;
};

export type AuthSession = {
  sessionId: string;
  principal: AuthenticatedPrincipal;
  authenticatedAt: string;
};

export type SessionResolver = {
  resolveBearerToken(token: string): Promise<AuthenticatedPrincipal | null>;
};

export type JarvisAuthOptions = {
  mode?: 'development' | 'production';
  resolver?: SessionResolver;
  developmentPrincipal?: AuthenticatedPrincipal;
  developmentToken?: string;
};

export class AuthenticationError extends Error {
  readonly code = 'UNAUTHENTICATED' as const;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export function createStaticTokenResolver(token: string, principal: AuthenticatedPrincipal): SessionResolver {
  if (!token.trim()) throw new Error('Static authentication token must not be empty');
  return {
    async resolveBearerToken(candidate) {
      return candidate === token ? principal : null;
    },
  };
}

export function createJarvisAuth(options: JarvisAuthOptions = {}) {
  const mode = options.mode ?? ((process.env.NODE_ENV ?? 'development') === 'production' ? 'production' : 'development');
  const principal: AuthenticatedPrincipal = options.developmentPrincipal ?? {
    principalId: process.env.JARVIS_DEV_PRINCIPAL_ID ?? 'ceo',
    kind: 'human',
    ...(process.env.JARVIS_TENANT_ID ? { tenantId: process.env.JARVIS_TENANT_ID } : {}),
  };
  const resolver = options.resolver ?? (process.env.JARVIS_BEARER_TOKEN
    ? createStaticTokenResolver(process.env.JARVIS_BEARER_TOKEN, principal)
    : undefined);
  const developmentToken = options.developmentToken ?? process.env.JARVIS_DEV_TOKEN;

  return {
    mode,
    async authenticate(authorization: string | undefined, sessionId: string): Promise<AuthSession> {
      if (mode === 'development' && !authorization) {
        return { sessionId, principal, authenticatedAt: new Date().toISOString() };
      }
      const token = bearerToken(authorization);
      if (!token) throw new AuthenticationError();
      if (mode === 'development' && developmentToken && token === developmentToken) {
        return { sessionId, principal, authenticatedAt: new Date().toISOString() };
      }
      if (!resolver) throw new AuthenticationError('No session resolver is configured');
      const resolved = await resolver.resolveBearerToken(token);
      if (!resolved) throw new AuthenticationError('Invalid or expired bearer token');
      return { sessionId, principal: resolved, authenticatedAt: new Date().toISOString() };
    },
  };
}
