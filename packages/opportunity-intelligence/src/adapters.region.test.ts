import { describe, expect, it } from 'vitest';
import { inferPlacesRegion } from './adapters.js';

describe('inferPlacesRegion', () => {
  it('uses Pakistan for Pakistani cities', () => {
    expect(inferPlacesRegion('Karachi')).toBe('PK');
    expect(inferPlacesRegion('Lahore')).toBe('PK');
  });

  it('defaults to Saudi Arabia for Gulf cities', () => {
    expect(inferPlacesRegion('Makkah')).toBe('SA');
    expect(inferPlacesRegion('Riyadh')).toBe('SA');
  });
});
