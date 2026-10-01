import { describe, expect, it } from 'vitest';
import { InMemoryNicheProfileRegistry, SAUDI_UMRAH_NICHE, CLINICS_HOSPITALS_NICHE, validateNicheProfile } from './niche-profiles.js';

describe('niche profiles', () => {
  it('validates and stores generic niche strategy metadata', () => {
    const registry = new InMemoryNicheProfileRegistry();
    registry.upsert(SAUDI_UMRAH_NICHE);
    const niche = registry.get('saudi-umrah');
    expect(niche?.businessCategories.length).toBeGreaterThan(0);
    expect(niche?.discoveryQueries.length).toBeGreaterThan(0);
    expect(niche?.revenueModels.length).toBeGreaterThan(0);
    expect(niche?.outreachTemplates.length).toBeGreaterThan(0);
  });

  it('contains Saudi Umrah geography and reusable commercial configuration', () => {
    const niche = validateNicheProfile(SAUDI_UMRAH_NICHE);
    expect(niche.geographies).toEqual(expect.arrayContaining(['Saudi Arabia', 'Makkah', 'Madinah', 'Jeddah']));
    expect(niche.allowedSolutionTypes).toEqual(expect.arrayContaining(['service', 'repeatable_service', 'product', 'partnership']));
    expect(niche.outreachMode).toBe('draft');
  });

  it('contains clinics & hospitals profile with healthcare-specific configuration', () => {
    const niche = validateNicheProfile(CLINICS_HOSPITALS_NICHE);
    expect(niche.id).toBe('clinics-hospitals');
    expect(niche.businessCategories).toEqual(expect.arrayContaining(['clinic', 'hospital', 'dental clinic']));
    expect(niche.discoveryQueries).toEqual(expect.arrayContaining(['clinic', 'hospital', 'medical center']));
    expect(niche.discoverySignals).toEqual(expect.arrayContaining(['no website', 'no online appointment booking', 'no HTTPS']));
    expect(niche.outreachTemplates.length).toBeGreaterThan(0);
    expect(niche.outreachTemplates[0]?.channel).toBe('email');
    expect(niche.outreachTemplates[0]?.language).toBe('en');
  });

  it('rejects incomplete niche profiles', () => {
    expect(() => validateNicheProfile({
      ...SAUDI_UMRAH_NICHE,
      businessCategories: [],
    })).toThrow();
  });

  it('rejects niche profiles without outreach templates', () => {
    expect(() => validateNicheProfile({
      ...SAUDI_UMRAH_NICHE,
      outreachTemplates: [],
    })).toThrow('at least one outreachTemplate');
  });
});
