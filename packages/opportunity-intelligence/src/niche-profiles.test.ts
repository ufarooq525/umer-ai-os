import { describe, expect, it } from 'vitest';
import { InMemoryNicheProfileRegistry, SAUDI_UMRAH_NICHE, validateNicheProfile } from './niche-profiles.js';

describe('niche profiles', () => {
  it('validates and stores generic niche strategy metadata', () => {
    const registry = new InMemoryNicheProfileRegistry();
    registry.upsert(SAUDI_UMRAH_NICHE);
    const niche = registry.get('saudi-umrah');
    expect(niche?.businessCategories.length).toBeGreaterThan(0);
    expect(niche?.discoveryQueries.length).toBeGreaterThan(0);
    expect(niche?.revenueModels.length).toBeGreaterThan(0);
  });

  it('contains Saudi Umrah geography and reusable commercial configuration', () => {
    const niche = validateNicheProfile(SAUDI_UMRAH_NICHE);
    expect(niche.geographies).toEqual(expect.arrayContaining(['Saudi Arabia', 'Makkah', 'Madinah', 'Jeddah']));
    expect(niche.allowedSolutionTypes).toEqual(expect.arrayContaining(['service', 'repeatable_service', 'product', 'partnership']));
    expect(niche.outreachMode).toBe('draft');
  });

  it('rejects incomplete niche profiles', () => {
    expect(() => validateNicheProfile({
      ...SAUDI_UMRAH_NICHE,
      businessCategories: [],
    })).toThrow();
  });
});
