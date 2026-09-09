import { describe, expect, it } from 'vitest';
import { AuthenticationError, createJarvisAuth } from './index.js';

describe('JARVIS auth', () => {
  it('binds the configured human principal in development without a header', async () => {
    const auth = createJarvisAuth({ mode: 'development', developmentPrincipal: { principalId: 'ceo', kind: 'human' } });
    const session = await auth.authenticate(undefined, 'session-1');
    expect(session.principal).toEqual({ principalId: 'ceo', kind: 'human' });
  });

  it('rejects missing bearer credentials in production', async () => {
    const auth = createJarvisAuth({ mode: 'production' });
    await expect(auth.authenticate(undefined, 'session-1')).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('accepts an explicitly configured development token', async () => {
    const auth = createJarvisAuth({ mode: 'development', developmentToken: 'test-token', developmentPrincipal: { principalId: 'ceo', kind: 'human' } });
    const session = await auth.authenticate('Bearer test-token', 'session-1');
    expect(session.principal.principalId).toBe('ceo');
  });
});
