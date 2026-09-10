import { describe, expect, it, beforeAll } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type JWTVerifyGetKey } from 'jose';
import { createOidcSessionResolver } from './oidc.js';

const ISSUER = 'https://idp.example.com/';
const AUDIENCE = 'jarvis-api';

let jwks: JWTVerifyGetKey;
let privateKey: CryptoKey;

async function signToken(claims: Record<string, unknown>, overrides: { issuer?: string; audience?: string; expiresIn?: string } = {}): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(overrides.issuer ?? ISSUER)
    .setAudience(overrides.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? '1h')
    .sign(privateKey);
}

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256');
  privateKey = keyPair.privateKey;
  const jwk = await exportJWK(keyPair.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] });
});

describe('createOidcSessionResolver', () => {
  it('resolves a valid token to a principal built from its claims', async () => {
    const resolver = createOidcSessionResolver({ issuer: ISSUER, audience: AUDIENCE, jwks });
    const token = await signToken({ sub: 'user-42' });

    const principal = await resolver.resolveBearerToken(token);
    expect(principal).toEqual({ principalId: 'user-42', kind: 'human' });
  });

  it('maps a configured tenant claim onto the principal tenantId', async () => {
    const resolver = createOidcSessionResolver({ issuer: ISSUER, audience: AUDIENCE, jwks, tenantClaim: 'org_id' });
    const token = await signToken({ sub: 'user-42', org_id: 'acme-corp' });

    const principal = await resolver.resolveBearerToken(token);
    expect(principal).toEqual({ principalId: 'user-42', kind: 'human', tenantId: 'acme-corp' });
  });

  it('maps a configured kind claim of "system" onto a system principal', async () => {
    const resolver = createOidcSessionResolver({ issuer: ISSUER, audience: AUDIENCE, jwks, kindClaim: 'actor_type' });
    const token = await signToken({ sub: 'svc-account-1', actor_type: 'system' });

    const principal = await resolver.resolveBearerToken(token);
    expect(principal).toEqual({ principalId: 'svc-account-1', kind: 'system' });
  });

  it('supports a custom principal-id claim', async () => {
    const resolver = createOidcSessionResolver({ issuer: ISSUER, audience: AUDIENCE, jwks, principalIdClaim: 'employee_id' });
    const token = await signToken({ sub: 'some-opaque-id', employee_id: 'E-100' });

    const principal = await resolver.resolveBearerToken(token);
    expect(principal?.principalId).toBe('E-100');
  });

  it('fails closed (returns null, never throws) on a wrong audience', async () => {
    const resolver = createOidcSessionResolver({ issuer: ISSUER, audience: AUDIENCE, jwks });
    const token = await signToken({ sub: 'user-42' }, { audience: 'some-other-api' });
    expect(await resolver.resolveBearerToken(token)).toBeNull();
  });

  it('fails closed on a wrong issuer', async () => {
    const resolver = createOidcSessionResolver({ issuer: ISSUER, audience: AUDIENCE, jwks });
    const token = await signToken({ sub: 'user-42' }, { issuer: 'https://not-the-real-idp.example.com/' });
    expect(await resolver.resolveBearerToken(token)).toBeNull();
  });

  it('fails closed on an expired token', async () => {
    const resolver = createOidcSessionResolver({ issuer: ISSUER, audience: AUDIENCE, jwks });
    const token = await signToken({ sub: 'user-42' }, { expiresIn: '-1h' });
    expect(await resolver.resolveBearerToken(token)).toBeNull();
  });

  it('fails closed on a garbage/non-JWT token', async () => {
    const resolver = createOidcSessionResolver({ issuer: ISSUER, audience: AUDIENCE, jwks });
    expect(await resolver.resolveBearerToken('not-a-real-jwt')).toBeNull();
  });

  it('fails closed when the principal-id claim is missing from an otherwise valid token', async () => {
    const resolver = createOidcSessionResolver({ issuer: ISSUER, audience: AUDIENCE, jwks });
    const token = await signToken({});
    expect(await resolver.resolveBearerToken(token)).toBeNull();
  });

  it('fails closed on a token signed by a different key (wrong signature)', async () => {
    const otherKeyPair = await generateKeyPair('RS256');
    const forgedToken = await new SignJWT({ sub: 'user-42' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(otherKeyPair.privateKey);

    const resolver = createOidcSessionResolver({ issuer: ISSUER, audience: AUDIENCE, jwks });
    expect(await resolver.resolveBearerToken(forgedToken)).toBeNull();
  });
});
